// scripts/modules/crearTarea.js

// variable de estado (será gestionada por content.js)
// window.debugTaskCreationStep = 0; // Lo definiremos en content.js

/**
 * Ejecuta un paso específico del flujo de creación de tareas.
 * @param {number} step - El paso a ejecutar (1, 2, 3, etc.).
 * @param {object} config - El objeto de configuración v2.5.
 * @returns {number} - El siguiente número de paso.
 */
async function executeTaskCreationStep(step, config) {
    // Asegurar que las dependencias (utils.js) están cargadas
    if (typeof findElementByText !== 'function' || typeof waitForElement !== 'function' || typeof requestPageToast !== 'function') {
        console.error("[Crear Tarea] Faltan funciones auxiliares (utils/toast).");
        requestPageToast("Error: Faltan funciones auxiliares.", "error");
        return 0; // Reiniciar en caso de error grave
    }

    console.log(`[Crear Tarea] Ejecutando Paso ${step}...`);
    requestPageToast(`Ejecutando Paso ${step}...`, 'info', 2000);

    try {
        switch (step) {
            case 1:
                // --- PASO 1: Clic en "Nueva Tarea" ---
                console.log("[Crear Tarea] Paso 1: Buscando 'Nueva Tarea' en sidebar...");
                const nuevaTareaLink = findElementByText('.sidebar.navbar-nav a', 'Nueva tarea');
                if (!nuevaTareaLink) throw new Error("Link 'Nueva Tarea' no encontrado.");
                nuevaTareaLink.click();
                console.log("[Crear Tarea] Paso 1: Clic realizado.");
                break;

            case 2:
                // --- PASO 2: Clic en "Servicios prestados a proyectos con código" ---
                console.log("[Crear Tarea] Paso 2: Esperando botón 'Servicios... con código'...");
                const botonProyectosConCodigo = await waitForElement('button[name="data[buttonSdaProjects]"]', null, document, 10000);
                if (!botonProyectosConCodigo) throw new Error("Botón 'Proyectos con código' no encontrado.");
                botonProyectosConCodigo.click();
                console.log("[Crear Tarea] Paso 2: Clic realizado.");
                break;

            case 3:
                // --- PASO 3: Rellenar SDATool ---
                console.log("[Crear Tarea] Paso 3: Esperando input y rellenando SDATool...");
                const sdaInput = await waitForElement('input[name="data[buscarOtroProyecto]"]', null, document, 10000);
                if (!sdaInput) throw new Error("Input 'buscarOtroProyecto' no encontrado.");
                if (!config.sdaComun) throw new Error("SDA Común no encontrado en config. (Importa CSV primero)");
                
                sdaInput.value = config.sdaComun; // Poner el número (ej. '51147')
                sdaInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                console.log(`[Crear Tarea] Paso 3: Input rellenado con ${config.sdaComun}.`);
                break;

            case 4:
                // --- PASO 4: Clic en "Buscar" ---
                console.log("[Crear Tarea] Paso 4: Buscando y haciendo clic en 'Buscar'...");
                // Esperar que el input esté rellenado (como confirmación)
                await waitForCondition(() => document.querySelector('input[name="data[buscarOtroProyecto]"]').value === config.sdaComun, 3000, "Input SDA rellenado");
                const botonBuscar = await waitForElement('button[name="data[buscar]"]');
                if (!botonBuscar) throw new Error("Botón 'Buscar' no encontrado.");
                botonBuscar.click();
                console.log("[Crear Tarea] Paso 4: Clic realizado.");
                break;

            case 5:
                // --- PASO 5: Abrir desplegable de resultados ---
                console.log("[Crear Tarea] Paso 5: Esperando desplegable de resultados...");
                // Esperar a que el contenedor del select aparezca y NO esté oculto
                const dropdownContainer = await waitForElement('div[id*="seleccionarResultadoDeLaBusqueda"] .choices', null, document, 10000);
                if (!dropdownContainer) throw new Error("Contenedor dropdown resultados no encontrado.");
                if (dropdownContainer.closest('.formio-hidden')) throw new Error("Dropdown de resultados sigue oculto. Búsqueda falló?");
                
                console.log("[Crear Tarea] Paso 5: Abriendo desplegable...");
                dropdownContainer.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
                console.log("[Crear Tarea] Paso 5: Clic para abrir desplegable realizado.");
                break;

            case 6:
                // --- PASO 6: Seleccionar el SDATool correcto ---
                console.log("[Crear Tarea] Paso 6: Buscando opción con SDATool...");
                if (!config.sdaComun) throw new Error("SDA Común no encontrado en config.");
                const sdaText = `SDATOOL-${config.sdaComun}`; // ej. "SDATOOL-51147"
                
                // Buscar la opción dentro del dropdown (que debe estar abierto)
                // El contenedor de opciones puede estar en el body o dentro del componente
                const dropdownParent = document.querySelector('div[id*="seleccionarResultadoDeLaBusqueda"]');
                const opcionSDA = await waitForElement('div.choices__item[role="option"]', sdaText, dropdownParent, 5000);
                if (!opcionSDA) throw new Error(`Opción con texto '${sdaText}' no encontrada.`);
                
                opcionSDA.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                opcionSDA.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
                console.log(`[Crear Tarea] Paso 6: Clic en la opción '${sdaText}' realizado.`);
                break;

            case 7:
                // --- PASO 7: Clic en "Seleccionar proyecto buscado" ---
                console.log("[Crear Tarea] Paso 7: Esperando botón 'Seleccionar proyecto buscado'...");
                // Esperar a que el botón aparezca (puede estar oculto al inicio)
                const botonSeleccionarProyecto = await waitForElement('button[name="data[seleccionarProyectoBuscado]"]', null, document, 5000);
                if (!botonSeleccionarProyecto || botonSeleccionarProyecto.closest('.formio-hidden')) {
                    throw new Error("Botón 'Seleccionar proyecto buscado' no encontrado o sigue oculto.");
                }
                botonSeleccionarProyecto.click();
                console.log("[Crear Tarea] Paso 7: Clic realizado.");
                requestPageToast("Paso 7 completado. Indica los siguientes pasos.", 'success', 5000);
                break;

            default:
                console.log(`[Crear Tarea] Paso ${step} no definido. Reiniciando debug.`);
                requestPageToast(`Debug: Paso ${step} no definido. Reiniciando a 0.`, 'warning');
                return 0; // Reiniciar
        }

        return step + 1; // Devolver el siguiente número de paso
    } catch (error) {
        console.error(`[Crear Tarea] Error en Paso ${step}:`, error);
        requestPageToast(`Error en Paso ${step}: ${error.message}`, 'error', 5000);
        console.log("[Crear Tarea] Reiniciando contador de pasos a 0 debido al error.");
        return 0; // Reiniciar en caso de error
    }
}

console.log("crearTarea.js loaded");