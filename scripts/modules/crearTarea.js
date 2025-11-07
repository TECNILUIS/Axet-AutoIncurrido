// scripts/modules/crearTarea.js

// variable de estado (será gestionada por content.js)
// window.debugTaskCreationStep = 0; // Lo definiremos en content.js

// Seguimiento temporal del tipo de tarea seleccionado para manejar pasos condicionales
let lastSelectedTaskType = null;

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
                const botonProyectosConCodigo = await waitForElement('button[name="data[buttonSdaProjects]"]', 'Servicios prestados a proyectos con código', document, 10000);
                if (!botonProyectosConCodigo) throw new Error("Botón 'Proyectos con código' no encontrado.");

                await waitForCondition(
                    () => botonProyectosConCodigo.offsetParent !== null && !botonProyectosConCodigo.closest('.formio-hidden'),
                    10000,
                    "Botón 'Servicios con código' visible"
                );

                if (botonProyectosConCodigo.disabled) {
                    await waitForCondition(() => !botonProyectosConCodigo.disabled, 5000, "Botón 'Servicios con código' habilitado");
                }

                botonProyectosConCodigo.click();
                console.log("[Crear Tarea] Paso 2: Clic realizado.");
                break;

            case 3:
                // --- PASO 3: Rellenar SDATool ---
                console.log("[Crear Tarea] Paso 3: Esperando input y rellenando SDATool...");
                const sdaInput = await waitForElement('input[name="data[buscarOtroProyecto]"]', null, document, 10000);
                if (!sdaInput) throw new Error("Input 'buscarOtroProyecto' no encontrado.");
                if (!config.sdaComun) throw new Error("SDA Común no encontrado en config. (Importa CSV primero)");

                await waitForCondition(
                    () => sdaInput.offsetParent !== null,
                    10000,
                    "Input 'buscarOtroProyecto' visible"
                );

                sdaInput.focus();
                sdaInput.value = config.sdaComun; // Escribir el SDATOOL de la config
                sdaInput.dispatchEvent(new Event('input', { bubbles: true }));
                sdaInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`[Crear Tarea] Paso 3: Input rellenado con ${config.sdaComun}.`);

                console.log("[Crear Tarea] Paso 3: Esperando botón 'Buscar'...");
                const botonBuscarPaso3 = await waitForElement('button[name="data[buscar]"]', 'Buscar', document, 10000);
                if (!botonBuscarPaso3) throw new Error("Botón 'Buscar' no encontrado tras rellenar SDATool.");

                await waitForCondition(
                    () => botonBuscarPaso3.offsetParent !== null && !botonBuscarPaso3.closest('.formio-hidden'),
                    10000,
                    "Botón 'Buscar' visible"
                );

                if (botonBuscarPaso3.disabled) {
                    await waitForCondition(() => !botonBuscarPaso3.disabled, 5000, "Botón 'Buscar' habilitado");
                }

                botonBuscarPaso3.click();
                console.log("[Crear Tarea] Paso 3: Clic en 'Buscar' realizado.");
                break;

            case 4:
                // --- PASO 4: Seleccionar proyecto buscado ---
                console.log("[Crear Tarea] Paso 4: Esperando select de resultados...");
                const selectResultados = await waitForElement('select[name="data[seleccionarResultadoDeLaBusqueda]"]', null, document, 10000);
                if (!selectResultados) throw new Error("Select 'seleccionarResultadoDeLaBusqueda' no encontrado.");

                const choicesRoot = selectResultados.closest('.choices') || selectResultados.closest('[data-type="select-one"]');
                if (!choicesRoot) throw new Error("Contenedor Choices del select de resultados no encontrado.");

                await waitForCondition(
                    () => choicesRoot.offsetParent !== null && !choicesRoot.classList.contains('formio-hidden'),
                    10000,
                    "Select de resultados visible"
                );

                const toggleArea = choicesRoot.querySelector('.selection.dropdown, .choices__inner, .choices__list--single');
                if (!toggleArea) throw new Error("Área clicable del dropdown no encontrada.");

                console.log("[Crear Tarea] Paso 4: Abriendo dropdown de resultados...");
                toggleArea.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                toggleArea.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                toggleArea.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

                const sdaTargetText = `SDATOOL-${config.sdaComun}`;
                console.log(`[Crear Tarea] Paso 4: Buscando opción '${sdaTargetText}'...`);
                const opcionSda = await waitForElement('div.choices__item', sdaTargetText, choicesRoot, 7000);
                if (!opcionSda) throw new Error(`Opción '${sdaTargetText}' no encontrada en resultados.`);

                opcionSda.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                opcionSda.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                opcionSda.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

                await waitForCondition(
                    () => {
                        const selected = choicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
                        return selected && selected.textContent && selected.textContent.includes(sdaTargetText);
                    },
                    5000,
                    "Resultado SDA seleccionado"
                );

                console.log("[Crear Tarea] Paso 4: Esperando botón 'Seleccionar proyecto buscado'...");
                const botonSeleccionar = await waitForElement('button[name="data[seleccionarProyectoBuscado]"]', 'Seleccionar proyecto buscado', document, 10000);
                if (!botonSeleccionar) throw new Error("Botón 'Seleccionar proyecto buscado' no encontrado.");

                await waitForCondition(
                    () => botonSeleccionar.offsetParent !== null && !botonSeleccionar.closest('.formio-hidden'),
                    10000,
                    "Botón 'Seleccionar proyecto buscado' visible"
                );

                if (botonSeleccionar.disabled) {
                    await waitForCondition(() => !botonSeleccionar.disabled, 5000, "Botón 'Seleccionar proyecto buscado' habilitado");
                }

                botonSeleccionar.click();
                console.log("[Crear Tarea] Paso 4: Proyecto seleccionado y botón pulsado.");
                break;

            case 5:
                // --- PASO 5: Seleccionar tipo de servicio y continuar ---
                console.log("[Crear Tarea] Paso 5: Esperando select de tipo de servicio...");
                const selectServiceType = await waitForElement('select[name="data[selectServiceType]"]', null, document, 10000);
                if (!selectServiceType) throw new Error("Select 'selectServiceType' no encontrado.");

                const serviceChoicesRoot = selectServiceType.closest('.choices') || selectServiceType.closest('[data-type="select-one"]') || selectServiceType.closest('.selection.dropdown');
                if (!serviceChoicesRoot) throw new Error("Contenedor Choices del tipo de servicio no encontrado.");

                await waitForCondition(
                    () => serviceChoicesRoot.offsetParent !== null && !(serviceChoicesRoot.classList && serviceChoicesRoot.classList.contains('formio-hidden')),
                    10000,
                    "Select de tipo de servicio visible"
                );

                const toggleServiceArea = serviceChoicesRoot.querySelector('.selection.dropdown, .choices__inner, .choices__list--single');
                if (!toggleServiceArea) throw new Error("Área clicable del tipo de servicio no encontrada.");

                const normalizedTarget = 'construccion';

                const normalizeClave = (value) => value
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');

                const serviceTypeMap = {
                    'diseno': 'Análisis y diseño (antigua fase de Diseño)',
                    'construccion': 'Construcción',
                    'pruebas': 'Pruebas',
                    'despliegue': 'Despliegue'
                };

                const lookupKey = normalizeClave(normalizedTarget);
                const optionTextToSelect = serviceTypeMap[lookupKey];
                if (!optionTextToSelect) {
                    throw new Error(`Tipo de tarea '${normalizedTarget}' no soportado. Valores permitidos: Diseño, Construcción, Pruebas o Despliegue.`);
                }
                console.log(`[Crear Tarea] Paso 5: Tipo de tarea '${normalizedTarget}' mapea a opción '${optionTextToSelect}'.`);
                lastSelectedTaskType = lookupKey;

                console.log("[Crear Tarea] Paso 5: Abriendo dropdown de tipo de servicio...");
                toggleServiceArea.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                toggleServiceArea.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                toggleServiceArea.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

                const serviceOption = await waitForElement('div.choices__item', optionTextToSelect, serviceChoicesRoot, 7000);
                if (!serviceOption) throw new Error(`Opción de servicio '${optionTextToSelect}' no encontrada.`);

                serviceOption.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                serviceOption.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                serviceOption.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

                await waitForCondition(
                    () => {
                        const selected = serviceChoicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
                        return selected && selected.textContent && selected.textContent.includes(optionTextToSelect);
                    },
                    5000,
                    "Tipo de servicio seleccionado"
                );

                console.log("[Crear Tarea] Paso 5: Esperando botón 'Siguiente'...");
                const botonSiguiente = await waitForElement('button[name="data[submit]"]', 'Siguiente', document, 10000);
                if (!botonSiguiente) throw new Error("Botón 'Siguiente' no encontrado.");

                await waitForCondition(
                    () => botonSiguiente.offsetParent !== null && !botonSiguiente.closest('.formio-hidden'),
                    10000,
                    "Botón 'Siguiente' visible"
                );

                if (botonSiguiente.disabled) {
                    await waitForCondition(() => !botonSiguiente.disabled, 5000, "Botón 'Siguiente' habilitado");
                }

                botonSiguiente.click();
                console.log("[Crear Tarea] Paso 5: Tipo de servicio seleccionado y botón 'Siguiente' pulsado.");
                break;

            case 6:
                // --- PASO 6: Seleccionar Feature/Proyecto específico ---
                console.log("[Crear Tarea] Paso 6: Esperando select de feature/proyecto...");
                const selectFeatureProyecto = await waitForElement('select[name="data[seleccionarFeatureProyecto]"]', null, document, 10000);
                if (!selectFeatureProyecto) throw new Error("Select 'seleccionarFeatureProyecto' no encontrado.");

                const featureChoicesRoot = selectFeatureProyecto.closest('.choices') || selectFeatureProyecto.closest('[data-type="select-one"]') || selectFeatureProyecto.closest('.selection.dropdown');
                if (!featureChoicesRoot) throw new Error("Contenedor Choices de feature/proyecto no encontrado.");

                await waitForCondition(
                    () => featureChoicesRoot.offsetParent !== null && !(featureChoicesRoot.classList && featureChoicesRoot.classList.contains('formio-hidden')),
                    10000,
                    "Select de feature/proyecto visible"
                );

                const toggleFeatureArea = featureChoicesRoot.querySelector('.selection.dropdown, .choices__inner, .choices__list--single');
                if (!toggleFeatureArea) throw new Error("Área clicable de feature/proyecto no encontrada.");

                console.log("[Crear Tarea] Paso 6: Abriendo dropdown de feature/proyecto...");
                toggleFeatureArea.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                toggleFeatureArea.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                toggleFeatureArea.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

                const filterInput = featureChoicesRoot.querySelector('input.choices__input--cloned');
                if (!filterInput) throw new Error("Input de búsqueda en dropdown de feature/proyecto no encontrado.");

                filterInput.value = 'WSONEPIV10-5705';
                filterInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                await sleep(300);

                const featureOption = await waitForElement('div.choices__item', 'WSONEPIV10-5705', featureChoicesRoot, 5000);
                if (!featureOption) throw new Error("Opción 'WSONEPIV10-5705' no encontrada en feature/proyecto.");

                featureOption.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                featureOption.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                featureOption.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

                await waitForCondition(
                    () => {
                        const selected = featureChoicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
                        return selected && selected.textContent && selected.textContent.includes('WSONEPIV10-5705');
                    },
                    5000,
                    "Feature/proyecto seleccionado"
                );

                console.log("[Crear Tarea] Paso 6: Feature/proyecto seleccionado. Esperando botón 'Seleccionar'...");
                const botonSeleccionarFeature = await waitForElement('button[name="data[seleccionar]"]', 'Seleccionar', document, 10000);
                if (!botonSeleccionarFeature) throw new Error("Botón 'Seleccionar' (feature/proyecto) no encontrado.");

                await waitForCondition(
                    () => botonSeleccionarFeature.offsetParent !== null && !botonSeleccionarFeature.closest('.formio-hidden'),
                    10000,
                    "Botón 'Seleccionar' visible"
                );

                if (botonSeleccionarFeature.disabled) {
                    await waitForCondition(() => !botonSeleccionarFeature.disabled, 5000, "Botón 'Seleccionar' habilitado");
                }

                botonSeleccionarFeature.click();
                console.log("[Crear Tarea] Paso 6: Botón 'Seleccionar' pulsado.");
                break;

            case 7:
                // --- PASO 7: Selección de tecnología (solo para Construcción) ---
                if (lastSelectedTaskType !== 'construccion') {
                    console.log("[Crear Tarea] Paso 7: Tipo de tarea no requiere tecnología específica. Avanzando...");
                    return step + 1;
                }

                console.log("[Crear Tarea] Paso 7: Esperando select de tecnología...");
                const selectTechType = await waitForElement('select[name="data[selectTechType]"]', null, document, 10000);
                if (!selectTechType) throw new Error("Select 'selectTechType' no encontrado.");

                const techChoicesRoot = selectTechType.closest('.choices') || selectTechType.closest('[data-type="select-one"]') || selectTechType.closest('.selection.dropdown');
                if (!techChoicesRoot) throw new Error("Contenedor Choices de tecnología no encontrado.");

                await waitForCondition(
                    () => techChoicesRoot.offsetParent !== null && !(techChoicesRoot.classList && techChoicesRoot.classList.contains('formio-hidden')),
                    10000,
                    "Select de tecnología visible"
                );

                const toggleTechArea = techChoicesRoot.querySelector('.selection.dropdown, .choices__inner, .choices__list--single');
                if (!toggleTechArea) throw new Error("Área clicable de tecnología no encontrada.");

                console.log("[Crear Tarea] Paso 7: Abriendo dropdown de tecnología...");
                toggleTechArea.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                toggleTechArea.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                toggleTechArea.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

                const tecnologiaObjetivo = 'Cells';
                const techOption = await waitForElement('div.choices__item', tecnologiaObjetivo, techChoicesRoot, 5000);
                if (!techOption) throw new Error(`Opción de tecnología '${tecnologiaObjetivo}' no encontrada.`);

                techOption.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                techOption.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                techOption.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

                await waitForCondition(
                    () => {
                        const selected = techChoicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
                        return selected && selected.textContent && selected.textContent.includes(tecnologiaObjetivo);
                    },
                    5000,
                    "Tecnología seleccionada"
                );

                console.log("[Crear Tarea] Paso 7: Tecnología seleccionada. Esperando botón 'Siguiente'...");
                const botonTechSiguiente = await waitForElement('button[name="data[submit]"]', 'Siguiente', document, 10000);
                if (!botonTechSiguiente) throw new Error("Botón 'Siguiente' tras seleccionar tecnología no encontrado.");

                await waitForCondition(
                    () => botonTechSiguiente.offsetParent !== null && !botonTechSiguiente.closest('.formio-hidden'),
                    10000,
                    "Botón 'Siguiente' post-tecnología visible"
                );

                if (botonTechSiguiente.disabled) {
                    await waitForCondition(() => !botonTechSiguiente.disabled, 5000, "Botón 'Siguiente' post-tecnología habilitado");
                }

                botonTechSiguiente.click();
                console.log("[Crear Tarea] Paso 7: Botón 'Siguiente' tras tecnología pulsado.");
                break;

            case 8:
                // --- PASO 8: Introducir horas/minutos e incurrir ---
                console.log("[Crear Tarea] Paso 8: Esperando input de horas...");
                const horasInput = await waitForElement('input[name="data[hours]"]', null, document, 10000);
                if (!horasInput) throw new Error("Input 'data[hours]' no encontrado.");

                const minutosInput = await waitForElement('input[name="data[minutes]"]', null, document, 10000);
                if (!minutosInput) throw new Error("Input 'data[minutes]' no encontrado.");

                const pendingTaskForTiempo = (typeof window !== 'undefined' && (window.axetPendingTask || window.debugTaskCreation)) || {};
                const horasAsignar = (pendingTaskForTiempo?.tareaCalc && pendingTaskForTiempo.tareaCalc.horas) || pendingTaskForTiempo.horas || '5';
                const minutosAsignar = (pendingTaskForTiempo?.tareaCalc && pendingTaskForTiempo.tareaCalc.minutos) || pendingTaskForTiempo.minutos || '0';

                horasInput.focus();
                horasInput.value = horasAsignar;
                horasInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                horasInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                console.log(`[Crear Tarea] Paso 7: Horas asignadas (${horasAsignar}).`);

                minutosInput.focus();
                minutosInput.value = minutosAsignar;
                minutosInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                minutosInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                console.log(`[Crear Tarea] Paso 7: Minutos asignados (${minutosAsignar}).`);

                console.log("[Crear Tarea] Paso 7: Esperando botón 'Incurrir'...");
                const botonIncurrir = await waitForElement('button[name="data[worklogBoton]"]', 'Incurrir', document, 10000);
                if (!botonIncurrir) throw new Error("Botón 'Incurrir' no encontrado.");

                await waitForCondition(
                    () => botonIncurrir.offsetParent !== null && !botonIncurrir.closest('.formio-hidden'),
                    10000,
                    "Botón 'Incurrir' visible"
                );

                if (botonIncurrir.disabled) {
                    await waitForCondition(() => !botonIncurrir.disabled, 5000, "Botón 'Incurrir' habilitado");
                }

                botonIncurrir.click();
                console.log("[Crear Tarea] Paso 8: Botón 'Incurrir' pulsado.");
                requestPageToast("Paso 8 completado. Proporciona los siguientes pasos si los hay.", 'success', 4000);
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