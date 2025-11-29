// scripts/modules/incurrir.js v2.5 FINAL (Lee Horas Pre-calculadas)

/**
 * OBTIENE las tareas y tiempos PRE-CALCULADOS para incurrir en una fecha específica.
 * Lee directamente del planDiario guardado en la configuración V2.5.
 * @param {Date} fecha - Objeto Date del día a obtener (medianoche local).
 * @param {object} config - El objeto de configuración v2.5 {proyectos, sdaComun, horasEsperadasDiarias, planDiario}.
 * @returns {Array<object>} - Lista de tareas a incurrir { nombre, codigoProyecto, horas, minutos }
 */
function getTareasParaDia_v2_3(fecha, config) { // Mantenemos nombre por compatibilidad histórica
    // Asegurar fecha válida y normalizada
    fecha = new Date(fecha);
    fecha.setHours(0, 0, 0, 0);

    // Verificar dependencias config y funciones auxiliares
    // Asumimos que formatDateYYYYMMDD y requestPageToast están disponibles globalmente (inyectadas antes)
    if (typeof formatDateYYYYMMDD !== 'function') {
         console.error("[Incurrir v2.5] ERROR CRÍTICO: Falta función auxiliar formatDateYYYYMMDD.");
         // Intentar mostrar alerta como último recurso
         try { if(typeof requestPageToast === 'function') requestPageToast("Error: Falta formatDateYYYYMMDD", 'error'); else alert("Error: Falta formatDateYYYYMMDD"); } catch(e){}
         return []; // No podemos continuar
     }
     if (!config || !config.proyectos || !config.planDiario) {
        console.error("[Incurrir v2.5] Configuración inválida o incompleta pasada a getTareasParaDia.");
        if (typeof requestPageToast === 'function') requestPageToast("Error: Configuración interna inválida.", 'error');
        return [];
    }
    // tipoTareaOrder debe estar disponible globalmente o definido aquí
    const tipoTareaOrderLocal = typeof tipoTareaOrder !== 'undefined' ? tipoTareaOrder : { 'Diseño': 1, 'Construcción': 2, 'Pruebas': 3, 'Despliegue': 4 };

    const todayStr = formatDateYYYYMMDD(fecha); // Formato YYYY-MM-DD local
    console.log(`[Incurrir v2.5] Obteniendo plan pre-calculado para: ${todayStr}`);

    // 1. Obtener el plan pre-calculado para el día
    const planCalculadoDelDia = config.planDiario[todayStr] || [];

    // 2. Verificar si hay algo que hacer
    if (planCalculadoDelDia.length === 0) {
        console.log(`[Incurrir v2.5] No hay plan pre-calculado para ${todayStr}. Verificando día laborable...`);
        const horasEsperadasHoyStr = (config.horasEsperadasDiarias[todayStr] || '').toUpperCase();
        if (horasEsperadasHoyStr && !isNaN(parseInt(horasEsperadasHoyStr, 10)) && parseInt(horasEsperadasHoyStr, 10) > 0) {
            console.warn(`[Incurrir v2.5] Día ${todayStr} laborable (${horasEsperadasHoyStr}h) pero sin tareas en planDiario.`);
             if (typeof requestPageToast === 'function') requestPageToast(`Día ${todayStr} (${horasEsperadasHoyStr}h) sin tareas planificadas.`, 'warning');
        } else {
             console.log(`[Incurrir v2.5] Día ${todayStr} no laborable o 0h.`);
        }
        return []; // No hay tareas
    }

    // 3. Formatear la salida para incurrirTareas (leer directamente horas/minutos)
    const tareasParaIncurrir = [];
    planCalculadoDelDia.forEach(tareaCalc => { // tareaCalc = { proyectoIndex, tipoTarea, horas, minutos }
        // Validar datos de la tarea calculada
        if (tareaCalc.proyectoIndex === undefined || !tareaCalc.tipoTarea || tareaCalc.horas === undefined || tareaCalc.minutos === undefined) {
            console.warn(`[Incurrir v2.5] Tarea en planDiario para ${todayStr} con formato incorrecto:`, tareaCalc);
            return; // Saltar esta tarea
        }

        const proyecto = config.proyectos[tareaCalc.proyectoIndex];

        // Añadir solo si el proyecto existe Y tiene tiempo asignado
        if (proyecto && (parseInt(tareaCalc.horas, 10) > 0 || parseInt(tareaCalc.minutos, 10) > 0)) {
            tareasParaIncurrir.push({
                nombre: tareaCalc.tipoTarea,       // Nombre = Etapa pre-calculada
                codigoProyecto: proyecto.codigo,   // Código del proyecto
                horas: String(tareaCalc.horas),    // Horas pre-calculadas
                minutos: String(tareaCalc.minutos) // Minutos pre-calculados
            });
        } else if (!proyecto) {
             console.error(`[Incurrir v2.5] Proyecto índice ${tareaCalc.proyectoIndex} no encontrado al formatear salida para ${todayStr}.`);
        }
    });

    // Ordenar salida final (Diseño -> Construcción -> ...)
    tareasParaIncurrir.sort((a, b) => {
        const typeA = a.nombre || ''; const typeB = b.nombre || '';
        return (tipoTareaOrderLocal[typeA] || 99) - (tipoTareaOrderLocal[typeB] || 99);
    });

    console.log(`[Incurrir v2.5] Tareas pre-calculadas listas para ${todayStr}:`, tareasParaIncurrir);
    return tareasParaIncurrir;
}


