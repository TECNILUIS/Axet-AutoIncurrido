// scripts/modules/borrar.js v5 (Optimizado con filtro de calendario)

/**
 * Función principal para borrar tareas en un rango de fechas.
 * Identifica días imputados en el calendario y procesa solo esos.
 * Valida las fechas según las reglas quincenales.
 * @param {string} startDateStr - Fecha inicio YYYY-MM-DD
 * @param {string} endDateStr - Fecha fin YYYY-MM-DD
 */
async function deleteTasksInRange(startDateStr, endDateStr) {
    // Asegurar dependencias
    if (typeof requestPageToast !== 'function' || typeof navigateToDate !== 'function' ||
        typeof getPageDate !== 'function' || typeof sleep !== 'function' ||
        typeof findElementByText !== 'function' || typeof waitForElement !== 'function' ||
        typeof deleteTasksForDayViaDropdown !== 'function' || typeof getHorasActuales !== 'function') {
         console.error("[Borrar] Faltan funciones auxiliares.");
         if(typeof requestPageToast === 'function') requestPageToast("Error interno: Faltan funciones auxiliares para borrar.", "error");
         return;
     }

    requestPageToast(`Iniciando borrado desde ${startDateStr} hasta ${endDateStr}...`, 'info', 6000);
    console.log(`[Borrar v5] Rango solicitado: ${startDateStr} a ${endDateStr}`);

    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // --- VALIDACIÓN QUINCENAL (Sin cambios) ---
    const currentDayOfMonth = today.getDate(); const currentMonth = today.getMonth(); const currentYear = today.getFullYear();
    let currentDateForCheck = new Date(startDate);
    while (currentDateForCheck <= endDate) {
        const checkDay = currentDateForCheck.getDate(); const checkMonth = currentDateForCheck.getMonth(); const checkYear = currentDateForCheck.getFullYear();
        if (checkDay <= 15 && currentDayOfMonth > 15 && checkMonth === currentMonth && checkYear === currentYear) {
            const errorMsg = `No se puede borrar día ${checkDay}/${checkMonth+1}: 1ª quincena cerrada.`; requestPageToast(errorMsg, 'error', 6000); return;
        }
         const nextMonthDate = new Date(checkYear, checkMonth + 1, 1);
         if (checkDay > 15 && today >= nextMonthDate) {
             const errorMsg = `No se puede borrar día ${checkDay}/${checkMonth+1}: 2ª quincena cerrada.`; requestPageToast(errorMsg, 'error', 6000); return;
         }
        currentDateForCheck.setDate(currentDateForCheck.getDate() + 1);
    }
    console.log("[Borrar v5] Validación quincenal superada.");
    // --- FIN VALIDACIÓN ---

    let daysToDelete = []; // Array de strings 'DD/MM/YYYY'

    try {
        // --- PASO 1 y 2: Navegar a Calendario e Identificar Días ---
        console.log("[Borrar v5] Navegando a vista de calendario para identificar días...");
        const changeDateLink = findElementByText('.sidebar.navbar-nav a', 'Cambiar fecha');
        if (!changeDateLink) throw new Error("Link 'Cambiar fecha' no encontrado.");
        changeDateLink.click();
        const calendarioDiv = await waitForElement('.calendario', null, document, 10000);
        console.log("[Borrar v5] Vista de calendario cargada.");
        await sleep(2000); // Dar tiempo extra para que el calendario pinte los días con sus clases

        console.log("[Borrar v5] Buscando días imputados en el calendario visible...");
        const daysInCalendar = calendarioDiv.querySelectorAll('.dias div[data-fecha-iso].imputado'); // Selector clave
        console.log(`[Borrar v5] Encontrados ${daysInCalendar.length} días marcados como '.imputado'.`);

        daysInCalendar.forEach(dayElement => {
            const dayIso = dayElement.dataset.fechaIso; // YYYY-MM-DD
            if (!dayIso) return; // Saltar si no tiene fecha ISO

            try {
                const dayDate = new Date(dayIso + 'T00:00:00');
                // Comprobar si el día está dentro del rango solicitado
                if (dayDate >= startDate && dayDate <= endDate) {
                    const dayDDMMYYYY = dayElement.dataset.fecha; // DD/MM/YYYY
                    if (dayDDMMYYYY && !daysToDelete.includes(dayDDMMYYYY)) {
                        daysToDelete.push(dayDDMMYYYY);
                        console.log(`[Borrar v5] Día ${dayDDMMYYYY} añadido a la lista de borrado.`);
                    }
                }
            } catch(e) {
                console.warn(`[Borrar v5] Error al parsear fecha del calendario: ${dayIso}`, e);
            }
        });

        // Ordenar las fechas
        daysToDelete.sort((a, b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
        console.log(`[Borrar v5] Días finales a borrar (${daysToDelete.length}):`, daysToDelete);

        if (daysToDelete.length === 0) {
            requestPageToast("No se encontraron días imputados (visibles) dentro del rango.", "info");
            const volverLink = findElementByText('.sidebar.navbar-nav a', 'Incurrir horas'); // Intentar volver
            if(volverLink) volverLink.click();
            return;
        }

        // --- PASO 3: Borrar Secuencialmente SOLO los días identificados ---
        for (const dayDDMMYYYY of daysToDelete) {
             console.log(`[Borrar v5] --- Procesando ${dayDDMMYYYY} ---`);
             requestPageToast(`Borrando día: ${dayDDMMYYYY}`, 'info');

            // Navegar al día (navigateToDate ya maneja si estamos en calendario o no)
            await navigateToDate(dayDDMMYYYY, getPageDate);
            await sleep(2500); // Espera post-navegación

            // Borrar tareas de ese día
            await deleteTasksForDayViaDropdown();
            await sleep(300); // Pausa breve entre días
        } // Fin del bucle for

        requestPageToast("¡Borrado de rango completado!", "success");
        console.log("[Borrar v5] --- Proceso finalizado ---");

    } catch (error) {
        console.error("[Borrar v5] Error durante el proceso:", error);
        requestPageToast(`Error en el borrado: ${error.message}`, 'error', 6000);
         try { // Intentar volver a la página principal
            const volverLink = findElementByText('.sidebar.navbar-nav a', 'Incurrir horas');
            if(volverLink) volverLink.click();
         } catch(e) {}
    }
}


/**
 * Borra todas las tareas con horas > 00:00 para el día actual
 * usando selección del dropdown y botón principal de borrar, con esperas inteligentes.
 * (Función sin cambios respecto a la v4)
 */
async function deleteTasksForDayViaDropdown() {
     // Asegurar dependencias
     if (typeof requestPageToast !== 'function' || typeof getHorasActuales !== 'function' ||
         typeof sleep !== 'function' || typeof waitForElement !== 'function' ||
         typeof waitForCondition !== 'function') {
          console.error("[Borrar-Dropdown] Faltan funciones auxiliares.");
          return;
      }

    console.log("[Borrar-Dropdown] Iniciando borrado para el día actual...");
    const mainDropdownSelector = '.formio-component-select .choices';
    const mainDeleteButtonSelector = 'button.borrarBoton';
    const optionsSelector = 'div.choices__item[role="option"]';

    let attempts = 0;
    const maxAttempts = 15;

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

console.log("borrar.js loaded v5 (filtrado calendario)"); // Para depuración