// scripts/content.js

(async function() {
    'use strict';

    // Envolvemos todo en un bloque try/catch principal
    try {
        // --- CARGA DE CONFIGURACIÓN ---
        // Usamos await para asegurarnos de tener la config antes de continuar
        const storage = await chrome.storage.sync.get({ configV2: null });
        const config = storage.configV2;

        if (!config || !config.proyectos) {
            // Usamos requestPageToast si está disponible, si no, alert
            const msg = "Error: No se encontró configuración V2 válida. Abre las Opciones y guarda.";
            console.error('[Content Script] Configuración V2 inválida o no encontrada:', storage);
            if (typeof requestPageToast === 'function') requestPageToast(msg, 'error');
            else alert(msg);
            return; // Detener ejecución
        }
        console.log("[Content Script] Configuración V2 cargada:", config);


        // --- FUNCIÓN PRINCIPAL DE EJECUCIÓN (llamada al final) ---
        async function runAutomation() {
            // Asegurarse de que las funciones necesarias estén cargadas
             if (typeof getPageDate !== 'function' || typeof findElementByText !== 'function' ||
                 typeof incurrirTareas !== 'function' || typeof getTareasParaDia_v2_3 !== 'function' ||
                 typeof navigateToDate !== 'function') {
                 throw new Error("Funciones esenciales no cargadas. Revisa el orden de inyección.");
             }

            console.log("================ INICIO DEL SCRIPT ================");

            const pageDate = getPageDate();
            if (!pageDate) {
                 // Si no podemos obtener la fecha, podríamos estar en una página incorrecta
                 if (document.querySelector('.calendario')) {
                      console.log("[Content Script] Parece que estamos en la vista de calendario. No se puede iniciar desde aquí.");
                      if (typeof requestPageToast === 'function') requestPageToast("Ejecuta la extensión desde la página principal de incurridos.", "info");
                 } else {
                      throw new Error("No se pudo obtener la fecha de la página. Asegúrate de estar en la página principal.");
                 }
                 return;
             }

            const today = new Date();
            // Normalizar a medianoche para comparación
            pageDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            const pageDateStr = pageDate.toISOString().split('T')[0];
            const todayStr = today.toISOString().split('T')[0];

            // Comprobar si es fin de semana ANTES de cualquier acción
            const diaSemanaHoy = today.getDay();
            if (diaSemanaHoy === 0 || diaSemanaHoy === 6) {
                 if (typeof requestPageToast === 'function') requestPageToast("Hoy es fin de semana, no se incurrirán tareas.", "info");
                 console.log("[Content Script] Es fin de semana.");
                 return;
            }

            const horasCargadas = getHorasActuales(); // Ya devuelve '00:00' si no encuentra

            if (pageDateStr === todayStr) {
                // Caso 1: La fecha es hoy. Incurrimos normal.
                console.log("[Content Script] La fecha es la actual. Calculando tareas para hoy...");
                const tareasHoy = getTareasParaDia_v2_3(today, config);
                await incurrirTareas(today, tareasHoy);
            } else if (pageDate < today && horasCargadas === '00:00') {
                // Caso 2: Fecha anterior Y 0 horas. Incurrimos en esa fecha (si hay reglas para ella).
                 console.log(`[Content Script] Fecha anterior (${pageDateStr}) sin horas. Calculando tareas para esa fecha...`);
                 const tareasPasadas = getTareasParaDia_v2_3(pageDate, config);
                 await incurrirTareas(pageDate, tareasPasadas);
            } else {
                // Caso 3: Fecha anterior y ya hay horas O fecha futura. Corregimos a hoy.
                console.log(`[Content Script] La fecha (${pageDateStr}) no es la actual o ya tiene horas. Navegando a hoy (${todayStr})...`);
                 const todayDDMMYYYY = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
                 await navigateToDate(todayDDMMYYYY, getPageDate); // Le pasamos getPageDate
                 await sleep(1500); // Espera adicional post-navegación
                 console.log("[Content Script] Fecha corregida. Calculando tareas para hoy...");
                 const tareasHoy = getTareasParaDia_v2_3(today, config);
                 await incurrirTareas(today, tareasHoy);
            }
             console.log("================ FIN DEL SCRIPT ================");
        }

        // --- LISTENER PARA MENSAJES DEL POPUP ---
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log("[Content Script] Mensaje recibido:", request);
            if (request.action === "deleteInRange") {
                // Asegurarse de que la función de borrado esté disponible
                if (typeof deleteTasksInRange === 'function') {
                    deleteTasksInRange(request.startDate, request.endDate)
                        .then(() => sendResponse({ status: "Borrado iniciado" }))
                        .catch((error) => {
                            console.error("[Content Script] Error en deleteTasksInRange:", error);
                            if(typeof requestPageToast === 'function') requestPageToast(`Error en borrado: ${error.message}`, 'error');
                            sendResponse({ status: "Error", message: error.message });
                        });
                    return true; // Respuesta asíncrona
                } else {
                    console.error("[Content Script] La función deleteTasksInRange no está definida.");
                     if(typeof requestPageToast === 'function') requestPageToast("Error interno: Función de borrado no encontrada.", 'error');
                     sendResponse({ status: "Error", message: "Función de borrado no encontrada." });
                     return false;
                }
            } else if (request.action === "incurrirHoy") { // Podríamos añadir una acción explícita si quisiéramos
                 runAutomation()
                     .then(() => sendResponse({ status: "Incurrido iniciado"}))
                     .catch(error => {
                         console.error("[Content Script] Error en runAutomation:", error);
                          if(typeof requestPageToast === 'function') requestPageToast(`Error al incurrir: ${error.message}`, 'error');
                          sendResponse({ status: "Error", message: error.message });
                     });
                 return true; // Respuesta asíncrona
            }
            return false; // No manejamos este mensaje
        });

        // --- PUNTO DE ENTRADA ---
        // Podríamos decidir si ejecutar runAutomation automáticamente al cargar
        // o esperar una señal del popup. Por ahora, NO lo ejecutamos auto.
        console.log("[Content Script] Cargado y listo. Esperando acción desde el popup.");
        // await runAutomation(); // Descomentar si quieres que se ejecute solo al hacer clic en el popup

    } catch (error) {
        // Captura errores durante la carga inicial o cualquier error no capturado dentro de las funciones async
        console.error("Extensión: Ha ocurrido un error fatal en el script principal.", error);
        // Intentar mostrar toast si la función está disponible
         try {
             if (typeof requestPageToast === 'function') {
                 requestPageToast(`Error fatal: ${error.message}`, "error");
             } else {
                 alert(`Error fatal en la extensión: ${error.message}.`);
             }
         } catch(e) {
             alert(`Error fatal en la extensión: ${error.message}.`);
         }
    }

    // Definición global de requestPageToast (si no se carga desde shared/toast.js)
    // Es mejor si está en shared/toast.js y ese script se inyecta primero.
    // Si toast.js se inyecta, esta definición no es necesaria aquí.
    if (typeof window.requestPageToast === 'undefined') {
         window.requestPageToast = function (message, type = 'info', duration = 4000) {
             console.warn('[TOAST FALLBACK]', `(${type}) ${message}`);
             // alert(`(${type}) ${message}`); // Evitar alert si es posible
         };
    }

})(); // Cierre final del script