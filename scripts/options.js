// scripts/options.js v2.5 (Pre-cálculo + Vista Semanal + Simplificado)

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const projectList = document.getElementById('project-list');
    const projectTemplate = document.getElementById('project-template');
    const exportBtn = document.getElementById('export-btn');
    const clearAllBtn = document.getElementById('clear-all-config-btn');
    const importJsonBtn = document.getElementById('import-json-btn');
    const importJsonFileInput = document.getElementById('import-json-file');
    const employeeIdInput = document.getElementById('employee-id');
    const importCsvBtn = document.getElementById('import-csv-btn');
    const importCsvFileInput = document.getElementById('import-csv-file');
    const statusEl = document.getElementById('status');
    const summarySdaEl = document.getElementById('summary-sda');
    const summaryTechEl = document.getElementById('summary-tecnologia');
    const summaryProyectosCountEl = document.getElementById('summary-proyectos-count');
    const summaryDiasCountEl = document.getElementById('summary-dias-count');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const currentWeekDisplayEl = document.getElementById('current-week-display');
    const weeklyPlanContainerEl = document.getElementById('weekly-plan-container');
    const technologyInput = document.getElementById('common-technology');

    // Estructura v2.5: planDiario contiene horas calculadas
    const defaultConfig = {
        proyectos: [], // Array de { codigo: string }
        sdaComun: "",
        tecnologiaComun: "",
        horasEsperadasDiarias: {}, // Objeto { 'YYYY-MM-DD': 'horas/codigo', ... }
        planDiario: {}, // Objeto { 'YYYY-MM-DD': [{ proyectoIndex, tipoTarea, horas, minutos }, ...], ... } // Horas PRE-CALCULADAS
        employeeId: "" // ID del empleado guardado
    };

    let currentProyectos = []; let currentSdaComun = "";
    let currentConfigData = defaultConfig; // Mantiene la config completa
    let currentWeekStartDate = null;

    // Mapeo de iniciales CSV a Tipos de Tarea y orden
    const tipoTareaMap = { 'a': 'Diseño', 'z': 'Construcción', 'm': 'Pruebas', 'v': 'Despliegue' };
    const tipoTareaOrder = { 'Diseño': 1, 'Construcción': 2, 'Pruebas': 3, 'Despliegue': 4 };

    // --- FUNCIONES AUXILIARES FECHAS ---
    /** Obtiene el lunes de la semana que contiene la fecha dada */
    function getMonday(d) {
        d = new Date(d); d.setHours(0,0,0,0);
        const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }
    /** Formatea una fecha como YYYY-MM-DD localmente */
    function formatDateYYYYMMDD(date) {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // --- FUNCIÓN DE CÁLCULO (LOCAL A OPTIONS.JS) ---
    /**
     * CALCULA horas/minutos (v2.5: Número = Horas Fijas exactas, Solo Color = Reparto).
     * @param {Date} fecha - Objeto Date del día (medianoche local).
     * @param {object} configBase - Configuración con planDiario BRUTO {proyectos, sdaComun, horasEsperadasDiarias, planDiario: {..., valorCSV}}.
     * @returns {object|null} - Objeto { proyectoIndex: {horas: string, minutos: string} } o null si no laborable.
     */
    function calcularHorasParaDia_v2_5(fecha, configBase) {
        fecha = new Date(fecha); fecha.setHours(0, 0, 0, 0);
        const todayStr = formatDateYYYYMMDD(fecha);

        if (!configBase || !configBase.proyectos || !configBase.horasEsperadasDiarias || !configBase.planDiario) {
            console.error("[Calc Horas v2.5 Options] Config inválida para cálculo."); return null;
        }

        const horasEsperadasHoyStr = (configBase.horasEsperadasDiarias[todayStr] || '').toUpperCase();
        if (!horasEsperadasHoyStr || isNaN(parseInt(horasEsperadasHoyStr, 10))) { return null; }
        const horasTotalesNum = parseInt(horasEsperadasHoyStr, 10);
        if (horasTotalesNum <= 0) { return {}; }
        let minutosTotalesDia = horasTotalesNum * 60;

        const reglasBrutasDelDia = configBase.planDiario[todayStr] || []; // Usar planDiario BRUTO
        if (reglasBrutasDelDia.length === 0) { return {}; }

        let totalMinutosFijos = 0;
        const participantesRepartoIndices = [];
        const minutosFijosPorProyecto = {};

        reglasBrutasDelDia.forEach(regla => {
            const idx = regla.proyectoIndex;
            if (idx === undefined || idx < 0 || idx >= configBase.proyectos.length) return;
            const valor = regla.valorCSV || ''; // Leer valorCSV
            const valorLower = valor.toLowerCase();
            const matchNumero = valor.match(/(\d+(\.\d+)?)/); // Número al inicio o solo
            const horasFijasNum = matchNumero ? parseFloat(matchNumero[1]) : 0;
            const tieneColor = regla.tipoTarea !== null; // tipoTarea solo se setea si hay inicial de color

            if (horasFijasNum > 0) { // Si hay número, son horas fijas
                const minutosFijos = Math.round(horasFijasNum * 60);
                minutosFijosPorProyecto[idx] = minutosFijos;
                totalMinutosFijos += minutosFijos;
            } else if (tieneColor) { // Si NO hay número Y SÍ tiene color -> participa en reparto
                participantesRepartoIndices.push(idx);
            }
            // Caso '1Az': Ya se asignó fijo, NO participa en reparto con esta lógica
        });

        let minutosARepartir = minutosTotalesDia - totalMinutosFijos;
        if (minutosARepartir < 0) minutosARepartir = 0;
        let minutosRepartoIndividual = 0;
        if (participantesRepartoIndices.length > 0 && minutosARepartir > 0) {
            minutosRepartoIndividual = minutosARepartir / participantesRepartoIndices.length;
        } else if (minutosARepartir > 0) {
             console.warn(`[Calc Options v2.5] ${todayStr}: Sobraron ${minutosARepartir} min.`);
        }

        const resultadoCalculado = {};
        let minutosTotalesAsignados = 0;
        // Iterar sobre los índices de las reglas originales para mantener consistencia
        const proyectosDelDia = [...new Set(reglasBrutasDelDia.map(r => r.proyectoIndex).filter(idx => idx !== undefined))];

        proyectosDelDia.forEach(idx => {
            let minutosFinales = minutosFijosPorProyecto[idx] || 0;
            if (participantesRepartoIndices.includes(idx)) {
                minutosFinales += minutosRepartoIndividual;
            }
            const minutosFinalesRedondeados = Math.round(minutosFinales);
            minutosTotalesAsignados += minutosFinalesRedondeados;
            if (minutosFinalesRedondeados > 0) {
                resultadoCalculado[idx] = {
                    horas: String(Math.floor(minutosFinalesRedondeados / 60)),
                    minutos: String(minutosFinalesRedondeados % 60)
                };
            }
        });

        // Verificación redondeo (opcional)
        if (Math.abs(minutosTotalesAsignados - minutosTotalesDia) > 1 && participantesRepartoIndices.length > 0) { /* ... warning ... */ }

        return resultadoCalculado; // Devuelve { "0": {h, m}, "2": {h, m}, ... }
    }


    // --- RENDERIZACIÓN ---
    function renderProjectList(proyectos = [], sdaGlobal = "", tecnologiaGlobal = "") {
        projectList.innerHTML = '';
        currentProyectos = [];
    currentSdaComun = sdaGlobal;
        if (!proyectos || !proyectos.length) {
            projectList.innerHTML = '<p style="text-align: center; color: #888;">Proyectos aparecerán aquí tras importar.</p>'; return;
        };
        proyectos.forEach((proj, index) => {
            currentProyectos.push({ codigo: proj.codigo });
            const row = projectTemplate.content.cloneNode(true).querySelector('.rule-row');
            row.dataset.index = index;
            row.querySelector('.project-codigo').value = proj.codigo || '';
            const sdaDisplay = row.querySelector('.project-sda-display');
            if (sdaDisplay) {
                const infoParts = [];
                if (sdaGlobal) infoParts.push(`SDA: ${sdaGlobal}`);
                if (tecnologiaGlobal) infoParts.push(`Tech: ${tecnologiaGlobal}`);
                sdaDisplay.textContent = infoParts.length ? `(${infoParts.join(' · ')})` : '';
            }
            projectList.appendChild(row);
        });
    }

    // Renderiza la vista semanal (Lun-Vie) usando planDiario (que ya tiene horas calculadas)
    function renderWeeklyPlanView() {
        if (!currentWeekStartDate || !currentConfigData || !currentConfigData.planDiario) {
             weeklyPlanContainerEl.innerHTML = `...`; /* Placeholder */ return;
        }

        const weekStart = new Date(currentWeekStartDate); weekStart.setHours(0, 0, 0, 0);
        const weekFullEnd = new Date(weekStart); weekFullEnd.setDate(weekStart.getDate() + 6);
        currentWeekDisplayEl.textContent = `Semana del ${weekStart.toLocaleDateString(/*...*/)} al ${weekFullEnd.toLocaleDateString(/*...*/)}`;
        weeklyPlanContainerEl.innerHTML = '';
        const daysHeader = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

        for (let i = 0; i < 5; i++) {
            const dayDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
            dayDate.setHours(12, 0, 0, 0);
            const dayStrYYYYMMDD = formatDateYYYYMMDD(dayDate); // YYYY-MM-DD
            const dayName = daysHeader[i];
            const dayColumn = document.createElement('div'); dayColumn.classList.add('day-column');

            const horasEsperadas = (currentConfigData.horasEsperadasDiarias[dayStrYYYYMMDD] || '').toUpperCase();
            // --- USA planDiario (que ahora tiene horas calculadas) ---
            const planCalculadoDelDia = currentConfigData.planDiario[dayStrYYYYMMDD] || [];
            // --- FIN CAMBIO ---

            let horasDisplay = horasEsperadas || '-';
            let isWorkDay = !isNaN(parseInt(horasEsperadas, 10)) && parseInt(horasEsperadas, 10) > 0;
            let specialDayText = null;

                        // Añadir clases CSS y determinar texto especial
            if (!isWorkDay) {
                 dayColumn.classList.add('non-workday');
                 if (horasEsperadas === 'V') { dayColumn.classList.add('day-vacation'); specialDayText = 'VACACIONES'; }
                 else if (horasEsperadas === 'F') { dayColumn.classList.add('day-holiday'); specialDayText = 'FESTIVO'; }
                 else if (horasEsperadas === '') { horasDisplay = '-'; }
                 else { horasDisplay = horasEsperadas; } // Mantener S o D si existieran (aunque no se muestran)
            }

            // Mostrar cabecera del día
            dayColumn.innerHTML = `<h5>${dayName} ${dayDate.getDate()}</h5>`;

            // Si es día especial (V o F), mostrar texto grande y centrado
            if (specialDayText) {
                dayColumn.innerHTML += `<div class="holiday-vacation-text">${specialDayText}</div>`;
            } else { // Mostrar horas y tareas
                dayColumn.innerHTML += `<span class="horas">(${horasDisplay}${isWorkDay?'h':''})</span>`;
                // Mostrar tareas si es laborable Y hay plan calculado
                if (isWorkDay && planCalculadoDelDia.length > 0) {
                    const taskList = document.createElement('ul');
                    // Ordenar tareas calculadas
                    planCalculadoDelDia.sort((a, b) => {
                        const typeA = a.tipoTarea || ''; const typeB = b.tipoTarea || '';
                        return (tipoTareaOrder[typeA] || 99) - (tipoTareaOrder[typeB] || 99);
                    });

                    planCalculadoDelDia.forEach(tareaCalc => { // tareaCalc = { proyectoIndex, tipoTarea, horas, minutos }
                        const proyecto = currentConfigData.proyectos[tareaCalc.proyectoIndex];
                        // Mostrar solo si tenemos proyecto Y tiempo > 0
                        if (proyecto && (parseInt(tareaCalc.horas)>0 || parseInt(tareaCalc.minutos)>0)) {
                            const li = document.createElement('li');
                            let tipoTareaLimpio = 'default';
                            if (tareaCalc.tipoTarea) {
                                switch (tareaCalc.tipoTarea.toLowerCase()) {
                                    case 'diseño': tipoTareaLimpio = 'diseno'; break;
                                    case 'construcción': tipoTareaLimpio = 'construccion'; break;
                                    case 'pruebas': tipoTareaLimpio = 'pruebas'; break;
                                    case 'despliegue': tipoTareaLimpio = 'despliegue'; break;
                                }
                            }
                            li.classList.add(`tarea-${tipoTareaLimpio}`);
                            // Mostrar Horas Calculadas
                            const tiempoStr = `${tareaCalc.horas}h ${tareaCalc.minutos}m`;
                            li.innerHTML = `${proyecto.codigo}<span class="tipo-imputacion">${tiempoStr}</span>`;
                            taskList.appendChild(li);
                        } else if (!proyecto) {
                             console.warn(`Proyecto índice ${tareaCalc.proyectoIndex} no encontrado para ${dayStrYYYYMMDD} en planDiario.`);
                        }
                    }); // fin forEach tareaCalc

                    if (taskList.children.length > 0) dayColumn.appendChild(taskList);
                    else dayColumn.innerHTML += '<span class="no-plan">(0h calc.)</span>';

                } else if (isWorkDay) { // Laborable pero sin plan calculado
                    dayColumn.innerHTML += '<span class="no-plan">(Sin plan/0h)</span>';
                } else if (horasDisplay !== '-') {
                     dayColumn.innerHTML += `<span class="no-plan">${horasDisplay}</span>`;
                }
            } // Fin else (no es V o F)
            weeklyPlanContainerEl.appendChild(dayColumn);
        } // Fin for
         const hasPlan = Object.keys(currentConfigData.planDiario || {}).length > 0; // Usar planDiario
         prevWeekBtn.disabled = !hasPlan; nextWeekBtn.disabled = !hasPlan;
    }

    // Renderiza Proyectos y Resumen + Vista Semanal
    function render(config, source = 'load') {
        if (!config) config = defaultConfig;
        currentConfigData = config; // Guardar config completa
        renderProjectList(config.proyectos, config.sdaComun, config.tecnologiaComun);
        summarySdaEl.textContent = config.sdaComun || 'No definido';
        if (summaryTechEl) summaryTechEl.textContent = config.tecnologiaComun ? config.tecnologiaComun : 'No definida';
        if (technologyInput) technologyInput.value = config.tecnologiaComun || '';
        if (employeeIdInput) employeeIdInput.value = config.employeeId || '';
        summaryProyectosCountEl.textContent = config.proyectos?.length || 0;
        const planDaysCount = Object.keys(config.planDiario || {}).length; // Contar días en planDiario
        summaryDiasCountEl.textContent = planDaysCount;
        if (source === 'load' || source === 'import') {
            const sortedPlanDays = Object.keys(config.planDiario || {}).sort();
            if (sortedPlanDays.length) {
                const today = new Date(); today.setHours(12, 0, 0, 0);
                const firstDate = new Date(sortedPlanDays[0] + 'T12:00:00');
                const lastDate = new Date(sortedPlanDays[sortedPlanDays.length - 1] + 'T12:00:00');

                let baseDate = today;
                if (isNaN(today.getTime())) {
                    baseDate = firstDate;
                } else if (!isNaN(firstDate.getTime()) && today < firstDate) {
                    baseDate = firstDate;
                } else if (!isNaN(lastDate.getTime()) && today > lastDate) {
                    baseDate = lastDate;
                }

                currentWeekStartDate = getMonday(baseDate);
            } else {
                currentWeekStartDate = getMonday(new Date());
            }
        }

        if ((!currentWeekStartDate || isNaN(currentWeekStartDate.getTime())) && planDaysCount > 0) {
            const sortedPlanDays = Object.keys(config.planDiario || {}).sort();
            if (sortedPlanDays.length) {
                const fallbackDate = new Date(sortedPlanDays[0] + 'T12:00:00');
                if (!isNaN(fallbackDate.getTime())) {
                    currentWeekStartDate = getMonday(fallbackDate);
                }
            }
        }
        renderWeeklyPlanView(); // Renderizar usando currentConfigData (que tiene planDiario con horas)
    }

    // --- GUARDADO Y CARGA ---
    // Guarda la configuración COMPLETA (planDiario ya tiene horas calculadas)
    function saveOptions(configToSave) {
        // Validar estructura v2.5
        if (!configToSave || !configToSave.proyectos || configToSave.sdaComun === undefined ||
            configToSave.tecnologiaComun === undefined ||
            configToSave.horasEsperadasDiarias === undefined || configToSave.planDiario === undefined) {
             if(window.showToast) window.showToast('Error: Configuración inválida V2.5.', 'error');
             console.error("Config inválida para guardar:", configToSave); return;
        }
        // Ya no necesitamos precalcular aquí, se hizo durante la importación
        chrome.storage.sync.set({ configV2: configToSave }, () => {
            if (window.showToast) window.showToast('¡Configuración guardada!', 'success');
            render(configToSave, 'save'); // Re-renderizar DESPUÉS de guardar
        });
    }
     // Carga la configuración completa y renderiza
    function restoreOptions() {
        chrome.storage.sync.get({ configV2: defaultConfig }, items => {
            const storedConfig = items.configV2 || defaultConfig;
            const normalizedConfig = {
                ...defaultConfig,
                ...storedConfig,
                proyectos: storedConfig.proyectos || defaultConfig.proyectos,
                horasEsperadasDiarias: storedConfig.horasEsperadasDiarias || defaultConfig.horasEsperadasDiarias,
                planDiario: storedConfig.planDiario || defaultConfig.planDiario,
                employeeId: storedConfig.employeeId || defaultConfig.employeeId
            };
            if (normalizedConfig.tecnologiaComun === undefined) normalizedConfig.tecnologiaComun = '';
            render(normalizedConfig, 'load');
        });
    }

    // --- IMPORTAR / EXPORTAR JSON ---
    function exportConfig() {
        chrome.storage.sync.get({ configV2: defaultConfig }, items => {
            const configToExport = items.configV2 || defaultConfig; // Exportar config actual o default
            const dataStr = JSON.stringify(configToExport, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const a = document.createElement('a');
            a.href = url; a.download = 'axet-autoincurrido-config-v2.json';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (window.showToast) window.showToast('Configuración exportada a JSON.', 'info');
        });
    }
    function importConfigJson(event) {
         const file = event.target.files[0]; if (!file) return;
         const reader = new FileReader();
         reader.onload = (e) => {
             try {
                 const importedConfig = JSON.parse(e.target.result);
                 // Validar estructura v2.5
                 if (importedConfig.proyectos && importedConfig.sdaComun !== undefined &&
                     importedConfig.horasEsperadasDiarias !== undefined && importedConfig.planDiario !== undefined) {
                     if (importedConfig.tecnologiaComun === undefined) {
                         importedConfig.tecnologiaComun = '';
                     }
                     // Asumimos que el JSON importado ya tiene las horas calculadas en planDiario
                     saveOptions(importedConfig); // Guardar Y renderizar
                     if (window.showToast) window.showToast('¡Config JSON importada y guardada!', 'success');
                 } else { throw new Error('Formato V2.5 incorrecto.'); }
             } catch (error) { if (window.showToast) window.showToast(`Error import JSON: ${error.message}`, 'error'); }
             finally { importJsonFileInput.value = ''; }
         };
         reader.readAsText(file);
     }

    // --- LÓGICA: IMPORTAR Y PRE-CALCULAR DESDE CSV ---
    function parseCsvAndExtractData(file, employeeId) {
        if (!employeeId) { if (window.showToast) window.showToast('Introduce tu ID.', 'error'); return; }
        if (!window.Papa) { if (window.showToast) window.showToast('Error: PapaParse no cargado.', 'error'); return; }
        // Verificar si la función de cálculo está disponible ANTES de parsear
        if (typeof calcularHorasParaDia_v2_5 !== 'function') { // Asegurarse que usa la v2.5
            console.error("Error: Falta calcularHorasParaDia_v2_5 para pre-cálculo.");
            if(window.showToast) window.showToast("Error interno: Falta función de cálculo v2.5.", "error"); return;
         }

        Papa.parse(file, {
            complete: (results) => {
                try {
                    console.log("CSV Parseado:", results.data);
                    // 1. Extraer datos brutos (planDiario con valorCSV)
                    const extractedDataRaw = findEmployeeDataAndPlanInCsv(results.data, employeeId.trim().toUpperCase());
                    if (!extractedDataRaw || !extractedDataRaw.proyectos || extractedDataRaw.proyectos.length === 0) {
                        if (window.showToast) window.showToast(`No se encontraron datos válidos para ID ${employeeId}.`, 'error', 5000); return;
                    }
                    console.log("Datos brutos extraídos:", extractedDataRaw);

                    // 2. Pre-calcular las horas
                    console.log("[Import CSV] Iniciando pre-cálculo de horas v2.5...");
                    const planCalculadoFinal = {};
                    const configBase = { // Config necesaria para la función de cálculo
                        proyectos: extractedDataRaw.proyectos,
                        horasEsperadasDiarias: extractedDataRaw.horasEsperadasDiarias,
                        planDiario: extractedDataRaw.planDiario // Pasar el plan bruto con valorCSV
                    };
                    // Iterar sobre los días del plan BRUTO
                    for (const dateStr in extractedDataRaw.planDiario) {
                         if (Object.hasOwnProperty.call(extractedDataRaw.planDiario, dateStr)) {
                             try {
                                 const fecha = new Date(dateStr + 'T12:00:00'); // Mediodía local
                                 if (isNaN(fecha)) continue;
                                 // Calcular horas para este día usando v2.5
                                 const horasCalculadasDia = calcularHorasParaDia_v2_5(fecha, configBase); // LLAMADA A v2.5

                                 if (horasCalculadasDia && Object.keys(horasCalculadasDia).length > 0) {
                                     // Formatear para el planDiario final
                                     const planFinalDia = [];
                                     const planBrutoDia = extractedDataRaw.planDiario[dateStr] || [];
                                     for (const idx in horasCalculadasDia) {
                                         const tiempo = horasCalculadasDia[idx];
                                         const reglaOriginal = planBrutoDia.find(r => r.proyectoIndex == idx);
                                         if (reglaOriginal) {
                                             planFinalDia.push({
                                                 proyectoIndex: parseInt(idx, 10),
                                                 tipoTarea: reglaOriginal.tipoTarea,
                                                 horas: tiempo.horas, // Guardar horas calculadas
                                                 minutos: tiempo.minutos // Guardar minutos calculados
                                             });
                                         }
                                     }
                                     if (planFinalDia.length > 0) {
                                         planCalculadoFinal[dateStr] = planFinalDia;
                                     }
                                 }
                             } catch (e) { console.error(`[Import CSV] Error pre-calculando ${dateStr}:`, e); }
                         }
                    }
                    console.log("[Import CSV] Pre-cálculo v2.5 completado.");

                    // 3. Construir la nueva configuración FINAL
                    const newConfigFinal = {
                        proyectos: extractedDataRaw.proyectos,
                        sdaComun: extractedDataRaw.sdaComun,
                        tecnologiaComun: currentConfigData.tecnologiaComun || "",
                        horasEsperadasDiarias: extractedDataRaw.horasEsperadasDiarias,
                        planDiario: planCalculadoFinal, // Guardar el plan CON horas calculadas
                        employeeId: employeeId.trim().toUpperCase() // Guardar el employee ID
                        // Ya no existe reglasPlanificacion
                    };

                    saveOptions(newConfigFinal); // Guardar Y renderizar
                    if (window.showToast) window.showToast(`¡${extractedDataRaw.proyectos.length} proyectos y plan diario importados y calculados!`, 'success', 5000);

                } catch (error) {
                    console.error("Error procesando CSV:", error);
                    if (window.showToast) window.showToast(`Error al procesar CSV: ${error.message}`, 'error', 5000);
                }
            },
            error: (error) => {
                 console.error("Error al parsear CSV:", error);
                 if (window.showToast) window.showToast(`Error al leer CSV: ${error.message}`, 'error');
            }
        });
    }
    // Función que extrae datos del CSV (devuelve planDiario con valorCSV)
    function findEmployeeDataAndPlanInCsv(data, employeeId) {
        let employeeRowIndex = -1; let headerRow = []; let headerIndex = -1;
        let dateColumns = {}; const projects = []; // Array para orden
        let sdaComun = ""; let horasRow = []; const planDiario = {}; let foundHorasRow = false;

        // 1. Encontrar encabezados y parsear fechas
        for (let i = 0; i < data.length; i++) {
            const rowData = Array.isArray(data[i]) ? data[i] : [];
            const lowerCaseRow = rowData.map(cell => (cell || '').trim().toLowerCase());
            if (lowerCaseRow.includes('usuario')) {
                headerRow = rowData.map(cell => (cell || '').trim()); headerIndex = i;
                console.log(`[CSV Parser] Encabezados en fila ${headerIndex + 1}.`); break;
            }
        }
        if (headerIndex === -1) throw new Error('Fila de encabezados no encontrada (buscando "Usuario").');
        const lowerHeader = headerRow.map(h => h.toLowerCase());
        const userIdCol = lowerHeader.indexOf('usuario'); const sdaCol = lowerHeader.indexOf('sdatool'); const featureCol = lowerHeader.indexOf('feature');
        if (userIdCol === -1 || sdaCol === -1 || featureCol === -1) throw new Error('Columnas "Usuario", "SDATool" o "Feature" no encontradas.');
        // Parsear fechas
        let currentMonthStr = ""; let currentYear = "";
        const monthMap = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
        const monthYearRow = (Array.isArray(data[0]) ? data[0] : []).map(cell => (cell || '').trim().toLowerCase());
        const dayRow = headerRow;
        for (let j = featureCol + 1; j < monthYearRow.length; j++) {
            if (j >= dayRow.length) continue;
            const monthYearCell = monthYearRow[j] || ''; const dayCell = dayRow[j] || '';
            const monthMatch = monthYearCell.match(/(\w+)\s+(\d{4})/);
            if (monthMatch && monthMatch[1] in monthMap) { currentMonthStr = monthMatch[1]; currentYear = monthMatch[2]; }
            const day = parseInt(dayCell, 10);
            if (currentYear && currentMonthStr && monthMap[currentMonthStr] !== undefined && !isNaN(day) && day >= 1 && day <= 31) {
                const monthIndex = monthMap[currentMonthStr];
                const dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                dateColumns[j] = dateStr;
            }
        }
        console.log("[CSV Parser] Mapeo Columnas->Fechas:", dateColumns);

        // 2. Buscar empleado, extraer datos manteniendo orden
        for (let i = headerIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!Array.isArray(row) || row.length <= Math.max(userIdCol, sdaCol, featureCol) || row.every(cell => (cell || '').trim() === '')) continue;
            const currentUserId = (row[userIdCol] || '').trim().toUpperCase();
            const currentFeature = (row[featureCol] || '').trim();
            const sdaCompleto = (row[sdaCol] || '').trim();
            const codigo = currentFeature;
            const isHorasEsperadasRow = currentFeature.toLowerCase() === 'horas esperadas';
            let isEmployeeRow = (employeeRowIndex === -1 && currentUserId === employeeId) || (employeeRowIndex !== -1 && currentUserId === '');

            if (isEmployeeRow) {
                if (employeeRowIndex === -1) employeeRowIndex = i;
                if (!sdaComun && sdaCompleto) {
                    const sdaMatch = sdaCompleto.match(/SDATool-(\d+)/i);
                    if (sdaMatch && sdaMatch[1]) sdaComun = sdaMatch[1];
                }
                let proyectoIndex = projects.findIndex(p => p.codigo === codigo);
                if (codigo && !isHorasEsperadasRow && proyectoIndex === -1) {
                    projects.push({ codigo: codigo });
                    proyectoIndex = projects.length - 1;
                }
                if (codigo && !isHorasEsperadasRow && proyectoIndex !== -1) {
                    for (const colIndex in dateColumns) {
                        if (colIndex >= row.length) continue;
                        const dateStr = dateColumns[colIndex];
                        const cellValue = (row[colIndex] || '').trim(); // Valor RAW
                        if (!cellValue || cellValue.toUpperCase() === 'S' || cellValue.toUpperCase() === 'D') continue;
                        let tipoTarea = null;
                        const cellValueLower = cellValue.toLowerCase();
                        if (cellValueLower !== 'v' && cellValueLower !== 'f') {
                            for (const inicial in tipoTareaMap) {
                                if (cellValueLower.includes(inicial)) { tipoTarea = tipoTareaMap[inicial]; break; }
                            }
                        }
                        if (!planDiario[dateStr]) planDiario[dateStr] = [];
                        if (!planDiario[dateStr].some(p => p.proyectoIndex === proyectoIndex)) {
                             planDiario[dateStr].push({
                                 proyectoIndex: proyectoIndex,
                                 valorCSV: cellValue, // Guardar valor original
                                 tipoTarea: tipoTarea // Guardar tipo si se encontró
                             });
                        }
                    }
                }
                if (isHorasEsperadasRow) { horasRow = row; foundHorasRow = true; }
            } else if (employeeRowIndex !== -1) {
                 if (!foundHorasRow && isHorasEsperadasRow){ horasRow = row; foundHorasRow = true; }
                 if(!isHorasEsperadasRow && currentUserId !== '') { break; }
            }
             if (foundHorasRow && i > employeeRowIndex) break;
        }

        if (employeeRowIndex === -1) return null;
        const horasEsperadas = {};
        if (horasRow.length > 0) {
             for (const colIndex in dateColumns) {
                 if (colIndex < horasRow.length && horasRow[colIndex] !== undefined) {
                     horasEsperadas[dateColumns[colIndex]] = (horasRow[colIndex] || '').trim();
                 }
             }
        }
        console.log("[CSV Parser] Horas Esperadas:", horasEsperadas);
        console.log("[CSV Parser] Proyectos (orden CSV):", projects);
        console.log("[CSV Parser] Plan Diario (con valor CSV):", planDiario);

        return {
            proyectos: projects, // Devuelve el array en orden
            sdaComun: sdaComun,
            horasEsperadasDiarias: horasEsperadas,
            planDiario: planDiario // Devuelve plan con valorCSV
        };
    }


    // --- EVENT LISTENERS ---
    exportBtn.addEventListener('click', exportConfig);
    importJsonBtn.addEventListener('click', () => importJsonFileInput.click());
    importJsonFileInput.addEventListener('change', importConfigJson);
    importCsvBtn.addEventListener('click', () => {
        const employeeId = employeeIdInput.value;
        if (!employeeId) { if (window.showToast) window.showToast('Introduce tu ID.', 'error'); return; }
        importCsvFileInput.click();
    });
    importCsvFileInput.addEventListener('change', (event) => { // Llama a la función actualizada
        const file = event.target.files[0];
        const employeeId = employeeIdInput.value;
        if (file && employeeId) { parseCsvAndExtractData(file, employeeId); }
        event.target.value = ''; // Resetear input
    });

    // Navegación Semanal
    prevWeekBtn.addEventListener('click', () => {
        if (currentWeekStartDate) {
            currentWeekStartDate.setDate(currentWeekStartDate.getDate() - 7);
            renderWeeklyPlanView(); // Re-renderizar solo la semana
        }
    });
    nextWeekBtn.addEventListener('click', () => {
        if (currentWeekStartDate) {
            currentWeekStartDate.setDate(currentWeekStartDate.getDate() + 7);
            renderWeeklyPlanView(); // Re-renderizar solo la semana
        }
    });

    if (technologyInput) {
        technologyInput.addEventListener('input', (event) => {
            if (!summaryTechEl) return;
            const previewValue = event.target.value.trim();
            summaryTechEl.textContent = previewValue || 'No definida';
        });

        technologyInput.addEventListener('change', (event) => {
            const newValue = event.target.value.trim();
            if ((currentConfigData.tecnologiaComun || '') === newValue) return;
            const updatedConfig = {
                ...currentConfigData,
                tecnologiaComun: newValue
            };
            saveOptions(updatedConfig);
        });
    }

    clearAllBtn.addEventListener('click', () => {
        // Show confirmation dialog
        if (confirm("¿Estás MUY seguro de que quieres borrar TODA la configuración guardada?\nEsta acción no se puede deshacer y tendrás que volver a importar tu CSV.")) {
            chrome.storage.sync.clear(() => {
                const error = chrome.runtime.lastError;
                if (error) {
                    console.error("Error al borrar storage:", error);
                    if (window.showToast) window.showToast(`Error al borrar: ${error.message}`, 'error');
                    else statusEl.textContent = `Error al borrar: ${error.message}`;
                } else {
                    console.log('Almacenamiento de la extensión borrado.');
                    if (window.showToast) window.showToast('Configuración borrada.', 'success');
                    else statusEl.textContent = 'Configuración borrada.';

                    // Reset the UI to the default state
                    render(defaultConfig, 'load'); // Call render with the default config object

                    // Also clear the employee ID input field
                    if(employeeIdInput) employeeIdInput.value = '';

                    // Clear status message after a delay
                    setTimeout(() => { if(statusEl) statusEl.textContent = ''; }, 3000);
                }
            });
        } else {
            console.log('Borrado cancelado por el usuario.');
            if (window.showToast) window.showToast('Borrado cancelado.', 'info');
             else statusEl.textContent = 'Borrado cancelado.';
             setTimeout(() => { if(statusEl) statusEl.textContent = ''; }, 2000);
        }
    });

    restoreOptions(); // Carga inicial

    // Fallback Toast
    if (typeof window.showToast === 'undefined' && typeof requestPageToast !== 'function') {
         window.showToast = (message, type = 'info', duration = 4000) => {
             console.log(`[Toast Fallback] (${type}): ${message}`);
         };
     }
});