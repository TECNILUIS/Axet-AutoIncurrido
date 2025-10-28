// scripts/modules/borrar.js

/**
 * Función principal para borrar tareas en un rango de fechas.
 * Navega día por día y borra las tareas encontradas.
 * Valida las fechas según las reglas quincenales.
 * @param {string} startDateStr - Fecha inicio YYYY-MM-DD
 * @param {string} endDateStr - Fecha fin YYYY-MM-DD
 */
async function deleteTasksInRange(startDateStr, endDateStr) {
    // Asegurar dependencias
    if (typeof requestPageToast !== 'function' || typeof navigateToDate !== 'function' ||
        typeof getPageDate !== 'function' || typeof sleep !== 'function' ||
        typeof findElementByText !== 'function' || typeof waitForElement !== 'function' ||
        typeof deleteTasksForDayViaDropdown !== 'function' || typeof getHorasActuales !== 'function') { // Añadido getHorasActuales
         console.error("[Borrar] Faltan funciones auxiliares.");
         if(typeof requestPageToast === 'function') requestPageToast("Error interno: Faltan funciones auxiliares para borrar.", "error");
         return;
     }

    requestPageToast(`Iniciando borrado desde ${startDateStr} hasta ${endDateStr}...`, 'info', 6000);
    console.log(`[Borrar] Rango solicitado: ${startDateStr} a ${endDateStr}`);

    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche

    // --- VALIDACIÓN QUINCENAL (Sin cambios) ---
    const currentDayOfMonth = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    let currentDateForCheck = new Date(startDate);
    while (currentDateForCheck <= endDate) {
        const checkDay = currentDateForCheck.getDate();
        const checkMonth = currentDateForCheck.getMonth();
        const checkYear = currentDateForCheck.getFullYear();
        if (checkDay <= 15 && currentDayOfMonth > 15 && checkMonth === currentMonth && checkYear === currentYear) {
            const errorMsg = `No se puede borrar día ${checkDay}/${checkMonth+1}: 1ª quincena cerrada.`;
            requestPageToast(errorMsg, 'error', 6000); return;
        }
         const nextMonthDate = new Date(checkYear, checkMonth + 1, 1);
         if (checkDay > 15 && today >= nextMonthDate) {
             const errorMsg = `No se puede borrar día ${checkDay}/${checkMonth+1}: 2ª quincena cerrada.`;
             requestPageToast(errorMsg, 'error', 6000); return;
         }
        currentDateForCheck.setDate(currentDateForCheck.getDate() + 1);
    }
    console.log("[Borrar] Validación quincenal superada.");
    // --- FIN VALIDACIÓN ---

    let currentDate = new Date(startDate); // Fecha actual del bucle

    try {
        // Bucle día por día
        while (currentDate <= endDate) {
            const dayDDMMYYYY = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()}`;
            const dayYYYYMMDD = currentDate.toISOString().split('T')[0];

            console.log(`[Borrar] --- Procesando ${dayDDMMYYYY} ---`);
            requestPageToast(`Borrando día: ${dayDDMMYYYY}`, 'info');

            // 1. Navegar al día (si no estamos ya en él)
            const currentPageDate = getPageDate();
            const currentPageStr = currentPageDate ? currentPageDate.toISOString().split('T')[0] : null;

            if (!currentPageStr || currentPageStr !== dayYYYYMMDD) {
                console.log(`[Borrar] Navegando a ${dayDDMMYYYY}...`);
                await navigateToDate(dayDDMMYYYY, getPageDate); // Usa la función de navegación
                await sleep(2500); // Espera crucial post-navegación
            } else {
                console.log(`[Borrar] Ya estamos en ${dayDDMMYYYY}.`);
                 // Aunque estemos en el día, dar un pequeño respiro a la página
                 await sleep(500);
            }

            // 2. Borrar tareas de ese día
            await deleteTasksForDayViaDropdown();

            // 3. Pasar al siguiente día del rango
            currentDate.setDate(currentDate.getDate() + 1);
            await sleep(300); // Pausa breve entre días
        } // Fin del bucle while

        requestPageToast("¡Borrado de rango completado!", "success");
        console.log("[Borrar] --- Proceso finalizado ---");

    } catch (error) {
        console.error("[Borrar] Error durante el proceso:", error);
        requestPageToast(`Error en el borrado: ${error.message}`, 'error', 6000);
         // No necesitamos volver a la página principal aquí, el usuario lo hará si quiere
    }
}


/**
 * Borra todas las tareas con horas > 00:00 para el día actual
 * usando selección del dropdown y botón principal de borrar, con esperas inteligentes.
 * (Función mantenida de la versión anterior)
 */
async function deleteTasksForDayViaDropdown() {
     // Asegurar dependencias
     if (typeof requestPageToast !== 'function' || typeof getHorasActuales !== 'function' ||
         typeof sleep !== 'function' || typeof waitForElement !== 'function' ||
         typeof waitForCondition !== 'function') {
          console.error("[Borrar-Dropdown] Faltan funciones auxiliares.");
          return; // Salir si faltan funciones esenciales
      }

    console.log("[Borrar-Dropdown] Iniciando borrado para el día actual...");
    const mainDropdownSelector = '.formio-component-select .choices';
    const mainDeleteButtonSelector = 'button.borrarBoton';
    const optionsSelector = 'div.choices__item[role="option"]'; // Selector para las opciones del dropdown

    let attempts = 0;
    const maxAttempts = 15;

    // Antes de empezar, comprobar si hay horas cargadas. Si es 00:00, no hay nada que borrar.
     if (getHorasActuales() === '00:00') {
         console.log("[Borrar-Dropdown] Horas actuales son 00:00. No hay nada que borrar.");
         return;
     }

    while (attempts < maxAttempts) {
        attempts++;
        console.log(`[Borrar-Dropdown] Intento ${attempts}...`);

        const dropdownContainer = await waitForElement(mainDropdownSelector);
        if (!dropdownContainer) {
             console.log("[Borrar-Dropdown] No se encuentra el dropdown principal. Finalizando borrado del día.");
             break;
         }

        // 1. Abrir el dropdown
        dropdownContainer.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
        await sleep(300);

        // 2. Buscar la PRIMERA opción borrable
        const options = Array.from(dropdownContainer.querySelectorAll(optionsSelector));
        let taskToDeleteElement = null;
        let onlySelectOptionLeft = true;

        for (const option of options) {
            const optionText = (option.textContent || '').trim();
             if (!optionText.toLowerCase().includes('selecciona')) {
                 onlySelectOptionLeft = false;
             }
             if (optionText.toLowerCase().includes('selecciona')) {
                 continue;
             }
            const strongTag = option.querySelector('strong:last-of-type');
            if (strongTag) {
                const timeText = strongTag.textContent.trim();
                if (/^\d{2}:\d{2}$/.test(timeText) && timeText !== '00:00') {
                    taskToDeleteElement = option;
                    console.log(`[Borrar-Dropdown] Tarea a borrar: ${optionText.substring(0, 50)}... (${timeText})`);
                    break;
                }
            }
        }

        // 3. Salir si no hay tareas borrables o solo queda "Selecciona"
        if (!taskToDeleteElement || onlySelectOptionLeft) {
            console.log("[Borrar-Dropdown] No hay más tareas borrables.");
             try { dropdownContainer.blur(); document.body.click(); } catch(e){}
            break;
        }

        // 4. Seleccionar la tarea
        const taskTextToSelect = taskToDeleteElement.textContent.substring(0, 50);
        taskToDeleteElement.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
        taskToDeleteElement.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
        console.log(`[Borrar-Dropdown] Seleccionada: ${taskTextToSelect}...`);
        const selectionBox = dropdownContainer.querySelector('.choices__list--single');
        if (selectionBox) {
            try {
                 await waitForCondition(() => (selectionBox.textContent || '').trim().includes(taskTextToSelect.substring(0,15)), 3000, `selección de ${taskTextToSelect}`); // Comprobar inicio del texto
             } catch (e) { console.warn("No se pudo confirmar la selección en el dropdown."); }
        } else { await sleep(500); }

        // 5. Clic en botón "Borrar"
        const deleteButton = await waitForElement(mainDeleteButtonSelector);
        if (!deleteButton) { console.error("[Borrar-Dropdown] No se encontró el botón 'Borrar'."); requestPageToast("Error: No se encontró botón 'Borrar'.", "error"); break; }
        const horasAntes = getHorasActuales();
        const initialOptionCount = options.length;
        console.log("[Borrar-Dropdown] Pulsando 'Borrar'...");
        deleteButton.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
        deleteButton.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

        // 6. Esperar actualización usando waitForCondition
        console.log("[Borrar-Dropdown] Esperando actualización post-borrado...");
        try {
            await waitForCondition(() => {
                const horasAhora = getHorasActuales();
                const currentOptionsAfterClick = dropdownContainer.querySelectorAll(optionsSelector);
                // Condición: Horas cambian O el número de opciones disminuye O las horas llegan a 00:00
                return horasAhora !== horasAntes || currentOptionsAfterClick.length < initialOptionCount || horasAhora === '00:00';
            }, 10000, "actualización post-borrado (horas o lista)");
            console.log("[Borrar-Dropdown] Actualización detectada.");
            // Si las horas llegaron a 00:00, terminamos el día
            if (getHorasActuales() === '00:00') {
                 console.log("[Borrar-Dropdown] Horas llegaron a 00:00. Finalizando borrado del día.");
                 break; // Salir del bucle while
            }
        } catch (error) {
            console.warn("[Borrar-Dropdown] No se detectó cambio claro tras borrar. Puede que el borrado haya fallado o sido muy rápido. Continuando...", error);
            await sleep(1000);
        }

    } // Fin del bucle while

    if (attempts >= maxAttempts) {
        console.error("[Borrar-Dropdown] Límite de intentos alcanzado.");
        requestPageToast("Error: Límite de intentos al borrar. Revisa la página.", "error");
    }

    console.log("[Borrar-Dropdown] Finalizado borrado para el día actual.");
}

console.log("borrar.js loaded v4 (navegación día a día)"); // Para depuración