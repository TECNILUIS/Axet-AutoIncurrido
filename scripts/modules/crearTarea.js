// scripts/modules/crearTarea.js

// Seguimiento temporal del tipo de tarea seleccionado para manejar pasos condicionales
// (Se inicializará dentro de la función crearTarea)

/**
 * Espera a que el DOM cambie y un selector específico aparezca.
 * Usa MutationObserver para detectar cambios en el DOM de forma eficiente.
 * @param {string} selector - Selector CSS del elemento a esperar.
 * @param {string|null} textContent - Texto opcional que debe contener el elemento.
 * @param {Element} container - Contenedor donde buscar (por defecto document).
 * @param {number} timeout - Tiempo máximo de espera en ms.
 * @returns {Promise<Element>} - El elemento encontrado.
 */
function waitForElementMutation(selector, textContent = null, container = document, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        // Primero, verificar si ya existe
        const checkExisting = () => {
            const elements = container.querySelectorAll(selector);
            if (textContent) {
                for (const el of elements) {
                    if (el.textContent && el.textContent.trim().includes(textContent)) {
                        return el;
                    }
                }
                return null;
            }
            return elements.length > 0 ? elements[0] : null;
        };

        const existing = checkExisting();
        if (existing) {
            resolve(existing);
            return;
        }

        // Si no existe, configurar MutationObserver
        const observer = new MutationObserver((mutations) => {
            const found = checkExisting();
            if (found) {
                observer.disconnect();
                resolve(found);
                return;
            }

            // Verificar timeout
            if (Date.now() - startTime > timeout) {
                observer.disconnect();
                reject(new Error(`Timeout esperando elemento: ${selector}${textContent ? ` con texto "${textContent}"` : ''}`));
            }
        });

        observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'disabled']
        });

        // Timeout de seguridad
        setTimeout(() => {
            observer.disconnect();
            const finalCheck = checkExisting();
            if (finalCheck) {
                resolve(finalCheck);
            } else {
                reject(new Error(`Timeout esperando elemento: ${selector}${textContent ? ` con texto "${textContent}"` : ''}`));
            }
        }, timeout);
    });
}

/**
 * Espera a que un elemento esté visible y habilitado usando MutationObserver.
 * @param {Element} element - El elemento a observar.
 * @param {number} timeout - Tiempo máximo de espera en ms.
 * @param {string} description - Descripción para logs.
 * @returns {Promise<void>}
 */
function waitForElementReady(element, timeout = 10000, description = 'Elemento') {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const isReady = () => {
            return element.offsetParent !== null && 
                   !element.disabled && 
                   !element.closest('.formio-hidden');
        };

        if (isReady()) {
            resolve();
            return;
        }

        const observer = new MutationObserver(() => {
            if (isReady()) {
                observer.disconnect();
                resolve();
                return;
            }

            if (Date.now() - startTime > timeout) {
                observer.disconnect();
                reject(new Error(`Timeout esperando que ${description} esté listo`));
            }
        });

        observer.observe(element.parentElement || document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'disabled']
        });

        // Observar el elemento mismo
        observer.observe(element, {
            attributes: true,
            attributeFilter: ['class', 'style', 'disabled']
        });

        setTimeout(() => {
            observer.disconnect();
            if (isReady()) {
                resolve();
            } else {
                reject(new Error(`Timeout esperando que ${description} esté listo`));
            }
        }, timeout);
    });
}

/**
 * Ejecuta el flujo completo de creación de una tarea.
 * @param {object} tarea - Objeto de la tarea (formato nuevo).
 * Debe contener: nombre, codigoProyecto, horas, minutos.
 * @param {object} config - El objeto de configuración v2.5 (para sdaComun y tecnologiaComun).
 * @returns {boolean} - true si la creación fue exitosa, false si falló.
 */
