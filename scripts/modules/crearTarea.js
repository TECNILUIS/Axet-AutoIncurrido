// scripts/modules/crearTarea.js

// Seguimiento temporal del tipo de tarea seleccionado para manejar pasos condicionales
// (Se inicializará dentro de la función crearTarea)

/**
 * Ejecuta el flujo completo de creación de una tarea.
 * @param {object} tarea - Objeto de la tarea (formato nuevo).
 * Debe contener: nombre, codigoProyecto, horas, minutos.
 * @param {object} config - El objeto de configuración v2.5 (para sdaComun y tecnologiaComun).
 * @returns {boolean} - true si la creación fue exitosa, false si falló.
 */
async function crearTarea(tarea, config) {
    // Asegurar que las dependencias (utils.js) están cargadas
    if (typeof findElementByText !== 'function' || typeof waitForElement !== 'function' || typeof requestPageToast !== 'function' || typeof waitForCondition !== 'function') {
        console.error("[Crear Tarea] Faltan funciones auxiliares (utils/toast).");
        requestPageToast("Error: Faltan funciones auxiliares.", "error");
        return false;
    }
    
    // Función 'sleep' (si está disponible) para pausas de estabilización
    const safeSleep = async (ms) => {
        if (typeof sleep === 'function') {
            await sleep(ms);
        }
    };

    // Variable de estado local para esta ejecución
    let lastSelectedTaskType = null;

    console.log("[Crear Tarea] Iniciando flujo de creación para:", tarea);
    requestPageToast(`Iniciando creación de tarea...`, 'info', 2000);

    try {
        // --- PASO 1: Clic en "Nueva Tarea" ---
        console.log("[Crear Tarea] Paso 1: Buscando 'Nueva Tarea' en sidebar...");
        //requestPageToast('Paso 1: Clic en Nueva Tarea...', 'info', 2000);
        const nuevaTareaLink = findElementByText('.sidebar.navbar-nav a', 'Nueva tarea');
        if (!nuevaTareaLink) throw new Error("Link 'Nueva Tarea' no encontrado.");
        nuevaTareaLink.click();
        console.log("[Crear Tarea] Paso 1: Clic realizado.");

        // PAUSA: Esperar a que el panel de "Nueva Tarea" comience a cargarse
        await safeSleep(500);

        // --- PASO 2: Clic en "Servicios prestados a proyectos con código" ---
        console.log("[Crear Tarea] Paso 2: Esperando botón 'Servicios... con código'...");
        //requestPageToast('Paso 2: Seleccionando tipo de servicio...', 'info', 2000);
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

        // PAUSA: Esperar a que el siguiente paso (SDA) comience a cargarse
        await safeSleep(500);

        // --- PASO 3: Rellenar SDATool ---
        console.log("[Crear Tarea] Paso 3: Esperando input y rellenando SDATool...");
        //requestPageToast('Paso 3: Buscando SDA...', 'info', 2000);
        const sdaInput = await waitForElement('input[name="data[buscarOtroProyecto]"]', null, document, 10000);
        if (!sdaInput) throw new Error("Input 'buscarOtroProyecto' no encontrado.");
        
        if (!config.sdaComun) throw new Error("SDA Común no encontrado en config.");

        await waitForCondition(
            () => sdaInput.offsetParent !== null,
            10000,
            "Input 'buscarOtroProyecto' visible"
        );

        sdaInput.focus();
        sdaInput.value = config.sdaComun;
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

        // PAUSA: Esperar a que la búsqueda de SDA devuelva resultados
        await safeSleep(500);

        // --- PASO 4: Seleccionar proyecto buscado ---
        console.log("[Crear Tarea] Paso 4: Esperando select de resultados...");
        //requestPageToast('Paso 4: Seleccionando resultado SDA...', 'info', 2000);
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
        
        // PAUSA: Esperar a que se cargue el siguiente paso (tipo de servicio)
        await safeSleep(500);

        // --- PASO 5: Seleccionar tipo de servicio y continuar ---
        console.log("[Crear Tarea] Paso 5: Esperando select de tipo de servicio...");
        //requestPageToast('Paso 5: Seleccionando tipo de tarea...', 'info', 2000);
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

        if (!tarea || !tarea.nombre) throw new Error("Datos de 'nombre' (tipo de tarea) no encontrados en la tarea.");
        
        const optionTextToSelect = tarea.nombre; // Ej: "Construcción"
        
        console.log(`[Crear Tarea] Paso 5: Tipo de tarea a seleccionar '${optionTextToSelect}'.`);
        lastSelectedTaskType = optionTextToSelect; 

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

        // PAUSA: Esperar a que se cargue el siguiente paso (feature/proyecto)
        await safeSleep(2000);

        // --- PASO 6: Seleccionar Feature/Proyecto específico ---
        console.log("[Crear Tarea] Paso 6: Esperando select de feature/proyecto...");
        //requestPageToast('Paso 6: Seleccionando feature/proyecto...', 'info', 2000);
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

        if (!tarea.codigoProyecto) throw new Error("Datos de 'codigoProyecto' (feature/proyecto) no encontrados en la tarea.");
        const featureTarget = tarea.codigoProyecto; 

        filterInput.value = featureTarget;
        filterInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        
        // Espera breve para que el filtrado (potencialmente asíncrono) se aplique
        await safeSleep(300);

        const featureOption = await waitForElement('div.choices__item', featureTarget, featureChoicesRoot, 5000);
        if (!featureOption) throw new Error(`Opción '${featureTarget}' no encontrada en feature/proyecto.`);

        featureOption.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
        featureOption.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
        featureOption.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

        await waitForCondition(
            () => {
                const selected = featureChoicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
                return selected && selected.textContent && selected.textContent.includes(featureTarget);
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

        // PAUSA: Esperar a que se cargue el siguiente paso (tecnología o incurrir)
        await safeSleep(500);

        // --- PASO 7: Selección de tecnología (solo para Construcción) ---
        if (lastSelectedTaskType !== 'Construcción') {
            console.log(`[Crear Tarea] Paso 7: Tipo de tarea '${lastSelectedTaskType}' no requiere tecnología específica. Saltando...`);
        } else {
            console.log("[Crear Tarea] Paso 7: Esperando select de tecnología...");
            //requestPageToast('Paso 7: Seleccionando tecnología...', 'info', 2000);
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

            if (!config.tecnologiaComun) throw new Error("Datos de 'tecnologiaComun' no encontrados en la config (necesaria para Construcción).");
            const tecnologiaObjetivo = config.tecnologiaComun;
            
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
            
            // PAUSA: Esperar a que se cargue el paso final (incurrir)
            await safeSleep(2000);
        }

        // --- PASO 8: Introducir horas/minutos e incurrir ---
        console.log("[Crear Tarea] Paso 8: Esperando input de horas...");
        //requestPageToast('Paso 8: Incurriendo tiempo...', 'info', 2000);
        const horasInput = await waitForElement('input[name="data[hours]"]', null, document, 10000);
        if (!horasInput) throw new Error("Input 'data[hours]' no encontrado.");

        const minutosInput = await waitForElement('input[name="data[minutes]"]', null, document, 10000);
        if (!minutosInput) throw new Error("Input 'data[minutes]' no encontrado.");

        if (tarea.horas === undefined || tarea.minutos === undefined) {
            throw new Error("Datos de 'horas'/'minutos' no encontrados en la tarea.");
        }
        
        const horasAsignar = String((tarea?.tareaCalc && tarea.tareaCalc.horas) || tarea.horas || '0');
        const minutosAsignar = String((tarea?.tareaCalc && tarea.tareaCalc.minutos) || tarea.minutos || '0');

        await safeSleep(500);

        horasInput.focus();
        horasInput.value = horasAsignar;
        horasInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        horasInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        console.log(`[Crear Tarea] Paso 8: Horas asignadas (${horasAsignar}).`);

        await safeSleep(500);

        minutosInput.focus();
        minutosInput.value = minutosAsignar;
        minutosInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        minutosInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        console.log(`[Crear Tarea] Paso 8: Minutos asignados (${minutosAsignar}).`);

        await safeSleep(500);

        console.log("[Crear Tarea] Paso 8: Esperando botón 'Incurrir'...");
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

        // PAUSA: Esperar a que la acción de incurrir se procese
        await safeSleep(500);
        
        requestPageToast("Tarea creada e incurrida correctamente.", 'success', 4000);

        return true; // Éxito

    } catch (error) {
        console.error(`[Crear Tarea] Error durante la creación:`, error);
        requestPageToast(`Error en creación: ${error.message}`, 'error', 5000);
        return false; // Fallo
    }
}

console.log("crearTarea.js loaded");