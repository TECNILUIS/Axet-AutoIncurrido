// scripts/background.js

console.log("Background service worker iniciado.");

// Lista de módulos principales a inyectar bajo demanda
const MODULES_TO_INJECT = [
    'scripts/shared/utils.js',
    'scripts/shared/navigation.js',
    'scripts/modules/incurrir.js',
    'scripts/modules/borrar.js',
    'scripts/modules/crearTarea.js' 
];

/**
 * Inyecta los scripts de módulos en una pestaña.
 * @param {number} tabId - ID de la pestaña.
 */
async function injectModules(tabId) {
    console.log(`[Background] Solicitud para inyectar módulos en tab ${tabId}`);
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: MODULES_TO_INJECT
        });
        
        // IMPORTANTE: Después de inyectar los archivos, inyectamos un script
        // para establecer el flag que indica que los módulos están listos.
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                window.__axetModulesLoaded = true;
                console.log("[Background] Flag __axetModulesLoaded establecido en true.");
            }
        });

        console.log(`[Background] Módulos inyectados correctamente en tab ${tabId}`);
        return { status: "ok" };
    } catch (error) {
        console.error(`[Background] Error al inyectar módulos en tab ${tabId}:`, error);
        return { status: "error", message: error.message };
    }
}

// Escuchar mensajes desde content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Solo nos interesa el mensaje 'injectModules'
    if (request.action === 'injectModules') {
        if (sender.tab && sender.tab.id) {
            // Inyectar los módulos y responder asíncronamente
            injectModules(sender.tab.id).then(sendResponse);
            return true; // Indicar respuesta asíncrona
        } else {
            console.error("[Background] Mensaje 'injectModules' recibido sin ID de pestaña.");
            sendResponse({ status: "error", message: "No tab ID" });
        }
    }
    
    // Devolver undefined o false para otros mensajes (respuesta síncrona)
    return false;
});