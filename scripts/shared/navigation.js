// scripts/shared/navigation.js

/**
 * Navega a una fecha específica usando la lógica de inyección.
 * @param {string} dateStrDDMMYYYY - Fecha en formato DD/MM/YYYY
 * @param {Function} getPageDateFn - Referencia a la función getPageDate de utils.js
 */
async function navigateToDate(dateStrDDMMYYYY, getPageDateFn) {
    console.log(`[Navigation] Intentando navegar a ${dateStrDDMMYYYY}...`);
    // Asegurar dependencias
    if (typeof findElementByText !== 'function' || typeof waitForElement !== 'function' ||
        typeof waitForCondition !== 'function' || typeof sleep !== 'function') {
        throw new Error("[Navigation] Funciones de utils.js no encontradas.");
    }
    if (typeof getPageDateFn !== 'function') {
         throw new Error("[Navigation] getPageDateFn no proporcionada.");
    }

    // --- PASO 1: Ir a vista de calendario ---
    const changeDateLink = findElementByText('.sidebar.navbar-nav a', 'Cambiar fecha');
    if (!changeDateLink) throw new Error("[Navigation] Link 'Cambiar fecha' no encontrado.");
    const initialPageDate = getPageDateFn();
    const initialDateStr = initialPageDate ? initialPageDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric'}) : "N/A"; // Formato "16 de octubre de 2025"
    console.log(`[Navigation] Fecha actual ANTES: ${initialDateStr}`);
    changeDateLink.click();
    console.log("[Navigation] Clic en 'Cambiar fecha'.");
    await waitForElement('.calendario', null, document, 10000);
    console.log("[Navigation] Vista de calendario detectada.");

    // --- PASO 2: Inyectar script ---
    const formElement = document.querySelector('.formio-form');
    if (!formElement) throw new Error("[Navigation] '.formio-form' no encontrado.");
    const componentWrapper = formElement.closest('.formio-component[id]');
    if (!componentWrapper) throw new Error("[Navigation] Contenedor con ID no encontrado.");
    const formId = componentWrapper.id;
    document.body.dataset.formId = formId;
    document.body.dataset.fechaStr = dateStrDDMMYYYY;
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('scripts/injector.js');
    let scriptExecuted = new Promise((resolve, reject) => {
        script.onload = () => { console.log("[Navigation] injector.js onload."); script.remove(); resolve(); };
        script.onerror = (e) => { console.error("[Navigation] injector.js onerror:", e); script.remove(); reject(new Error("Fallo al cargar injector.js")); };
    });
    (document.head || document.documentElement).appendChild(script);
    console.log("[Navigation] injector.js añadido. Esperando...");

    try {
        await scriptExecuted;
        console.log("[Navigation] injector.js procesado. Esperando recarga...");

        // --- PASO 3: Espera ROBUSTA ---
        const targetDateYYYYMMDD = dateStrDDMMYYYY.split('/').reverse().join('-');
        // Extraer solo el día para la comprobación del texto (ej. "17")
        const targetDayOfMonth = String(parseInt(dateStrDDMMYYYY.split('/')[0], 10));
        console.log(`[Navigation] Esperando actualización a ${targetDateYYYYMMDD} (día ${targetDayOfMonth})`);

        // 3.a Esperar desaparición/cambio fecha antigua
        console.log("[Navigation] Esperando desaparición/cambio fecha antigua...");
        const dateHighlightSelector = 'h2 > span.highlight'; // Selector del elemento que muestra la fecha
        await waitForCondition(async () => {
            const currentDateElement = document.querySelector(dateHighlightSelector);
            const currentHighlightText = currentDateElement?.textContent || '';
            const currentDate = getPageDateFn(); // Llamar siempre para actualizar estado interno si es necesario
             console.log(`[Navigation] Check 1: Texto=${currentHighlightText}, FechaLeída=${currentDate?.toISOString().split('T')[0]}`);
            // Condición: Elemento no existe O su texto ya no contiene el DÍA del mes inicial O la fecha leída ya es la correcta
             const initialDayOfMonth = initialPageDate ? String(initialPageDate.getDate()) : "invalid";
             return !currentDateElement ||
                    !currentHighlightText.includes(` ${initialDayOfMonth} `) || // Buscar día con espacios
                    (currentDate && currentDate.toISOString().split('T')[0] === targetDateYYYYMMDD);
        }, 15000, `desaparición/cambio de la fecha inicial`);
        console.log("[Navigation] Fecha inicial cambió/desapareció. Esperando nueva fecha...");
        await sleep(1000); // *** Pausa AÑADIDA para dar tiempo extra al DOM ***

        // 3.b Esperar aparición y corrección de la NUEVA fecha (enfocarse en el texto visible)
        await waitForCondition(() => {
            const newDateElement = document.querySelector(dateHighlightSelector);
            const newHighlightText = newDateElement?.textContent || '';
            const newPageDate = getPageDateFn(); // Llamar para consistencia, pero no confiar 100%
             console.log(`[Navigation] Check 2: Texto=${newHighlightText}, FechaLeída=${newPageDate?.toISOString().split('T')[0]}, Target=${targetDateYYYYMMDD}`);

             // *** CONDICIÓN PRINCIPAL: El texto del highlight CONTIENE el día del mes correcto ***
             // (usamos `startsWith` o `includes` buscando "DD de Mes")
             const targetDayStr = `${targetDayOfMonth} de`; // Ej "17 de"
             const textMatch = newHighlightText.toLowerCase().includes(targetDayStr.toLowerCase());

             // Condición secundaria (backup): la fecha leída por getPageDate es correcta
             const dateMatch = newPageDate && newPageDate.toISOString().split('T')[0] === targetDateYYYYMMDD;

             return textMatch || dateMatch; // Es suficiente con que el texto sea correcto
        }, 15000, `aparición y corrección a ${dateStrDDMMYYYY}`);

        console.log(`[Navigation] ¡ÉXITO! Navegación a ${dateStrDDMMYYYY} confirmada.`);

    } catch (error) {
        console.error("[Navigation] Error esperando actualización:", error);
        throw new Error(`Fallo al confirmar navegación a ${dateStrDDMMYYYY}. ${error.message}`);
    }
}
console.log("navigation.js loaded v3 (espera flexible)"); // Para depuración