/**
 * Función principal para imputar las tareas preparadas para un día.
 * @param {Date} fechaParaIncurrir - La fecha en la que se deben incurrir las tareas.
 * @param {Array<object>} tareasAIncurrir - Lista preparada por getTareasParaDia_v2_3.
 * @param {object} config - La configuración global.
 */
async function incurrirTareas(fechaParaIncurrir, tareasAIncurrir, config) {
    // Asegurar dependencias (inyectadas globalmente)
    if (typeof requestPageToast !== 'function' || typeof getHorasActuales !== 'function' || typeof sleep !== 'function' ||
        typeof waitForElement !== 'function' || typeof waitForCondition !== 'function' || typeof findElementByText !== 'function') {
         console.error("[Incurrir] Faltan funciones auxiliares (toast, utils).");
         if(typeof requestPageToast === 'function') requestPageToast("Error interno: Faltan funciones.", "error"); return;
     }

    console.log(`[Incurrir] Iniciando imputación en Axet para ${fechaParaIncurrir.toLocaleDateString()} (${tareasAIncurrir.length} tareas pre-calculadas).`);

    if (tareasAIncurrir.length === 0) {
        console.log("[Incurrir] No hay tareas calculadas para imputar."); return;
    }

    // Comprobar si ya se ha incurrido suficiente
    const currentHoursText = getHorasActuales();
    const [currentH, currentM] = currentHoursText.split(':').map(n => parseInt(n, 10));
    const currentMinutesIncurred = (currentH * 60) + currentM;
    const totalMinutesPlanned = tareasAIncurrir.reduce((acc, tarea) => {
        return acc + (parseInt(tarea.horas, 10) || 0) * 60 + (parseInt(tarea.minutos, 10) || 0);
    }, 0);

    if (currentMinutesIncurred >= totalMinutesPlanned && totalMinutesPlanned > 0) {
        requestPageToast(`Ya incurrido ${currentHoursText}. Plan: ${Math.floor(totalMinutesPlanned/60)}h ${totalMinutesPlanned%60}m. Detenido.`, "info", 6000);
        console.log(`[Incurrir] Imputación ya realizada (${currentMinutesIncurred} >= ${totalMinutesPlanned}).`); return;
    }
     console.log(`[Incurrir] Incurridos: ${currentMinutesIncurred}. Planificados: ${totalMinutesPlanned}. Procediendo...`);

    let tareaCounter = 1;
    for (const tarea of tareasAIncurrir) {
         const taskMinutes = (parseInt(tarea.horas, 10) || 0) * 60 + (parseInt(tarea.minutos, 10) || 0);
         if (taskMinutes <= 0) {
             console.log(`[Incurrir] Saltando Tarea ${tareaCounter} (${tarea.nombre} - ${tarea.codigoProyecto}): 0 min.`);
             tareaCounter++; continue;
         }

        console.log(`\n[Incurrir] --- TAREA ${tareaCounter}/${tareasAIncurrir.length}: ${tarea.nombre} (${tarea.codigoProyecto}) - ${tarea.horas}h ${tarea.minutos}m) ---`);
        const horasAntesDeIncurrir = getHorasActuales();
        let usarBotonModificar = false;

        try {
            // --- Interacción con la UI de Axet ---
            let dropdown = await waitForElement('.formio-component-select .choices');
            let selectionBox = dropdown.querySelector('.choices__list--single');
            if (dropdown.classList.contains('is-open')) { if (dropdown.classList.contains('is-open')) dropdown.click(); await sleep(200); }
            dropdown.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
            console.log("[Incurrir] Dropdown abierto.");
            const textosABuscar = [`[${tarea.nombre}]`, tarea.codigoProyecto];
            await sleep(300);
            let opcionSeleccionar = null;
            try {
                opcionSeleccionar = await waitForElement('div.choices__item[role="option"]', textosABuscar, dropdown, 3000);
            } catch (lookupError) {
                opcionSeleccionar = null;
            }

            if (!opcionSeleccionar) {
                console.warn(`[Incurrir] Tarea ${tarea.nombre} (${tarea.codigoProyecto}) no encontrada en el desplegable. Intentando crearla automáticamente...`);
                if (typeof requestPageToast === 'function') {
                    requestPageToast(`Creando tarea ${tarea.nombre} (${tarea.codigoProyecto}) en Axet...`, 'info', 5000);
                }
                if (typeof crearTarea !== 'function') {
                    throw new Error("Función crearTarea no disponible para crear la tarea ausente.");
                }

                let created = false;
                try {
                    // Llamamos a crearTarea. Esta función ya incurre el tiempo.
                    created = await crearTarea(tarea, config);
                    
                    if (created) {
                        console.log(`[Incurrir] Tarea ${tarea.nombre} creada e incurrida con éxito.`);
                        
                        // Esperamos a que el contador principal (en la página de incurrir)
                        // se actualice antes de pasar a la siguiente tarea.
                        await waitForCondition(() => {
                            const horasActuales = getHorasActuales();
                            return horasActuales !== null && horasActuales !== horasAntesDeIncurrir;
                        }, 15000, "actualización contador post-creación");
                        
                        console.log(`[Incurrir] [ÉXITO] Tarea ${tareaCounter} (creada) incurrida. Horas ahora: ${getHorasActuales()}`);
                        // La tarea está lista, saltamos al siguiente item del bucle 'for'
                        tareaCounter++;
                        continue; 

                    } else {
                        // 'crearTarea' falló internamente y devolvió false
                        console.warn(`[Incurrir] El flujo 'crearTarea' para ${tarea.nombre} (${tarea.codigoProyecto}) finalizó con error. Saltando esta tarea.`);
                        tareaCounter++;
                        continue; 
                    }

                } catch (creationError) {
                    // 'crearTarea' lanzó una excepción que 'try...catch' exterior capturará
                    throw new Error(`Fallo al crear la tarea ${tarea.nombre} (${tarea.codigoProyecto}): ${creationError.message}`);
                }
            }

            console.log(`[Incurrir] Opción encontrada: ${opcionSeleccionar.textContent.substring(0,60)}...`);

            // Detectar si la opción ya tiene horas imputadas distintas a 00:00 para decidir la acción
            const opcionTexto = (opcionSeleccionar.textContent || '').trim();
            // Las opciones sin horas muestran '00:00', por lo que un formato fijo HH:MM es suficiente
            const matchHorasAsignadas = opcionTexto.match(/(\d{2}):(\d{2})/);
            if (matchHorasAsignadas) {
                const horasAsignadas = parseInt(matchHorasAsignadas[1], 10) || 0;
                const minutosAsignados = parseInt(matchHorasAsignadas[2], 10) || 0;
                const totalAsignado = (horasAsignadas * 60) + minutosAsignados;
                const horasPlan = parseInt(tarea.horas, 10) || 0;
                const minutosPlan = parseInt(tarea.minutos, 10) || 0;
                const totalPlan = (horasPlan * 60) + minutosPlan;
                const textoAsignado = `${String(horasAsignadas).padStart(2, '0')}:${String(minutosAsignados).padStart(2, '0')}`;

                if (totalAsignado > 0) {
                    if (totalAsignado === totalPlan) {
                        console.log(`[Incurrir] Tarea ${tarea.nombre} (${tarea.codigoProyecto}) ya incurrida con ${textoAsignado}. Saltando.`);
                        if (typeof requestPageToast === 'function') {
                            requestPageToast(`Tarea ${tarea.nombre} (${tarea.codigoProyecto}) ya tiene ${textoAsignado}.`, 'info', 4000);
                        }
                        // Cerrar el desplegable para dejar la UI limpia antes de continuar
                        dropdown.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
                        await sleep(200);
                        tareaCounter++;
                        continue;
                    }

                    usarBotonModificar = true;
                    console.log(`[Incurrir] Tarea ${tarea.nombre} (${tarea.codigoProyecto}) tiene ${textoAsignado}. Se actualizará usando el botón 'Modificar'.`);
                }
            }

            opcionSeleccionar.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            opcionSeleccionar.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
            console.log("[Incurrir] Opción seleccionada.");
            await waitForCondition(() => (selectionBox.textContent || '').trim().includes(tarea.codigoProyecto), 5000, `selección de '${tarea.codigoProyecto}'`);
            console.log(`[Incurrir] Selección confirmada: ${selectionBox.textContent.substring(0,60)}...`);

            const hoursInput = document.querySelector('input[name="data[container1][horas]"]');
            hoursInput.value = tarea.horas; hoursInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            const minutesInput = document.querySelector('input[name="data[container1][minutos]"]');
            minutesInput.value = tarea.minutos; minutesInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            console.log(`[Incurrir] Valores ${tarea.horas}h ${tarea.minutos}m introducidos.`);
            await sleep(300);

            const botonSelector = usarBotonModificar ? 'button.modificarBoton' : 'button.incurrirBoton';
            const botonDescripcion = usarBotonModificar ? "'Modificar'" : "'Incurrir'";
            const botonAccion = await waitForElement(botonSelector);
            console.log(`[Incurrir] Pulsando ${botonDescripcion}...`);
            botonAccion.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            botonAccion.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

            console.log("[Incurrir] Esperando actualización contador...");
            await waitForCondition(() => {
                const horasActuales = getHorasActuales(); // Puede devolver "08:00" o null
                
                // La condición es:
                // 1. horasActuales NO es null (el elemento se ha cargado y tiene formato válido)
                // 2. horasActuales es DIFERENTE al valor que teníamos ANTES de hacer clic
                return horasActuales !== null && horasActuales !== horasAntesDeIncurrir;
            }, 10000, "actualización contador post-incurrido");

            // Leemos el valor final una vez que la condición se cumple
            const horasFinales = getHorasActuales(); // Leemos el valor estable
            console.log(`[Incurrir] [ÉXITO] Tarea ${tareaCounter} incurrida. Horas ahora: ${horasFinales || '??:??'}`);
            // --- Fin Interacción ---
        } catch (error) {
             console.error(`[Incurrir] ERROR Tarea ${tareaCounter} (${tarea.nombre} - ${tarea.codigoProyecto}):`, error);
             requestPageToast(`Error incurrir Tarea ${tareaCounter}: ${tarea.nombre}. ${error.message}`, "error", 6000);
             // Continuamos con la siguiente
        }
        tareaCounter++;
    } // Fin for

    await sleep(300);
    const finalHoursText = getHorasActuales();
    const [finalH, finalM] = finalHoursText.split(':').map(n => parseInt(n, 10));
    const finalMinutesIncurred = (finalH * 60) + finalM;
    if (Math.abs(finalMinutesIncurred - totalMinutesPlanned) <= 1) { // Permitir +/- 1 min
         requestPageToast("¡Proceso de incurrido completado!", "success");
         console.log(`[Incurrir] Proceso OK. Total final: ${finalHoursText}. Plan: ${totalMinutesPlanned} min.`);
    } else {
         requestPageToast(`¡AVISO! Total (${finalHoursText}) difiere del plan (${Math.floor(totalMinutesPlanned/60)}h ${totalMinutesPlanned%60}m).`, "warning", 8000);
         console.warn(`[Incurrir] AVISO. Total final: ${finalHoursText} (${finalMinutesIncurred} min). Plan: ${totalMinutesPlanned} min.`);
    }
}

// --- Asegúrate de tener estas funciones/variables auxiliares disponibles globalmente ---
// (Definidas en utils.js e inyectadas antes)
// const tipoTareaOrder = { 'Diseño': 1, 'Construcción': 2, 'Pruebas': 3, 'Despliegue': 4 }; // Necesario globalmente
// function formatDateYYYYMMDD(date) { /* ... */ } // Necesario globalmente
// function getHorasActuales() { /* ... */ }
// function sleep(ms) { /* ... */ }
// function findElementByText(selector, texts, parent) { /* ... */ }
// function waitForElement(selector, text, parent, timeout) { /* ... */ }
// function waitForCondition(conditionFn, timeout, desc) { /* ... */ }
// function requestPageToast(message, type, duration) { /* ... */ }

// Exportar funciones si se usan módulos ES6 (no aplica aquí por inyección simple)
// export { getTareasParaDia_v2_3, incurrirTareas };

console.log("incurrir.js loaded v2.5 FINAL");