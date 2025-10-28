// scripts/modules/incurrir.js

/**
 * Obtiene la lista de tareas a incurrir para una fecha dada,
 * aplicando la lógica de reglas de planificación (v2.3).
 * ESTA FUNCIÓN NECESITA SER COMPLETADA CON EL ALGORITMO FINAL.
 * @param {Date} fecha - La fecha para la que calcular las tareas.
 * @param {object} config - El objeto de configuración v2.3 cargado.
 * @returns {Array<object>} - Lista de tareas a incurrir { nombre, codigoProyecto, horas, minutos }
 */
function getTareasParaDia_v2_3(fecha, config) {
    console.log("[Incurrir] Calculando tareas para:", fecha.toISOString().split('T')[0]);
    // Asegurarse de que las dependencias estén disponibles
    if (typeof requestPageToast !== 'function') { // Asumiendo que requestPageToast está en content.js o utils.js
        console.error("[Incurrir] requestPageToast no está definido.");
        // Podríamos lanzar un error o usar console.log como fallback
    }

    const todayStr = fecha.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    const diaSemana = fecha.getDay(); // 0 (Dom) a 6 (Sab)

    // 1. Obtener Horas Totales del Día
    const horasEsperadasHoyStr = config.horasEsperadasDiarias ? config.horasEsperadasDiarias[todayStr] : '0';
    // Interpretar S, D, V, F como no laborables
    if (!horasEsperadasHoyStr || isNaN(parseInt(horasEsperadasHoyStr, 10))) {
        console.log(`[Incurrir] Día no laborable o sin horas definidas: ${horasEsperadasHoyStr}`);
        if (typeof requestPageToast === 'function') requestPageToast(`Día ${todayStr} no laborable o sin horas esperadas definidas.`);
         return [];
    }
    const horasTotalesNum = parseInt(horasEsperadasHoyStr, 10);
    let minutosTotalesDia = horasTotalesNum * 60;
    console.log(`[Incurrir] Horas Totales para ${todayStr}: ${horasTotalesNum}h (${minutosTotalesDia} min)`);

    // 2. Encontrar Reglas de Planificación Activas para hoy
    const reglasActivasHoy = (config.reglasPlanificacion || []).filter(regla => {
        try {
            const inicio = new Date(regla.inicio + 'T00:00:00');
            const fin = new Date(regla.fin + 'T00:00:00');
            // Asegurarse de que las fechas sean válidas y el día de hoy esté en el rango
            return !isNaN(inicio) && !isNaN(fin) && fecha >= inicio && fecha <= fin;
        } catch (e) { return false; }
    });
    console.log(`[Incurrir] Reglas activas hoy (${reglasActivasHoy.length}):`, reglasActivasHoy);

    if (reglasActivasHoy.length === 0) {
        console.log("[Incurrir] No hay reglas de asignación activas para hoy.");
        return [];
    }

    // --- AQUÍ VA EL ALGORITMO COMPLETO DE CÁLCULO (FIJA + PATRÓN SEMANAL) ---
    // ... (Implementación pendiente basada en la discusión anterior) ...
    // ...
    // ... Esto devolverá un array como: [{ proyectoIndex: 0, horasFinales: 1, minutosFinales: 0}, { proyectoIndex: 2, horasFinales: 7, minutosFinales: 0}]

    // --- Placeholder mientras implementamos el algoritmo: ---
     console.warn("[Incurrir] ALGORITMO DE CÁLCULO DE HORAS (v2.3) PENDIENTE DE IMPLEMENTAR.");
     // Simplemente devolvemos la primera regla activa con 1 hora como ejemplo temporal
     const tareasCalculadas = [];
     if (reglasActivasHoy.length > 0) {
         const primeraRegla = reglasActivasHoy[0];
         const proyecto = config.proyectos[primeraRegla.proyectoIndex];
         if (proyecto) {
             tareasCalculadas.push({
                 nombre: primeraRegla.tipoTarea, // Nombre viene de la regla
                 codigoProyecto: proyecto.codigo, // Código viene del proyecto
                 horas: "1", // Placeholder
                 minutos: "0" // Placeholder
             });
         }
     }
     console.log("[Incurrir] Tareas calculadas (placeholder):", tareasCalculadas);
     return tareasCalculadas;
    // --- Fin Placeholder ---


    /*
    // --- LÓGICA FINAL (cuando el algoritmo esté implementado) ---
    const tareasCalculadasConTiempo = calcularHorasConPatron(fecha, horasTotalesNum, reglasActivasHoy, config.horasEsperadasDiarias);
    // tareasCalculadasConTiempo sería: [{ proyectoIndex: 0, horas: 1, minutos: 0 }, ...]

    // Mapear resultado al formato final esperado por incurrirTareas
    const tareasParaIncurrir = tareasCalculadasConTiempo.map(calc => {
        const regla = reglasActivasHoy.find(r => r.proyectoIndex === calc.proyectoIndex); // Necesitamos la regla para el tipoTarea
        const proyecto = config.proyectos[calc.proyectoIndex];
        if (!regla || !proyecto) return null; // Seguridad
        return {
            nombre: regla.tipoTarea, // El nombre de Axet es el Tipo/Etapa
            codigoProyecto: proyecto.codigo,
            horas: String(calc.horas),
            minutos: String(calc.minutos)
        };
    }).filter(t => t !== null); // Filtrar posibles nulos

    console.log("[Incurrir] Tareas finales para incurrir:", tareasParaIncurrir);
    return tareasParaIncurrir;
    */
}