async function crearTarea(tarea, config) {
    // Asegurar que las dependencias (utils.js) están cargadas
    if (typeof findElementByText !== 'function' || typeof requestPageToast !== 'function') {
        console.error("[Crear Tarea] Faltan funciones auxiliares (utils/toast).");
        requestPageToast("Error: Faltan funciones auxiliares.", "error");
        return false;
    }

    // Variable de estado local para esta ejecución
    let lastSelectedTaskType = null;

    console.log("[Crear Tarea] Iniciando flujo de creación para:", tarea);
    requestPageToast(`Iniciando creación de tarea...`, 'info', 2000);

    try {
        // --- PASO 1: Clic en "Nueva Tarea" ---
        console.log("[Crear Tarea] Paso 1: Buscando 'Nueva Tarea' en sidebar...");
        const nuevaTareaLink = findElementByText('.sidebar.navbar-nav a', 'Nueva tarea');
        if (!nuevaTareaLink) throw new Error("Link 'Nueva Tarea' no encontrado.");
        nuevaTareaLink.click();
        console.log("[Crear Tarea] Paso 1: Clic realizado.");

        // --- PASO 2: Clic en "Servicios prestados a proyectos con código" ---
        console.log("[Crear Tarea] Paso 2: Esperando botón 'Servicios... con código'...");
        const botonProyectosConCodigo = await waitForElementMutation('button[name="data[buttonSdaProjects]"]', 'Servicios prestados a proyectos con código', document, 10000);
        if (!botonProyectosConCodigo) throw new Error("Botón 'Proyectos con código' no encontrado.");

        await waitForElementReady(botonProyectosConCodigo, 10000, "Botón 'Servicios con código'");
        botonProyectosConCodigo.click();
        console.log("[Crear Tarea] Paso 2: Clic realizado.");

        // Espera fija de 2 segundos antes del Paso 3
        console.log("[Crear Tarea] Esperando 2 segundos antes del Paso 3...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        // --- PASO 3: Rellenar SDATool ---
        console.log("[Crear Tarea] Paso 3: Esperando input y rellenando SDATool...");
        const sdaInput = await waitForElementMutation('input[name="data[buscarOtroProyecto]"]', null, document, 10000);
        if (!sdaInput) throw new Error("Input 'buscarOtroProyecto' no encontrado.");
        
        if (!config.sdaComun) throw new Error("SDA Común no encontrado en config.");

        await waitForElementReady(sdaInput, 10000, "Input 'buscarOtroProyecto'");

        sdaInput.focus();
        sdaInput.value = config.sdaComun;
        sdaInput.dispatchEvent(new Event('input', { bubbles: true }));
        sdaInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`[Crear Tarea] Paso 3: Input rellenado con ${config.sdaComun}.`);

        console.log("[Crear Tarea] Paso 3: Esperando botón 'Buscar'...");
        const botonBuscarPaso3 = await waitForElementMutation('button[name="data[buscar]"]', 'Buscar', document, 10000);
        if (!botonBuscarPaso3) throw new Error("Botón 'Buscar' no encontrado tras rellenar SDATool.");

        await waitForElementReady(botonBuscarPaso3, 10000, "Botón 'Buscar'");
        botonBuscarPaso3.click();
        console.log("[Crear Tarea] Paso 3: Clic en 'Buscar' realizado.");

        // --- PASO 4: Seleccionar proyecto buscado ---
        console.log("[Crear Tarea] Paso 4: Esperando select de resultados...");
        const selectResultados = await waitForElementMutation('select[name="data[seleccionarResultadoDeLaBusqueda]"]', null, document, 10000);
        if (!selectResultados) throw new Error("Select 'seleccionarResultadoDeLaBusqueda' no encontrado.");

        const choicesRoot = selectResultados.closest('.choices') || selectResultados.closest('[data-type="select-one"]');
        if (!choicesRoot) throw new Error("Contenedor Choices del select de resultados no encontrado.");

        await waitForElementReady(choicesRoot, 10000, "Select de resultados");

        const toggleArea = choicesRoot.querySelector('.selection.dropdown, .choices__inner, .choices__list--single');
        if (!toggleArea) throw new Error("Área clicable del dropdown no encontrada.");

        console.log("[Crear Tarea] Paso 4: Abriendo dropdown de resultados...");
        toggleArea.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
        toggleArea.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
        toggleArea.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

        const sdaTargetText = `SDATOOL-${config.sdaComun}`;
        console.log(`[Crear Tarea] Paso 4: Buscando opción '${sdaTargetText}'...`);
        const opcionSda = await waitForElementMutation('div.choices__item', sdaTargetText, choicesRoot, 7000);
        if (!opcionSda) throw new Error(`Opción '${sdaTargetText}' no encontrada en resultados.`);

        opcionSda.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
        opcionSda.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
        opcionSda.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

        // Esperar a que se seleccione usando MutationObserver
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                observer.disconnect();
                reject(new Error("Timeout esperando selección de SDA"));
            }, 5000);

            const observer = new MutationObserver(() => {
                const selected = choicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
                if (selected && selected.textContent && selected.textContent.includes(sdaTargetText)) {
                    clearTimeout(timeout);
                    observer.disconnect();
                    resolve();
                }
            });

            observer.observe(choicesRoot, {
                childList: true,
                subtree: true,
                characterData: true
            });

            // Verificar si ya está seleccionado
            const selected = choicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
            if (selected && selected.textContent && selected.textContent.includes(sdaTargetText)) {
                clearTimeout(timeout);
                observer.disconnect();
                resolve();
            }
        });

        console.log("[Crear Tarea] Paso 4: Esperando botón 'Seleccionar proyecto buscado'...");
        const botonSeleccionar = await waitForElementMutation('button[name="data[seleccionarProyectoBuscado]"]', 'Seleccionar proyecto buscado', document, 10000);
        if (!botonSeleccionar) throw new Error("Botón 'Seleccionar proyecto buscado' no encontrado.");

        await waitForElementReady(botonSeleccionar, 10000, "Botón 'Seleccionar proyecto buscado'");
        botonSeleccionar.click();
        console.log("[Crear Tarea] Paso 4: Proyecto seleccionado y botón pulsado.");

        // --- PASO 5: Seleccionar tipo de servicio y continuar ---

        // Espera fija de 2 segundos antes del Paso 5
        console.log("[Crear Tarea] Esperando 2 segundos antes del Paso 5...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log("[Crear Tarea] Paso 5: Esperando select de tipo de servicio...");
        const selectServiceType = await waitForElementMutation('select[name="data[selectServiceType]"]', null, document, 10000);
        if (!selectServiceType) throw new Error("Select 'selectServiceType' no encontrado.");

        const serviceChoicesRoot = selectServiceType.closest('.choices') || selectServiceType.closest('[data-type="select-one"]') || selectServiceType.closest('.selection.dropdown');
        if (!serviceChoicesRoot) throw new Error("Contenedor Choices del tipo de servicio no encontrado.");

        await waitForElementReady(serviceChoicesRoot, 10000, "Select de tipo de servicio");

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

        const serviceOption = await waitForElementMutation('div.choices__item', optionTextToSelect, serviceChoicesRoot, 7000);
        if (!serviceOption) throw new Error(`Opción de servicio '${optionTextToSelect}' no encontrada.`);

        serviceOption.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
        serviceOption.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
        serviceOption.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

        // Esperar selección usando MutationObserver
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                observer.disconnect();
                reject(new Error("Timeout esperando selección de tipo de servicio"));
            }, 5000);

            const observer = new MutationObserver(() => {
                const selected = serviceChoicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
                if (selected && selected.textContent && selected.textContent.includes(optionTextToSelect)) {
                    clearTimeout(timeout);
                    observer.disconnect();
                    resolve();
                }
            });

            observer.observe(serviceChoicesRoot, {
                childList: true,
                subtree: true,
                characterData: true
            });

            // Verificar si ya está seleccionado
            const selected = serviceChoicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
            if (selected && selected.textContent && selected.textContent.includes(optionTextToSelect)) {
                clearTimeout(timeout);
                observer.disconnect();
                resolve();
            }
        });

        console.log("[Crear Tarea] Paso 5: Esperando botón 'Siguiente'...");
        const botonSiguiente = await waitForElementMutation('button[name="data[submit]"]', 'Siguiente', document, 10000);
        if (!botonSiguiente) throw new Error("Botón 'Siguiente' no encontrado.");

        await waitForElementReady(botonSiguiente, 10000, "Botón 'Siguiente'");
        botonSiguiente.click();
        console.log("[Crear Tarea] Paso 5: Tipo de servicio seleccionado y botón 'Siguiente' pulsado.");

        // --- PASO 6: Seleccionar Feature/Proyecto específico ---

        // Espera fija de 2 segundos antes del Paso 6
        console.log("[Crear Tarea] Esperando 2 segundos antes del Paso 6...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log("[Crear Tarea] Paso 6: Esperando select de feature/proyecto...");
        const selectFeatureProyecto = await waitForElementMutation('select[name="data[seleccionarFeatureProyecto]"]', null, document, 10000);
        if (!selectFeatureProyecto) throw new Error("Select 'seleccionarFeatureProyecto' no encontrado.");

        // Buscar el contenedor Choices correcto (puede ser .choices o .dropdown)
        let featureChoicesRoot = selectFeatureProyecto.closest('.choices');
        if (!featureChoicesRoot) {
            featureChoicesRoot = selectFeatureProyecto.closest('.dropdown');
        }
        if (!featureChoicesRoot) {
            featureChoicesRoot = selectFeatureProyecto.parentElement;
        }
        if (!featureChoicesRoot) throw new Error("Contenedor Choices de feature/proyecto no encontrado.");

        console.log("[Crear Tarea] Paso 6: Contenedor encontrado:", featureChoicesRoot.className);

        await waitForElementReady(featureChoicesRoot, 10000, "Select de feature/proyecto");

        // Buscar el área clicable (puede tener diferentes selectores según la versión de Choices.js)
        let toggleFeatureArea = featureChoicesRoot.querySelector('.choices__inner');
        if (!toggleFeatureArea) {
            toggleFeatureArea = featureChoicesRoot.querySelector('.choices__list--single');
        }
        if (!toggleFeatureArea) {
            // Si es un dropdown de Semantic UI o similar
            toggleFeatureArea = featureChoicesRoot;
        }
        if (!toggleFeatureArea) throw new Error("Área clicable de feature/proyecto no encontrada.");

        console.log("[Crear Tarea] Paso 6: Área clicable encontrada:", toggleFeatureArea.className);

        console.log("[Crear Tarea] Paso 6: Intentando abrir dropdown de feature/proyecto...");
        
        // Función para verificar si el dropdown está abierto
        const isDropdownOpen = () => {
            // Verificar múltiples indicadores de que el dropdown está abierto
            const hasIsOpen = featureChoicesRoot.classList.contains('is-open');
            const hasActive = featureChoicesRoot.classList.contains('active');
            const hasVisible = featureChoicesRoot.classList.contains('visible');
            const dropdownList = featureChoicesRoot.querySelector('.choices__list--dropdown');
            const hasAriaExpanded = dropdownList && dropdownList.getAttribute('aria-expanded') === 'true';
            const hasInputCloned = featureChoicesRoot.querySelector('input.choices__input--cloned');
            
            return hasIsOpen || hasActive || hasVisible || hasAriaExpanded || hasInputCloned;
        };
        
        console.log("[Crear Tarea] Paso 6: Estado inicial - dropdown abierto:", isDropdownOpen());
        
        // Estrategia múltiple para abrir el dropdown
        const intentarAbrirDropdown = async () => {
            // Intento 1: Click simple en el área
            console.log("[Crear Tarea] Paso 6: Intento 1 - Click simple en área");
            toggleFeatureArea.click();
            await new Promise(resolve => setTimeout(resolve, 400));
            
            if (isDropdownOpen()) {
                console.log("[Crear Tarea] Paso 6: ✓ Abierto con click simple");
                return true;
            }
            
            // Intento 2: Click en el contenedor principal
            console.log("[Crear Tarea] Paso 6: Intento 2 - Click en contenedor");
            featureChoicesRoot.click();
            await new Promise(resolve => setTimeout(resolve, 400));
            
            if (isDropdownOpen()) {
                console.log("[Crear Tarea] Paso 6: ✓ Abierto con click en contenedor");
                return true;
            }
            
            // Intento 3: Focus + Click
            console.log("[Crear Tarea] Paso 6: Intento 3 - Focus + Click");
            toggleFeatureArea.focus();
            await new Promise(resolve => setTimeout(resolve, 100));
            toggleFeatureArea.click();
            await new Promise(resolve => setTimeout(resolve, 400));
            
            if (isDropdownOpen()) {
                console.log("[Crear Tarea] Paso 6: ✓ Abierto con focus + click");
                return true;
            }
            
            // Intento 4: Eventos de mouse completos
            console.log("[Crear Tarea] Paso 6: Intento 4 - Eventos de mouse completos");
            toggleFeatureArea.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            await new Promise(resolve => setTimeout(resolve, 50));
            toggleFeatureArea.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
            await new Promise(resolve => setTimeout(resolve, 50));
            toggleFeatureArea.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
            await new Promise(resolve => setTimeout(resolve, 400));
            
            if (isDropdownOpen()) {
                console.log("[Crear Tarea] Paso 6: ✓ Abierto con eventos de mouse");
                return true;
            }
            
            // Intento 5: Click en el select original
            console.log("[Crear Tarea] Paso 6: Intento 5 - Click en select original");
            selectFeatureProyecto.click();
            await new Promise(resolve => setTimeout(resolve, 400));
            
            if (isDropdownOpen()) {
                console.log("[Crear Tarea] Paso 6: ✓ Abierto con click en select");
                return true;
            }
            
            console.log("[Crear Tarea] Paso 6: ✗ Todos los intentos fallaron");
            return false;
        };

        const abierto = await intentarAbrirDropdown();
        if (!abierto) {
            console.error("[Crear Tarea] Paso 6: No se pudo abrir el dropdown después de múltiples intentos");
            console.log("[Crear Tarea] Paso 6: Clases del contenedor:", featureChoicesRoot.className);
            console.log("[Crear Tarea] Paso 6: HTML del contenedor:", featureChoicesRoot.outerHTML.substring(0, 300));
            throw new Error("No se pudo abrir el dropdown de feature/proyecto después de 5 intentos diferentes");
        }

        // Esperar con MutationObserver si aún no está completamente abierto
        if (!isDropdownOpen()) {
            console.log("[Crear Tarea] Paso 6: Esperando con MutationObserver...");
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    observer.disconnect();
                    console.error("[Crear Tarea] Paso 6: Timeout - dropdown no se abrió completamente");
                    reject(new Error("Dropdown de feature/proyecto no se abrió completamente"));
                }, 2000);

                const observer = new MutationObserver(() => {
                    if (isDropdownOpen()) {
                        clearTimeout(timeout);
                        observer.disconnect();
                        console.log("[Crear Tarea] Paso 6: Dropdown abierto (detectado por observer)");
                        resolve();
                    }
                });

                observer.observe(featureChoicesRoot, {
                    attributes: true,
                    childList: true,
                    subtree: true
                });

                // Verificar si ya está abierto
                if (isDropdownOpen()) {
                    clearTimeout(timeout);
                    observer.disconnect();
                    resolve();
                }
            });
        }

        // Esperar a que el dropdown se abra y el input de búsqueda aparezca
        console.log("[Crear Tarea] Paso 6: Esperando input de búsqueda...");
        let filterInput;
        try {
            filterInput = await waitForElementMutation('input.choices__input--cloned', null, featureChoicesRoot, 5000);
        } catch (error) {
            console.error("[Crear Tarea] Error esperando input de búsqueda:", error);
            console.log("[Crear Tarea] Estado del dropdown:", {
                isOpen: featureChoicesRoot.classList.contains('is-open'),
                classes: featureChoicesRoot.className,
                innerHTML: featureChoicesRoot.innerHTML.substring(0, 500)
            });
            throw new Error("Input de búsqueda en dropdown de feature/proyecto no encontrado después de 5 segundos.");
        }
        if (!filterInput) throw new Error("Input de búsqueda en dropdown de feature/proyecto no encontrado.");

        if (!tarea.codigoProyecto) throw new Error("Datos de 'codigoProyecto' (feature/proyecto) no encontrados en la tarea.");
        const featureTarget = tarea.codigoProyecto; 

        console.log(`[Crear Tarea] Paso 6: Filtrando por '${featureTarget}'...`);
        filterInput.focus();
        filterInput.value = featureTarget;
        filterInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        filterInput.dispatchEvent(new Event('keyup', { bubbles: true, cancelable: true }));
        
        // Esperar a que aparezca la opción filtrada
        console.log(`[Crear Tarea] Paso 6: Buscando opción '${featureTarget}'...`);
        let featureOption;
        try {
            featureOption = await waitForElementMutation('div.choices__item', featureTarget, featureChoicesRoot, 7000);
        } catch (error) {
            console.error(`[Crear Tarea] Error buscando opción '${featureTarget}':`, error);
            const allOptions = featureChoicesRoot.querySelectorAll('div.choices__item');
            console.log(`[Crear Tarea] Opciones disponibles (${allOptions.length}):`, 
                Array.from(allOptions).slice(0, 10).map(o => o.textContent.trim()));
            throw new Error(`Opción '${featureTarget}' no encontrada en feature/proyecto. Opciones disponibles: ${allOptions.length}`);
        }
        if (!featureOption) throw new Error(`Opción '${featureTarget}' no encontrada en feature/proyecto.`);

        featureOption.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
        featureOption.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
        featureOption.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

        // Esperar selección usando MutationObserver
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                observer.disconnect();
                reject(new Error("Timeout esperando selección de feature/proyecto"));
            }, 5000);

            const observer = new MutationObserver(() => {
                const selected = featureChoicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
                if (selected && selected.textContent && selected.textContent.includes(featureTarget)) {
                    clearTimeout(timeout);
                    observer.disconnect();
                    resolve();
                }
            });

            observer.observe(featureChoicesRoot, {
                childList: true,
                subtree: true,
                characterData: true
            });

            // Verificar si ya está seleccionado
            const selected = featureChoicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
            if (selected && selected.textContent && selected.textContent.includes(featureTarget)) {
                clearTimeout(timeout);
                observer.disconnect();
                resolve();
            }
        });

        console.log("[Crear Tarea] Paso 6: Feature/proyecto seleccionado. Esperando botón 'Seleccionar'...");
        const botonSeleccionarFeature = await waitForElementMutation('button[name="data[seleccionar]"]', 'Seleccionar', document, 10000);
        if (!botonSeleccionarFeature) throw new Error("Botón 'Seleccionar' (feature/proyecto) no encontrado.");

        await waitForElementReady(botonSeleccionarFeature, 10000, "Botón 'Seleccionar'");
        botonSeleccionarFeature.click();
        console.log("[Crear Tarea] Paso 6: Botón 'Seleccionar' pulsado.");

        // --- PASO 7: Selección de tecnología (no para Diseño) ---
        if (lastSelectedTaskType == 'Diseño') {
            console.log(`[Crear Tarea] Paso 7: Tipo de tarea '${lastSelectedTaskType}' no requiere tecnología específica. Saltando...`);
        } else {
            // Espera fija de 2 segundos antes del Paso 7
            console.log("[Crear Tarea] Esperando 2 segundos antes del Paso 7...");
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log("[Crear Tarea] Paso 7: Esperando select de tecnología...");
            const selectTechType = await waitForElementMutation('select[name="data[selectTechType]"]', null, document, 10000);
            if (!selectTechType) throw new Error("Select 'selectTechType' no encontrado.");

            const techChoicesRoot = selectTechType.closest('.choices') || selectTechType.closest('[data-type="select-one"]') || selectTechType.closest('.selection.dropdown');
            if (!techChoicesRoot) throw new Error("Contenedor Choices de tecnología no encontrado.");

            await waitForElementReady(techChoicesRoot, 10000, "Select de tecnología");

            const toggleTechArea = techChoicesRoot.querySelector('.selection.dropdown, .choices__inner, .choices__list--single');
            if (!toggleTechArea) throw new Error("Área clicable de tecnología no encontrada.");

            console.log("[Crear Tarea] Paso 7: Intentando abrir dropdown de tecnología...");
            console.log("[Crear Tarea] Paso 7: Estado inicial - is-open:", techChoicesRoot.classList.contains('is-open'));
            
            // Estrategia múltiple para abrir el dropdown
            const intentarAbrirDropdownTech = async () => {
                // Intento 1: Click simple
                console.log("[Crear Tarea] Paso 7: Intento 1 - Click simple");
                toggleTechArea.click();
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (techChoicesRoot.classList.contains('is-open')) {
                    console.log("[Crear Tarea] Paso 7: ✓ Abierto con click simple");
                    return true;
                }
                
                // Intento 2: Focus + Click
                console.log("[Crear Tarea] Paso 7: Intento 2 - Focus + Click");
                toggleTechArea.focus();
                await new Promise(resolve => setTimeout(resolve, 100));
                toggleTechArea.click();
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (techChoicesRoot.classList.contains('is-open')) {
                    console.log("[Crear Tarea] Paso 7: ✓ Abierto con focus + click");
                    return true;
                }
                
                // Intento 3: Eventos de mouse completos
                console.log("[Crear Tarea] Paso 7: Intento 3 - Eventos de mouse completos");
                toggleTechArea.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                await new Promise(resolve => setTimeout(resolve, 50));
                toggleTechArea.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
                await new Promise(resolve => setTimeout(resolve, 50));
                toggleTechArea.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (techChoicesRoot.classList.contains('is-open')) {
                    console.log("[Crear Tarea] Paso 7: ✓ Abierto con eventos de mouse");
                    return true;
                }
                
                // Intento 4: Click en el select original
                console.log("[Crear Tarea] Paso 7: Intento 4 - Click en select original");
                selectTechType.click();
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (techChoicesRoot.classList.contains('is-open')) {
                    console.log("[Crear Tarea] Paso 7: ✓ Abierto con click en select");
                    return true;
                }
                
                // Intento 5: Simular Enter
                console.log("[Crear Tarea] Paso 7: Intento 5 - Simular Enter");
                toggleTechArea.focus();
                toggleTechArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (techChoicesRoot.classList.contains('is-open')) {
                    console.log("[Crear Tarea] Paso 7: ✓ Abierto con Enter");
                    return true;
                }
                
                console.log("[Crear Tarea] Paso 7: ✗ Todos los intentos fallaron");
                return false;
            };

            const abiertoTech = await intentarAbrirDropdownTech();
            if (!abiertoTech) {
                console.error("[Crear Tarea] Paso 7: No se pudo abrir el dropdown después de múltiples intentos");
                console.log("[Crear Tarea] Paso 7: Clases del contenedor:", techChoicesRoot.className);
                console.log("[Crear Tarea] Paso 7: HTML del toggle:", toggleTechArea.outerHTML.substring(0, 200));
                throw new Error("No se pudo abrir el dropdown de tecnología después de 5 intentos diferentes");
            }

            // Verificar que el dropdown está abierto usando MutationObserver (solo si no está ya abierto)
            if (!techChoicesRoot.classList.contains('is-open')) {
                console.log("[Crear Tarea] Paso 7: Esperando con MutationObserver...");
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        observer.disconnect();
                        console.error("[Crear Tarea] Paso 7: Timeout - dropdown no se abrió");
                        reject(new Error("Dropdown de tecnología no se abrió después de varios intentos"));
                    }, 2000);

                    const observer = new MutationObserver(() => {
                        if (techChoicesRoot.classList.contains('is-open')) {
                            clearTimeout(timeout);
                            observer.disconnect();
                            console.log("[Crear Tarea] Paso 7: Dropdown abierto (detectado por observer)");
                            resolve();
                        }
                    });

                    observer.observe(techChoicesRoot, {
                        attributes: true,
                        attributeFilter: ['class']
                    });

                    // Verificar si ya está abierto
                    if (techChoicesRoot.classList.contains('is-open')) {
                        clearTimeout(timeout);
                        observer.disconnect();
                        resolve();
                    }
                });
            }

            if (!config.tecnologiaComun) throw new Error("Datos de 'tecnologiaComun' no encontrados en la config (necesaria para Construcción).");
            const tecnologiaObjetivo = config.tecnologiaComun;
            
            console.log(`[Crear Tarea] Paso 7: Buscando tecnología '${tecnologiaObjetivo}'...`);
            let techOption;
            try {
                techOption = await waitForElementMutation('div.choices__item', tecnologiaObjetivo, techChoicesRoot, 5000);
            } catch (error) {
                console.error(`[Crear Tarea] Error buscando tecnología '${tecnologiaObjetivo}':`, error);
                const allOptions = techChoicesRoot.querySelectorAll('div.choices__item');
                console.log(`[Crear Tarea] Tecnologías disponibles (${allOptions.length}):`, 
                    Array.from(allOptions).slice(0, 10).map(o => o.textContent.trim()));
                throw new Error(`Opción de tecnología '${tecnologiaObjetivo}' no encontrada. Opciones disponibles: ${allOptions.length}`);
            }
            if (!techOption) throw new Error(`Opción de tecnología '${tecnologiaObjetivo}' no encontrada.`);

            techOption.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            techOption.dispatchEvent(new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true }));
            techOption.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

            // Esperar selección usando MutationObserver
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    observer.disconnect();
                    reject(new Error("Timeout esperando selección de tecnología"));
                }, 5000);

                const observer = new MutationObserver(() => {
                    const selected = techChoicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
                    if (selected && selected.textContent && selected.textContent.includes(tecnologiaObjetivo)) {
                        clearTimeout(timeout);
                        observer.disconnect();
                        resolve();
                    }
                });

                observer.observe(techChoicesRoot, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });

                // Verificar si ya está seleccionado
                const selected = techChoicesRoot.querySelector('.choices__list--single .choices__item, .choices__list--single span');
                if (selected && selected.textContent && selected.textContent.includes(tecnologiaObjetivo)) {
                    clearTimeout(timeout);
                    observer.disconnect();
                    resolve();
                }
            });

            console.log("[Crear Tarea] Paso 7: Tecnología seleccionada. Esperando botón 'Siguiente'...");
            const botonTechSiguiente = await waitForElementMutation('button[name="data[submit]"]', 'Siguiente', document, 10000);
            if (!botonTechSiguiente) throw new Error("Botón 'Siguiente' tras seleccionar tecnología no encontrado.");

            await waitForElementReady(botonTechSiguiente, 10000, "Botón 'Siguiente' post-tecnología");
            botonTechSiguiente.click();
            console.log("[Crear Tarea] Paso 7: Botón 'Siguiente' tras tecnología pulsado.");
        }

        // --- PASO 8: Introducir horas/minutos e incurrir ---

        // Espera fija de 2 segundos antes del Paso 8
        console.log("[Crear Tarea] Esperando 2 segundos antes del Paso 8...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log("[Crear Tarea] Paso 8: Esperando input de horas...");
        const horasInput = await waitForElementMutation('input[name="data[hours]"]', null, document, 10000);
        if (!horasInput) throw new Error("Input 'data[hours]' no encontrado.");

        const minutosInput = await waitForElementMutation('input[name="data[minutes]"]', null, document, 10000);
        if (!minutosInput) throw new Error("Input 'data[minutes]' no encontrado.");

        if (tarea.horas === undefined || tarea.minutos === undefined) {
            throw new Error("Datos de 'horas'/'minutos' no encontrados en la tarea.");
        }
        
        const horasAsignar = String((tarea?.tareaCalc && tarea.tareaCalc.horas) || tarea.horas || '0');
        const minutosAsignar = String((tarea?.tareaCalc && tarea.tareaCalc.minutos) || tarea.minutos || '0');

        // Esperar a que los inputs estén listos
        await waitForElementReady(horasInput, 5000, "Input de horas");

        horasInput.focus();
        horasInput.value = horasAsignar;
        horasInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        horasInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        console.log(`[Crear Tarea] Paso 8: Horas asignadas (${horasAsignar}).`);

        // Pequeña pausa para estabilidad
        await new Promise(resolve => setTimeout(resolve, 300));

        minutosInput.focus();
        minutosInput.value = minutosAsignar;
        minutosInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        minutosInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        console.log(`[Crear Tarea] Paso 8: Minutos asignados (${minutosAsignar}).`);

        // Pequeña pausa para que se procesen los eventos
        await new Promise(resolve => setTimeout(resolve, 300));

        console.log("[Crear Tarea] Paso 8: Esperando botón 'Incurrir'...");
        const botonIncurrir = await waitForElementMutation('button[name="data[worklogBoton]"]', 'Incurrir', document, 10000);
        if (!botonIncurrir) throw new Error("Botón 'Incurrir' no encontrado.");

        await waitForElementReady(botonIncurrir, 10000, "Botón 'Incurrir'");
        botonIncurrir.click();
        console.log("[Crear Tarea] Paso 8: Botón 'Incurrir' pulsado.");
        
        requestPageToast("Tarea creada e incurrida correctamente.", 'success', 4000);

        return true; // Éxito

    } catch (error) {
        console.error(`[Crear Tarea] Error durante la creación:`, error);
        requestPageToast(`Error en creación: ${error.message}`, 'error', 5000);
        return false; // Fallo
    }
}

console.log("crearTarea.js loaded");