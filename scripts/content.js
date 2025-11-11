// scripts/content.js v2.5 (Orquestador con carga bajo demanda y Observador Persistente)

(function() {
    'use strict';

    if (window.__axetContentScriptLoaded_v2_5) {
        console.log("[Content Script] Orquestador v2.5 ya cargado. Omitiendo.");
        return;
    }
    window.__axetContentScriptLoaded_v2_5 = true; // Flag único para esta versión
    console.log("[Content Script] Orquestador v2.5 inicializando...");

    /**
     * Comprueba si los módulos de lógica están cargados.
     * Si no, solicita al background script que los inyecte.
     */
    async function ensureModulesAreLoaded() {
        if (window.__axetModulesLoaded === true) {
            return; // Ya cargados
        }

        console.log("[Content Script] Módulos no cargados. Solicitando inyección al background...");

        try {
            const response = await chrome.runtime.sendMessage({ action: "injectModules" });
            if (response && response.status === "ok") {
                console.log("[Content Script] Módulos inyectados por background.");
                await new Promise(resolve => setTimeout(resolve, 50)); // Breve espera
            } else {
                throw new Error(response?.message || "Error desconocido al inyectar módulos.");
            }
        } catch (error) {
            console.error("[Content Script] Error al solicitar inyección de módulos:", error);
            requestPageToast(`Error al cargar módulos: ${error.message}`, "error", 5000);
            throw error;
        }
    }


    // --- Carga Asíncrona de Configuración ---
    async function loadConfig() {
        try {
            const storage = await chrome.storage.sync.get({ configV2: null });
            const config = storage.configV2;
            if (!config || !config.proyectos || !config.planDiario || config.sdaComun === undefined || config.horasEsperadasDiarias === undefined) {
                 throw new Error("Configuración V2 inválida o no encontrada. Por favor, abre Opciones, configura (o importa tu CSV/JSON) y guarda.");
            }
            return config;
        } catch (error) {
            console.error("[Content Script] Error crítico al cargar la configuración:", error);
            requestPageToast(`Error al cargar configuración: ${error.message}`, 'error', 6000);
            return null;
        }
    }

    // --- Lógica de Automatización (Funciones Orquestadoras) ---
    // Estas funciones AHORA dependen de que los módulos estén cargados
    // (es decir, que ensureModulesAreLoaded() se haya completado).

    async function runIncurrirAutomation(config) {
        console.log("================ INICIO INCURRIDO HOY ================");
        const pageDate = getPageDate(); // de utils.js
        if (!pageDate) {
             if (document.querySelector('.calendario')) { requestPageToast("Ejecuta 'Incurrir Hoy' desde la pág. principal.", "info"); }
             else { throw new Error("No se pudo obtener la fecha. ¿Estás en la pág. principal de incurridos?"); }
             return;
        }
        const today = new Date(); pageDate.setHours(0,0,0,0); today.setHours(0,0,0,0);
        const pageDateStr = pageDate.toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];
        const diaSemanaHoy = today.getDay();

        if (diaSemanaHoy === 0 || diaSemanaHoy === 6) {
             requestPageToast("Hoy es fin de semana. No se puede incurrir.", "info"); return;
        }
        const horasCargadas = getHorasActuales(); // de utils.js

        if (pageDateStr === todayStr) {
            const tareasHoy = getTareasParaDia_v2_3(today, config);
            await incurrirTareas(today, tareasHoy, config); // de incurrir.js
        } else if (pageDate < today && horasCargadas === '00:00') {
            const tareasPasadas = getTareasParaDia_v2_3(pageDate, config);
            await incurrirTareas(pageDate, tareasPasadas, config);
        } else {
            const todayDDMMYYYY = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
            await navigateToDate(todayDDMMYYYY, getPageDate); // de navigation.js
            await sleep(1500); // de utils.js
            const tareasHoy = getTareasParaDia_v2_3(today, config);
            await incurrirTareas(today, tareasHoy, config);
        }
         console.log("================ FIN INCURRIDO HOY ================");
    }

    async function runBorrarAutomation(config, startDate, endDate) {
         console.log(`================ INICIO BORRADO (${startDate} a ${endDate}) ================`);
         await deleteTasksInRange(startDate, endDate); // de borrar.js
         console.log("================ FIN BORRADO ================");
    }

    async function runIncurrirRangeAutomation(config, startDateStr, endDateStr) {
        console.log(`================ INICIO INCURRIR RANGO (${startDateStr} a ${endDateStr}) ================`);
        requestPageToast(`Iniciando incurrido en rango ${startDateStr} a ${endDateStr}...`, 'info', 6000);
        const startDate = new Date(startDateStr + 'T00:00:00');
        const endDate = new Date(endDateStr + 'T00:00:00');
        let currentDate = new Date(startDate);
        try {
            while (currentDate <= endDate) {
                const dayDDMMYYYY = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()}`;
                const diaSemana = currentDate.getDay();
                if (diaSemana !== 0 && diaSemana !== 6) {
                    requestPageToast(`Incurriendo día: ${dayDDMMYYYY}`, 'info');
                    const currentPageDate = getPageDate();
                    const currentPageStr = currentPageDate ? currentPageDate.toISOString().split('T')[0] : null;
                    if (!currentPageStr || currentPageStr !== currentDate.toISOString().split('T')[0]) {
                        await navigateToDate(dayDDMMYYYY, getPageDate);
                        await sleep(2500);
                    } else {
                        await sleep(500);
                    }
                    const tareasDelDia = getTareasParaDia_v2_3(currentDate, config);
                    await incurrirTareas(currentDate, tareasDelDia, config);
                }
                currentDate.setDate(currentDate.getDate() + 1);
                await sleep(500);
            }
            requestPageToast("¡Incurrido de rango completado!", "success");
        } catch (error) {
             console.error("[Incurrir Rango] Error durante el proceso:", error);
             requestPageToast(`Error en incurrido de rango: ${error.message}`, 'error', 6000);
        }
    }


    // --- LISTENER PARA MENSAJES DEL POPUP ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'ping') {
            sendResponse({ status: 'ok' });
            return false; 
        }

        console.log("[Content Script] Mensaje de popup recibido:", request);

        (async () => {
            try {
                await ensureModulesAreLoaded();
                const config = await loadConfig();
                if (!config) throw new Error("Configuración no válida o no cargada.");

                switch (request.action) {
                    case "incurrirHoy":
                        await runIncurrirAutomation(config);
                        break;
                    case "deleteInRange":
                        await runBorrarAutomation(config, request.startDate, request.endDate);
                        break;
                    case "incurrirInRange":
                        await runIncurrirRangeAutomation(config, request.startDate, request.endDate);
                        break;
                    default:
                        throw new Error("Acción desconocida");
                }
                sendResponse({ status: "ok", action: request.action });
            } catch (error) {
                console.error(`[Content Script] Error al procesar acción '${request.action}':`, error);
                requestPageToast(`Error: ${error.message}`, 'error');
                sendResponse({ status: "error", message: error.message });
            }
        })();
        
        return true; // Respuesta asíncrona
    });

    // --- FUNCIÓN PARA INYECTAR BOTÓN (Estilo Clonado) ---
    function injectAutoIncurrirButton() {
        if (document.getElementById('autoIncurrirHoyBtn')) {
            return; // Ya existe, no hacer nada
        }
        try {
            const incurrirWrapper = document.querySelector('div.formio-component.incurrirBoton');
            const modificarWrapper = document.querySelector('div.formio-component.modificarBoton');
            const borrarWrapper = document.querySelector('div.formio-component.borrarBoton');
            if (!incurrirWrapper || !modificarWrapper || !borrarWrapper) {
                 return; // Aún no están todos los botones, el observador volverá a llamar
            }
            
            // *** NUEVO: Capturar las clases del botón "Incurrir" original ***
            const originalIncurrirButton = incurrirWrapper.querySelector('button.incurrirBoton');
            if (!originalIncurrirButton) return; // No se encontró el botón original
            
            // Copiar todas las clases del botón original
            // Ej: "btn btn-primary btn-md btn-block incurrirBoton"
            const originalClasses = originalIncurrirButton.className;

            const incurrirCol = incurrirWrapper.closest('div[class*="col-md-"]');
            const modificarCol = modificarWrapper.closest('div[class*="col-md-"]');
            const borrarCol = borrarWrapper.closest('div[class*="col-md-"]');
            const spacer1 = incurrirCol?.previousElementSibling;
            const spacer2 = borrarCol?.nextElementSibling;
            if (!incurrirCol || !modificarCol || !borrarCol || !spacer1 || !spacer2) {
                return; // Columnas no listas
            }

            console.log("[InjectBtn] Reajustando columnas (4x col-md-3) para inyectar botón...");
            
            // 4. --- NUEVA DISTRIBUCIÓN (4 x col-md-3) ---
            
            // Espaciadores: Ocultarlos
            spacer1.style.display = 'none';
            spacer2.style.display = 'none';
            
            // Función auxiliar para limpiar clases de columna y establecer col-md-3
            const setCol3 = (el) => {
                if (!el) return;
                // Eliminar clases col-md-X y col-md-offset-X
                const newClasses = (el.className || '').split(' ').filter(cls => 
                    !cls.startsWith('col-md-')
                );
                newClasses.push('col-md-3'); // Añadir la clase deseada
                el.className = newClasses.join(' ');
            };

            // Botones: Poner todos en col-md-3
            setCol3(incurrirCol);
            setCol3(modificarCol);
            setCol3(borrarCol);

            // console.log("[InjectBtn] Reajustando columnas para inyectar botón...");
            // spacer1.classList.remove('col-md-1'); spacer1.classList.add('col-md-1');
            // incurrirCol.classList.remove('col-md-3'); incurrirCol.classList.add('col-md-2');
            // modificarCol.classList.remove('col-md-3'); modificarCol.classList.add('col-md-2');
            // borrarCol.classList.remove('col-md-3'); borrarCol.classList.add('col-md-2');
            // spacer2.classList.remove('col-md-1'); spacer2.classList.add('col-md-1');

            const newCol = document.createElement('div');
            //newCol.className = 'col-md-2 col-md-offset-0 col-md-push-0 col-md-pull-0';
            newCol.className = 'col-md-3 col-md-offset-0 col-md-push-0 col-md-pull-0';

            // *** ACTUALIZADO: Usar las clases copiadas ***
            // Le quitamos 'incurrirBoton' para evitar conflictos y añadimos una nuestra
            const newButtonClasses = originalClasses.replace('incurrirBoton', '') + ' autoIncurrirBoton';

            newCol.innerHTML = `
                <div ref="component" class="form-group has-feedback formio-component formio-component-button formio-component-autoIncurrir" id="autoIncurrirBtnWrapper">
                  <button lang="en" class="${newButtonClasses}" type="button" ref="button" id="autoIncurrirHoyBtn">
                    <span class="fa fa-rocket"></span>&nbsp;
                    Auto Incurrir Hoy
                  </button>
                </div>`;
            incurrirCol.parentElement.insertBefore(newCol, incurrirCol);

            const newButton = newCol.querySelector('#autoIncurrirHoyBtn');
            if (newButton) {
                newButton.addEventListener('click', async () => {
                    console.log('[AutoIncurrirBtn] "Auto Incurrir Hoy" pulsado.');
                    newButton.disabled = true;
                    newButton.innerHTML = '<span class="fa fa-spinner fa-spin"></span>&nbsp; Cargando...';
                    try {
                        await ensureModulesAreLoaded();
                        newButton.innerHTML = '<span class="fa fa-spinner fa-spin"></span>&nbsp; Incurriendo...';
                        const config = await loadConfig();
                        if (!config) throw new Error("Configuración no válida o no cargada.");
                        await runIncurrirAutomation(config);
                    } catch (error) {
                        console.error("[AutoIncurrirBtn] Error:", error);
                        if(window.requestPageToast) requestPageToast(`Error: ${error.message}`, 'error');
                    } finally {
                        newButton.disabled = false;
                        newButton.innerHTML = '<span class="fa fa-rocket"></span>&nbsp; Auto Incurrir Hoy';
                    }
                });
                console.log("[InjectBtn] ¡Botón 'Auto Incurrir Hoy' inyectado y listo!");
            }
        } catch (error) {
            console.error("[InjectBtn] Error al inyectar el botón:", error);
        }
    }

    // --- INYECCIÓN DE BOTÓN (LÓGICA MEJORADA) ---

    // 1. Definir el observador
    const persistentObserver = new MutationObserver((mutationsList, obs) => {
        // Comprobar si el botón ancla existe
        const incurrirButtonWrapper = document.querySelector('div.formio-component.incurrirBoton');
        // Comprobar si nuestro botón ya existe
        const autoIncurrirButton = document.getElementById('autoIncurrirHoyBtn');

        // CONDICIÓN: Si el ancla existe Y nuestro botón NO existe...
        if (incurrirButtonWrapper && !autoIncurrirButton) {
            // ...entonces inyectamos el botón.
            // console.log("[Content Script] Observador detectó ancla sin botón. Inyectando...");
            injectAutoIncurrirButton();
        }
        
        // NO desconectar el observador. Queremos que siga vigilando
        // por si la UI se re-renderiza y borra nuestro botón.
    });

    // 2. Empezar a observar DESPUÉS de que la carga inicial del DOM esté completa
    // Esto evita ejecutar la lógica 1000 veces mientras la página se construye.
    try {
        if (document.readyState === 'loading') {
            // La página aún está cargando. Esperar al evento DOMContentLoaded.
            document.addEventListener('DOMContentLoaded', () => {
                persistentObserver.observe(document.body, { childList: true, subtree: true });
                console.log("[Content Script] MutationObserver persistente iniciado (post-DOMContentLoaded).");
                // Intentar una inyección inmediata por si acaso
                injectAutoIncurrirButton();
            });
        } else {
            // El DOM ya está cargado, empezar a observar de inmediato.
            persistentObserver.observe(document.body, { childList: true, subtree: true });
            console.log("[Content Script] MutationObserver persistente iniciado (DOM ya cargado).");
            // E intentar una inyección inmediata
            injectAutoIncurrirButton();
        }
    } catch (e) {
        console.error("[Content Script] No se pudo iniciar MutationObserver:", e);
    }

    console.log("[Content Script] Orquestador v2.5 cargado y observando.");

})(); // Fin de la IIFE