// scripts/popup.js (Simplificado)

// --- Initialize Flatpickr ---
document.addEventListener('DOMContentLoaded', function() {
    // --- LÓGICA PARA RESTRINGIR FECHAS (Quincena + No Futuro) ---
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche para comparaciones
    const currentDayOfMonth = today.getDate();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();

    let minSelectableDate = null;
    let maxSelectableDate = null;

    if (currentDayOfMonth <= 15) {
        minSelectableDate = new Date(currentYear, currentMonth, 1);
        maxSelectableDate = today;
    } else {
        minSelectableDate = new Date(currentYear, currentMonth, 16);
        maxSelectableDate = today;
    }
    // --- FIN LÓGICA RESTRICCIÓN ---


    const fechaRangoInput = document.getElementById('fechaRango');

    // Opciones para Rango, Inline, Español y Fechas Restringidas
    const flatpickrRangeOptions = {
        mode: "range",
        dateFormat: "Y-m-d",
        altInput: false,
        altFormat: "d/m/Y",
        inline: true,
        showMonths: 1,
        locale: "es",
        minDate: minSelectableDate,
        maxDate: maxSelectableDate,
        monthSelectorType: "static"
    };

    flatpickr(fechaRangoInput, flatpickrRangeOptions);
    console.log("[Popup] Flatpickr inicializado.");
});
// --- End Flatpickr Initialization ---


// --- Extension Logic ---

/**
 * Helper to send a message to the content script using Promises.
 * @param {number} tabId
 * @param {object} message
 * @returns {Promise<any>}
 */
function sendTabMessage(tabId, message) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
                // Si falla la conexión, es probable que la página de Axet se esté
                // recargando o sea una página interna de Chrome.
                console.warn(`[Popup] No se pudo enviar mensaje (quizás recargando): ${chrome.runtime.lastError.message}`);
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

// --- Botón "Incurrir Tareas Hoy" ---
document.getElementById('runScript').addEventListener('click', async () => {
    console.log("[Popup] Botón 'Incurrir Hoy' pulsado.");
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab?.id && tab.url && tab.url.startsWith('http')) {
            // Ya no necesitamos 'ensureContentScripts'. Solo enviamos el mensaje.
            // content.js, que ya está en la página, lo recibirá.
            const response = await sendTabMessage(tab.id, { action: "incurrirHoy" });
            console.log("[Popup] Mensaje 'incurrirHoy' enviado, respuesta:", response);
        } else {
            console.warn("[Popup] No se puede ejecutar en esta pestaña:", tab ? tab.url : 'Pestaña inválida');
            alert("No se puede ejecutar la extensión en esta pestaña. Asegúrate de estar en la página de Axet.");
        }
    } catch (error) {
        console.error("[Popup] Error en el botón 'Incurrir Hoy':", error);
        if (error?.message?.includes('Could not establish connection')) {
            alert("No se pudo comunicar con la página. Recarga la pestaña de Axet e inténtalo de nuevo.");
        }
    }
});

/**
 * Reads the date range from Flatpickr, validates it, and sends a message to the content script.
 * @param {string} actionType - The action to send (e.g., "incurrirInRange", "deleteInRange").
 */
async function handleRangeAction(actionType) {
    console.log(`[Popup] Botón '${actionType}' pulsado.`);
    const fechaRangoInput = document.getElementById('fechaRango');
    const rangeInstance = fechaRangoInput._flatpickr;

    if (!rangeInstance) {
        alert("Error: Selector de fechas no inicializado correctamente.");
        return;
    }
    const selectedDates = rangeInstance.selectedDates;

    if (selectedDates.length !== 2) {
        alert("Selecciona un rango completo (fecha de inicio y fecha de fin).");
        return;
    }

    const startDate = selectedDates[0];
    const endDate = selectedDates[1];

    const formatDateLocal = (date) => {
        if (!date) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const startDateStr = formatDateLocal(startDate);
    const endDateStr = formatDateLocal(endDate);

    // Validación de quincena (¡movida al lado del content script!)
    // El popup ya no necesita hacer esta validación, la hará el content script
    // antes de ejecutar la acción, lo cual es más robusto.
    // ... (Validación de fechas eliminada de aquí) ...

    console.log(`[Popup] Rango (local): ${startDateStr} a ${endDateStr}. Enviando...`);

    // Send message to content script
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && tab.url && tab.url.startsWith('http')) {
            // Ya no se necesita ensureContentScripts
            const response = await sendTabMessage(tab.id, {
                action: actionType,
                startDate: startDateStr,
                endDate: endDateStr
            });
            console.log(`[Popup] Mensaje '${actionType}' enviado, respuesta:`, response);
        } else {
            alert("No se puede ejecutar la acción en esta pestaña. Asegúrate de estar en la página correcta de Axet.");
        }
    } catch (error) {
        console.error(`[Popup] Error during '${actionType}' process:`, error);
        alert(`Se produjo un error: ${error.message}`);
    }
}

// --- Botón "Incurrir Rango" ---
document.getElementById('incurrirRangoBtn').addEventListener('click', () => {
    handleRangeAction("incurrirInRange");
});

// --- Botón "Borrar Rango" ---
document.getElementById('deleteScript').addEventListener('click', () => {
    handleRangeAction("deleteInRange");
});