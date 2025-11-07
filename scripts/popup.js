// scripts/popup.js

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
        // Permitir seleccionar solo del 1 al día de HOY (o 15, lo que sea menor)
        minSelectableDate = new Date(currentYear, currentMonth, 1);
        // El máximo es hoy, porque no se puede ir más allá, incluso si el día 15 es futuro
        maxSelectableDate = today;
        console.log(`[Popup] Hoy (${currentDayOfMonth}) <= 15. Rango: 1/${currentMonth+1} a HOY (${today.toLocaleDateString()}).`);
    } else {
        // Permitir seleccionar solo del 16 al día de HOY
        minSelectableDate = new Date(currentYear, currentMonth, 16);
        // El máximo es hoy
        maxSelectableDate = today;
        console.log(`[Popup] Hoy (${currentDayOfMonth}) > 15. Rango: 16/${currentMonth+1} a HOY (${today.toLocaleDateString()}).`);
    }
    // --- FIN LÓGICA RESTRICCIÓN ---


    const fechaRangoInput = document.getElementById('fechaRango');

    // Opciones para Rango, Inline, Español y Fechas Restringidas
    const flatpickrRangeOptions = {
        mode: "range",
        dateFormat: "Y-m-d", // Formato interno
        altInput: false,      // Muestra input formateado
        altFormat: "d/m/Y",  // Formato visible
        inline: true,        // Dibujar directamente
        showMonths: 1,
        locale: "es",        // Usar idioma español
        // --- APLICAR RESTRICCIONES ---
        minDate: minSelectableDate,
        maxDate: maxSelectableDate, // MaxDate ahora es 'today' o '15th' (si hoy < 15)
        monthSelectorType: "static"
    };

    // Inicializar en el input de rango
    flatpickr(fechaRangoInput, flatpickrRangeOptions);

    console.log("[Popup] Flatpickr inicializado (Rango, Inline, Español, Restringido a Quincena + Pasado).");
});
// --- End Flatpickr Initialization ---


// --- Extension Logic ---
// Lista de scripts a inyectar en la página
const SCRIPTS_TO_INJECT = [
    'scripts/shared/toast.js',
    'scripts/shared/utils.js',
    'scripts/shared/navigation.js',
    'scripts/modules/incurrir.js',
    'scripts/modules/borrar.js',
    'scripts/modules/crearTarea.js',
    'scripts/content.js' // El orquestador principal va al final
];

/**
 * Inyecta una lista de scripts en la pestaña activa secuencialmente.
 * @param {number} tabId - ID de la pestaña donde inyectar.
 * @param {string[]} scriptFiles - Array con las rutas de los scripts.
 */
async function injectScripts(tabId, scriptFiles) {
    for (const file of scriptFiles) {
        try {
            // console.log(`[Popup] Inyectando ${file}...`); // Descomentar para depuración
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: [file]
            });
            // console.log(`[Popup] ${file} inyectado con éxito.`); // Descomentar para depuración
        } catch (error) {
            console.error(`[Popup] Error al inyectar ${file}:`, error);
            // Mostrar error al usuario y detener
            alert(`Error crítico al cargar la extensión (${file}).\nRecarga la página de Axet y la extensión.\nDetalles: ${error.message}`);
            throw error; // Propagar el error para detener la ejecución
        }
    }
}

// --- Botón "Incurrir Tareas Hoy" ---
document.getElementById('runScript').addEventListener('click', async () => {
    console.log("[Popup] Botón 'Incurrir Hoy' pulsado.");
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Verificar que la pestaña sea válida (no interna de Chrome y sea http/https)
        if (tab && tab.id && tab.url && !tab.url.startsWith('chrome://') && tab.url.startsWith('http')) {
            await injectScripts(tab.id, SCRIPTS_TO_INJECT);
            // Enviar mensaje al content script para iniciar la acción
            chrome.tabs.sendMessage(tab.id, { action: "incurrirHoy" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("[Popup] Error enviando mensaje 'incurrirHoy':", chrome.runtime.lastError.message);
                    // Podría indicar que el content script no respondió (quizás no se inyectó bien)
                    alert("Error de comunicación con la página. Inténtalo de nuevo o recarga la extensión/página.");
                } else {
                    console.log("[Popup] Mensaje 'incurrirHoy' enviado, respuesta:", response);
                }
            });
        } else {
            console.warn("[Popup] No se puede ejecutar en esta pestaña:", tab ? tab.url : 'Pestaña inválida');
            alert("No se puede ejecutar la extensión en esta pestaña. Asegúrate de estar en la página de Axet.");
        }
    } catch (error) {
        // Errores durante la inyección ya muestran alert
        console.error("[Popup] Error en el botón 'Incurrir Hoy':", error);
    }
});

/**
 * Reads the date range from Flatpickr, validates it, and sends a message to the content script.
 * USES LOCAL DATE FORMATTING.
 * @param {string} actionType - The action to send (e.g., "incurrirInRange", "deleteInRange").
 */
