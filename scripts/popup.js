// scripts/popup.js

const SCRIPTS_TO_INJECT = [
    'scripts/shared/toast.js',    // Funciones de notificación
    'scripts/shared/utils.js',    // Helpers básicos (sleep, findElement, etc.)
    'scripts/shared/navigation.js',// Lógica de cambio de fecha (usa utils, injector)
    'scripts/modules/incurrir.js', // Lógica de incurrir (usa utils, toast)
    'scripts/modules/borrar.js',   // Lógica de borrado (usa utils, toast, navigation)
    'scripts/content.js'          // Orquestador principal y listener de mensajes
];

// Función para inyectar scripts secuencialmente
async function injectScripts(tabId, scriptFiles) {
    for (const file of scriptFiles) {
        try {
            console.log(`[Popup] Inyectando ${file}...`);
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: [file]
            });
            console.log(`[Popup] ${file} inyectado con éxito.`);
        } catch (error) {
            console.error(`[Popup] Error al inyectar ${file}:`, error);
            alert(`Error crítico al cargar la extensión (${file}). Recarga la página y la extensión.`);
            throw error; // Detener si un script esencial falla
        }
    }
}

// Listener para el botón "Incurrir Tareas Hoy"
document.getElementById('runScript').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab.url && !tab.url.startsWith('chrome://') && tab.url.startsWith('http')) {
            await injectScripts(tab.id, SCRIPTS_TO_INJECT);
            // Una vez inyectados, enviamos el mensaje para iniciar la acción
            chrome.tabs.sendMessage(tab.id, { action: "incurrirHoy" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("[Popup] Error enviando mensaje 'incurrirHoy':", chrome.runtime.lastError.message);
                    // Podría ser que el content script no se cargó bien
                } else {
                    console.log("[Popup] Mensaje 'incurrirHoy' enviado, respuesta:", response);
                }
            });
        } else {
            alert("No se puede ejecutar la acción en esta pestaña.");
        }
    } catch (error) {
        console.error("[Popup] Error en el botón 'Incurrir':", error);
    }
});


// Listener para el botón "Borrar Imputaciones"
document.getElementById('deleteScript').addEventListener('click', async () => {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;

    if (!fechaInicio || !fechaFin) { alert("Selecciona fecha inicio y fin."); return; }
    const startDate = new Date(fechaInicio);
    const endDate = new Date(fechaFin);
    if (endDate < startDate) { alert("Fecha fin anterior a inicio."); return; }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab.url && !tab.url.startsWith('chrome://') && tab.url.startsWith('http')) {
            // Asegurarse de que los scripts estén inyectados antes de enviar el mensaje
            // Podríamos verificar si ya están inyectados, pero por simplicidad, los re-inyectamos
            // (executeScript maneja bien la re-inyección si el script ya existe)
            await injectScripts(tab.id, SCRIPTS_TO_INJECT);

            chrome.tabs.sendMessage(tab.id, {
                action: "deleteInRange",
                startDate: startDateStr,
                endDate: endDateStr
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("[Popup] Error enviando mensaje 'deleteInRange':", chrome.runtime.lastError.message);
                } else {
                    console.log("[Popup] Mensaje 'deleteInRange' enviado, respuesta:", response);
                }
            });
        } else {
            alert("No se puede ejecutar la acción en esta pestaña.");
        }
    } catch (error) {
        console.error("[Popup] Error en el botón 'Borrar':", error);
    }
});