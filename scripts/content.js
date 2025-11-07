// scripts/content.js v2.3 (Refactorizado + Incurrir Rango)

// Envolvemos todo en una IIFE (Immediately Invoked Function Expression)
// para evitar contaminar el scope global MÁS de lo necesario
(function() {
    'use strict';

    if (window.__axetContentScriptLoaded) {
        console.log("[Content Script] Ya cargado anteriormente. Se omite reinyección duplicada.");
        return;
    }
    window.__axetContentScriptLoaded = true;
    console.log("[Content Script] Inicializando...");

    // --- NUEVO: Estado global para el debug de creación de tareas ---
    // (Se reinicia cada vez que content.js se recarga/inyecta)
    let debugTaskCreationStep = 0;
    // --- FIN NUEVO ---

    // --- Definición Global de requestPageToast ---
    // (Necesaria aquí si toast.js no se inyecta o no define una función global)
    // Es mejor si toast.js se inyecta y define window.showToast globalmente.
    if (typeof window.requestPageToast === 'undefined') {
        window.requestPageToast = function (message, type = 'info', duration = 4000) {
            // Intenta usar la función global si existe (inyectada por toast.js)
            if (typeof window.showToast === 'function') {
                window.showToast(message, type, duration);
            } else {
                // Fallback si showToast no está disponible
                console.warn(`[TOAST FALLBACK] (${type}, ${duration}ms): ${message}`);
                // alert(`(${type}) ${message}`); // Evitar alert si es posible
            }
        };
        console.log("[Content Script] Función requestPageToast definida (puede usar fallback).");
    }

    // --- Carga Asíncrona de Configuración ---
    async function loadConfig() {
        try {
            // Usar la clave final 'configV2'
            const storage = await chrome.storage.sync.get({ configV2: null });
            const config = storage.configV2;

            // Validar la estructura esperada para v2.3
            if (!config || !config.proyectos || !config.planDiario || config.sdaComun === undefined || config.horasEsperadasDiarias === undefined) {
                 // Podríamos intentar migrar de claves antiguas aquí si quisiéramos
                 console.error("[Content Script] Configuración V2 (configV2) inválida o no encontrada en storage:", storage);
                 throw new Error("Configuración V2 inválida o no encontrada. Por favor, abre Opciones, configura (o importa tu CSV/JSON) y guarda.");
            }
            console.log("[Content Script] Configuración V2 cargada:", config);
            return config;
        } catch (error) {
            console.error("[Content Script] Error crítico al cargar la configuración:", error);
            // Asegurarse de que requestPageToast esté definido antes de usarlo
            if (typeof requestPageToast === 'function') {
                 requestPageToast(`Error al cargar configuración: ${error.message}`, 'error', 6000);
            } else {
                 alert(`Error al cargar configuración: ${error.message}`);
            }
            return null; // Devolver null para indicar fallo
        }
    }


    // --- Orquestador Principal para INCURRIR HOY ---
    async function runIncurrirAutomation(config) {
         // Verificar dependencias de los módulos inyectados
         if (typeof getPageDate !== 'function' || typeof findElementByText !== 'function' ||
             typeof getHorasActuales !== 'function' || typeof navigateToDate !== 'function' ||
             typeof getTareasParaDia_v2_3 !== 'function' || typeof incurrirTareas !== 'function' ||
             typeof sleep !== 'function') {
             throw new Error("Faltan funciones esenciales (incurrir). Revisa la inyección de scripts.");
         }
        console.log("================ INICIO INCURRIDO HOY ================");
        const pageDate = getPageDate(); // de utils.js
        if (!pageDate) {
             if (document.querySelector('.calendario')) { // Estamos en vista calendario
                 requestPageToast("Ejecuta 'Incurrir Hoy' desde la pág. principal.", "info");
             } else {
                 throw new Error("No se pudo obtener la fecha. ¿Estás en la pág. principal de incurridos?");
             }
             return; // Salir si no estamos en la página correcta
         }
        const today = new Date(); pageDate.setHours(0,0,0,0); today.setHours(0,0,0,0);
        const pageDateStr = pageDate.toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];
        const diaSemanaHoy = today.getDay(); // 0=Dom, 6=Sab

        // Comprobar fin de semana
        if (diaSemanaHoy === 0 || diaSemanaHoy === 6) {
             requestPageToast("Hoy es fin de semana. No se puede incurrir.", "info"); return;
        }
        const horasCargadas = getHorasActuales(); // de utils.js

        if (pageDateStr === todayStr) {
            console.log("[Incurrir Hoy] Fecha actual. Calculando tareas...");
            const tareasHoy = getTareasParaDia_v2_3(today, config); // ¡Llamada al módulo incurrir.js!
            await incurrirTareas(today, tareasHoy, config); // ¡Llamada al módulo incurrir.js!
        } else if (pageDate < today && horasCargadas === '00:00') {
            // Incurrir en fecha pasada si no tiene horas
            console.log(`[Incurrir Hoy] Fecha anterior (${pageDateStr}) sin horas. Calculando...`);
            const tareasPasadas = getTareasParaDia_v2_3(pageDate, config);
            await incurrirTareas(pageDate, tareasPasadas, config);
        } else {
            // Corregir fecha a hoy
            console.log(`[Incurrir Hoy] Fecha incorrecta (${pageDateStr}). Navegando a hoy (${todayStr})...`);
            const todayDDMMYYYY = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
            await navigateToDate(todayDDMMYYYY, getPageDate); // ¡Llamada al módulo navigation.js!
            await sleep(1500); // Espera post-navegación
            console.log("[Incurrir Hoy] Fecha corregida. Calculando tareas para hoy...");
            const tareasHoy = getTareasParaDia_v2_3(today, config);
            await incurrirTareas(today, tareasHoy, config);
        }
         console.log("================ FIN INCURRIDO HOY ================");
    }

    // --- Orquestador Principal para BORRAR RANGO ---
    async function runBorrarAutomation(config, startDate, endDate) {
         // Verificar dependencias
         if (typeof deleteTasksInRange !== 'function') {
             throw new Error("Falta la función deleteTasksInRange (módulo borrar.js). Revisa inyección.");
         }
         console.log(`================ INICIO BORRADO (${startDate} a ${endDate}) ================`);
         // Pasar también la config, aunque borrar.js actualmente no la usa directamente
         await deleteTasksInRange(startDate, endDate); // ¡Llamada al módulo borrar.js!
         console.log("================ FIN BORRADO ================");
    }


    // --- Orquestador Principal para INCURRIR RANGO ---
    async function runIncurrirRangeAutomation(config, startDateStr, endDateStr) {
        // Verificar dependencias
         if (typeof getPageDate !== 'function' || typeof navigateToDate !== 'function' ||
             typeof getTareasParaDia_v2_3 !== 'function' || typeof incurrirTareas !== 'function' ||
             typeof sleep !== 'function' || typeof requestPageToast !== 'function') {
             throw new Error("Faltan funciones esenciales (incurrir en rango). Revisa inyección.");
         }
        console.log(`================ INICIO INCURRIR RANGO (${startDateStr} a ${endDateStr}) ================`);
        requestPageToast(`Iniciando incurrido en rango ${startDateStr} a ${endDateStr}...`, 'info', 6000);

        const startDate = new Date(startDateStr + 'T00:00:00');
        const endDate = new Date(endDateStr + 'T00:00:00');
        let currentDate = new Date(startDate);

        try {
            while (currentDate <= endDate) {
                const dayDDMMYYYY = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()}`;
                const dayYYYYMMDD = currentDate.toISOString().split('T')[0];
                const diaSemana = currentDate.getDay(); // 0=Dom, 6=Sab

                console.log(`[Incurrir Rango] --- Procesando ${dayYYYYMMDD} ---`);

                // Saltar fines de semana
                if (diaSemana === 0 || diaSemana === 6) {
                    console.log(`[Incurrir Rango] Saltando fin de semana: ${dayDDMMYYYY}`);
                } else {
                    // Solo procesar días laborables
                    requestPageToast(`Incurriendo día: ${dayDDMMYYYY}`, 'info');

                    // 1. Navegar al día (si no estamos ya)
                    const currentPageDate = getPageDate();
                    const currentPageStr = currentPageDate ? currentPageDate.toISOString().split('T')[0] : null;

                    if (!currentPageStr || currentPageStr !== dayYYYYMMDD) {
                        console.log(`[Incurrir Rango] Navegando a ${dayDDMMYYYY}...`);
                        await navigateToDate(dayDDMMYYYY, getPageDate); // navigation.js
                        await sleep(2500); // Espera post-navegación
                    } else {
                        console.log(`[Incurrir Rango] Ya estamos en ${dayDDMMYYYY}.`);
                        await sleep(500); // Pequeña pausa
                    }

                    // 2. Calcular e incurrir tareas para ESE día
                    console.log(`[Incurrir Rango] Calculando tareas para ${dayDDMMYYYY}...`);
                    // *** ¡¡AQUÍ NECESITAMOS LA FUNCIÓN getTareasParaDia_v2_3 IMPLEMENTADA!! ***
                    const tareasDelDia = getTareasParaDia_v2_3(currentDate, config); // incurrir.js
                    await incurrirTareas(currentDate, tareasDelDia); // incurrir.js
                } // Fin if día laborable

                // 3. Pasar al siguiente día
                currentDate.setDate(currentDate.getDate() + 1);
                await sleep(500); // Pausa breve entre días

            } // Fin while

            requestPageToast("¡Incurrido de rango completado!", "success");
            console.log("================ FIN INCURRIR RANGO ================");

        } catch (error) {
             console.error("[Incurrir Rango] Error durante el proceso:", error);
             requestPageToast(`Error en incurrido de rango: ${error.message}`, 'error', 6000);
        }
    }


    // --- LISTENER PARA MENSAJES DEL POPUP ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'ping') {
            sendResponse({ status: 'ok' });
            return false; // Respuesta síncrona
        }

        console.log("[Content Script] Mensaje recibido:", request);

        // Cargamos la configuración ANTES de procesar cualquier acción
        // Usamos .then/.catch aquí para manejar la asincronía del listener
        loadConfig().then(config => {
            if (!config) {
                 // loadConfig ya mostró el error
                 sendResponse({ status: "Error", message: "Configuración no válida o no cargada." });
                 return; // No continuar si no hay config
            }

            // Usar un switch para manejar las acciones
            switch (request.action) {
                case "incurrirHoy":
                    runIncurrirAutomation(config)
                        .then(() => sendResponse({ status: "Incurrido 'Hoy' iniciado"}))
                        .catch(error => {
                            console.error("[Content Script] Error en runIncurrirAutomation:", error);
                            requestPageToast(`Error al incurrir hoy: ${error.message}`, 'error');
                            sendResponse({ status: "Error", message: error.message });
                        });
                    break; // Fin incurrirHoy

                case "deleteInRange":
                    runBorrarAutomation(config, request.startDate, request.endDate)
                        .then(() => sendResponse({ status: "Borrado iniciado" }))
                        .catch((error) => {
                            console.error("[Content Script] Error en runBorrarAutomation:", error);
                            requestPageToast(`Error en borrado: ${error.message}`, 'error');
                            sendResponse({ status: "Error", message: error.message });
                        });
                    break; // Fin deleteInRange

                case "incurrirInRange":
                    runIncurrirRangeAutomation(config, request.startDate, request.endDate)
                        .then(() => sendResponse({ status: "Incurrido en rango iniciado" }))
                        .catch((error) => {
                            console.error("[Content Script] Error en runIncurrirRangeAutomation:", error);
                            requestPageToast(`Error incurriendo rango: ${error.message}`, 'error');
                            sendResponse({ status: "Error", message: error.message });
                        });
                    break; // Fin incurrirInRange

                case "debugNextStep":
                    if (typeof executeTaskCreationStep === 'function') {
                        // Pasamos el paso actual, la función devuelve el *siguiente* paso
                        executeTaskCreationStep(debugTaskCreationStep + 1, config) // +1 para ejecutar el siguiente paso
                            .then((nextStep) => {
                                debugTaskCreationStep = nextStep > 0 ? nextStep - 1 : 0; // Mantener el último paso completado
                                sendResponse({ status: "Paso debug ejecutado", nextStep: nextStep });
                            })
                            .catch(error => {
                                console.error("[Content Script] Error en executeTaskCreationStep:", error);
                                requestPageToast(`Error debug: ${error.message}`, 'error');
                                sendResponse({ status: "Error debug", message: error.message });
                                debugTaskCreationStep = 0; // Reiniciar en error
                            });
                    } else {
                         console.error("[Content Script] executeTaskCreationStep no está definida.");
                         sendResponse({ status: "Error", message: "Función debug no encontrada." });
                    }
                    break;

                default:
                    console.warn("[Content Script] Acción desconocida recibida:", request.action);
                    sendResponse({ status: "Acción desconocida" });
                    return false; // Indicar que no manejamos este mensaje síncronamente
            }
        }).catch(error => {
             // Error durante loadConfig
             console.error("[Content Script] Fallo crítico al cargar config antes de procesar mensaje:", error);
             sendResponse({ status: "Error", message: "Fallo al cargar configuración." });
        });

        return true; // Indicar que la respuesta siempre será asíncrona
    });

    console.log("[Content Script] Cargado y listo v2.3.");

})(); // Fin de la IIFE