/**
 * Función principal para imputar las tareas calculadas para un día.
 * @param {Date} fechaParaIncurrir - La fecha en la que se deben incurrir las tareas.
 * @param {Array<object>} tareasAIncurrir - Lista de tareas calculada por getTareasParaDia_v2_3.
 */
async function incurrirTareas(fechaParaIncurrir, tareasAIncurrir) {
    // Asegurarse de que las dependencias estén disponibles
    if (typeof requestPageToast !== 'function' || typeof getHorasActuales !== 'function' || typeof sleep !== 'function' ||
        typeof waitForElement !== 'function' || typeof waitForCondition !== 'function') {
         console.error("[Incurrir] Faltan funciones auxiliares (toast, utils).");
         if(typeof requestPageToast === 'function') requestPageToast("Error interno: Faltan funciones auxiliares.", "error");
         return;
     }

    console.log(`[Incurrir] Iniciando proceso para ${fechaParaIncurrir.toLocaleDateString()} con ${tareasAIncurrir.length} tareas.`);

    if (tareasAIncurrir.length === 0) {
        console.log("[Incurrir] No hay tareas para incurrir hoy.");
        // No mostramos toast aquí, getTareasParaDia ya lo haría si es finde, etc.
        return;
    }

    // Comprobar si ya se ha incurrido suficiente tiempo (sin cambios)
    const totalMinutesToIncur = tareasAIncurrir.reduce((acc, tarea) => {
        const horas = parseInt(tarea.horas, 10) || 0;
        const minutos = parseInt(tarea.minutos, 10) || 0;
        return acc + (horas * 60) + minutos;
    }, 0);
    const currentHoursText = getHorasActuales();
    const [currentH, currentM] = currentHoursText.split(':').map(n => parseInt(n, 10));
    const currentMinutesIncurred = (currentH * 60) + currentM;

    if (currentMinutesIncurred >= totalMinutesToIncur) {
        requestPageToast(`Ya se han incurrido ${currentHoursText} horas o más. Proceso detenido.`, "info");
        return;
    }

    let tareaCounter = 1;
    for (const tarea of tareasAIncurrir) {
         // Validar que la tarea tenga horas > 0 antes de intentar incurrirla
         const taskMinutes = (parseInt(tarea.horas, 10) || 0) * 60 + (parseInt(tarea.minutos, 10) || 0);
         if (taskMinutes <= 0) {
             console.log(`[Incurrir] Saltando Tarea ${tareaCounter} (${tarea.nombre} - ${tarea.codigoProyecto}) porque tiene 0 horas.`);
             tareaCounter++;
             continue;
         }

        console.log(`\n[Incurrir] --- TAREA ${tareaCounter}/${tareasAIncurrir.length}: ${tarea.nombre} (${tarea.codigoProyecto}) - ${tarea.horas}h ${tarea.minutos}m) ---`);
        const horasAntesDeIncurrir = getHorasActuales();

        try {
            const dropdown = await waitForElement('.formio-component-select .choices');
            const selectionBox = dropdown.querySelector('.choices__list--single');
            dropdown.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

            // Usamos findElementByText de utils.js
            const textosABuscar = [`[${tarea.nombre}]`, tarea.codigoProyecto];
            const opcionSeleccionar = await waitForElement('div.choices__item[role="option"]', textosABuscar, dropdown);

            opcionSeleccionar.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            opcionSeleccionar.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

            await waitForCondition(() => selectionBox.textContent.trim().includes(tarea.nombre), 5000, `selección de '${tarea.nombre}'`);

            const hoursInput = document.querySelector('input[name="data[container1][horas]"]');
            hoursInput.value = tarea.horas;
            hoursInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

            const minutesInput = document.querySelector('input[name="data[container1][minutos]"]');
            minutesInput.value = tarea.minutos;
            minutesInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

            await sleep(300);

            const incurrirButton = document.querySelector('button.incurrirBoton');
            incurrirButton.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            incurrirButton.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

            await waitForCondition(() => {
                const horasActuales = getHorasActuales();
                return horasActuales !== horasAntesDeIncurrir && /^\d{2}:\d{2}$/.test(horasActuales);
            }, 10000, "actualización del contador de horas");

            console.log(`[Incurrir] [ÉXITO] Tarea ${tareaCounter} incurrida.`);

        } catch (error) {
             console.error(`[Incurrir] ERROR al procesar la tarea ${tareaCounter} (${tarea.nombre} - ${tarea.codigoProyecto}):`, error);
             requestPageToast(`Error al incurrir tarea: ${tarea.nombre} (${tarea.codigoProyecto}). ${error.message}`, "error", 6000);
             // Decidimos si continuar con la siguiente tarea o detener todo el proceso
             // Por ahora, continuamos
             // return; // Descomentar para detener en caso de error
        }

        tareaCounter++;
    }
    await sleep(300);
    requestPageToast("¡Proceso de incurrido completado!", "success");
}
console.log("incurrir.js loaded"); // Para depuración

// --- Función placeholder para el algoritmo V2.3 ---
function calcularHorasConPatron(fecha, horasTotalesNum, reglasActivasHoy, horasEsperadasDiariasConfig) {
     console.warn("Función calcularHorasConPatron NO IMPLEMENTADA");
     // Aquí iría toda la lógica de calcular días laborables de la semana,
     // determinar la posición del día, aplicar el patrón, etc.
     // Devolvería: [{ proyectoIndex: 0, horas: 1, minutos: 0 }, ...]
     return [];
 }