async function handleRangeAction(actionType) {
    console.log(`[Popup] Botón '${actionType}' pulsado.`);
    const fechaRangoInput = document.getElementById('fechaRango'); // The original input Flatpickr is attached to
    const rangeInstance = fechaRangoInput._flatpickr;

    if (!rangeInstance) {
        alert("Error: Selector de fechas no inicializado correctamente.");
        return;
    }
    const selectedDates = rangeInstance.selectedDates;

    // Check if exactly two dates are selected
    if (selectedDates.length !== 2) {
        alert("Selecciona un rango completo (fecha de inicio y fecha de fin).");
        return;
    }

    const startDate = selectedDates[0]; // This is a local Date object
    const endDate = selectedDates[1];   // This is a local Date object

    // --- CORRECT LOCAL DATE FORMATTING ---
    // Helper function to format Date object to 'YYYY-MM-DD' using local date parts
    const formatDateLocal = (date) => {
        if (!date) return null; // Handle cases where date might be null initially
        const year = date.getFullYear();
        // getMonth() is 0-indexed (0=Jan, 11=Dec), so add 1
        const month = String(date.getMonth() + 1).padStart(2, '0');
        // getDate() returns the day of the month (1-31)
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const startDateStr = formatDateLocal(startDate); // Correct 'YYYY-MM-DD'
    const endDateStr = formatDateLocal(endDate);   // Correct 'YYYY-MM-DD'
    // --- END CORRECTION ---

    // Validate the selected range against current fortnight rules and 'today'
    const today = new Date(); today.setHours(0,0,0,0);
    const currentDayOfMonth = today.getDate();
    let minAllowed, maxAllowed;

    if (currentDayOfMonth <= 15) {
        minAllowed = new Date(today.getFullYear(), today.getMonth(), 1);
        maxAllowed = new Date(today.getFullYear(), today.getMonth(), 15);
    } else {
        minAllowed = new Date(today.getFullYear(), today.getMonth(), 16);
        maxAllowed = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
    }
    // Ensure maxAllowed is not later than today
    if (maxAllowed > today) {
        maxAllowed = today;
    }
    minAllowed.setHours(0,0,0,0);
    maxAllowed.setHours(0,0,0,0);

    // Normalize selected dates for comparison (redundant but safe)
    const selectedStartNorm = new Date(startDate); selectedStartNorm.setHours(0,0,0,0);
    const selectedEndNorm = new Date(endDate); selectedEndNorm.setHours(0,0,0,0);

    if (selectedStartNorm < minAllowed || selectedEndNorm > maxAllowed) {
        alert(`El rango seleccionado está fuera del período permitido actualmente (${minAllowed.toLocaleDateString('es-ES')} - ${maxAllowed.toLocaleDateString('es-ES')}).`);
        return;
    }

    console.log(`[Popup] Rango válido (local): ${startDateStr} a ${endDateStr}`);

    // Send message to content script
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        // Check if tab and tab.id are valid before proceeding
        if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && tab.url.startsWith('http')) {
            // Ensure scripts are injected before sending the message
            // You might already have SCRIPTS_TO_INJECT and injectScripts defined elsewhere in popup.js
            await injectScripts(tab.id, SCRIPTS_TO_INJECT);
            chrome.tabs.sendMessage(tab.id, {
                action: actionType,
                startDate: startDateStr, // Use the correctly formatted local date string
                endDate: endDateStr    // Use the correctly formatted local date string
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error(`[Popup] Error sending '${actionType}':`, chrome.runtime.lastError.message);
                    // Provide feedback if message sending fails
                    alert("Error al comunicar con la página. Inténtalo de nuevo o recarga la extensión/página.");
                } else {
                    console.log(`[Popup] Mensaje '${actionType}' enviado, respuesta:`, response);
                    // Optional: Close popup or show success message here
                    // window.close(); // Example: Close popup after action initiated
                }
            });
        } else {
            alert("No se puede ejecutar la acción en esta pestaña. Asegúrate de estar en la página correcta de Axet.");
        }
    } catch (error) {
        console.error(`[Popup] Error during '${actionType}' process:`, error);
        alert(`Se produjo un error: ${error.message}`); // Show error to user
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

// --- NUEVO: Botón Debug Siguiente Paso ---
document.getElementById('debugNextStepBtn').addEventListener('click', async () => {
    console.log("[Popup] Botón 'Debug Siguiente Paso' pulsado.");
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && tab.url.startsWith('http')) {
            // Inyectar scripts (asegura que todo esté cargado, incluido el nuevo módulo)
            await injectScripts(tab.id, SCRIPTS_TO_INJECT);
            
            // Enviar mensaje para ejecutar el siguiente paso
            chrome.tabs.sendMessage(tab.id, { action: "debugNextStep" }, (response) => {
                if (chrome.runtime.lastError) {
                     console.error("[Popup] Error enviando 'debugNextStep':", chrome.runtime.lastError.message);
                     alert("Error de comunicación. Recarga la extensión/página.");
                }
                else console.log("[Popup] 'debugNextStep' enviado, respuesta:", response);
            });
        } else {
            alert("No se puede ejecutar la acción en esta pestaña.");
        }
    } catch (error) {
        console.error("[Popup] Error en el botón 'Debug':", error);
    }
});