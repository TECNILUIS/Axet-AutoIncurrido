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
        horasEsperadasOriginales: {}, // Copia de referencia proveniente del CSV
        manualHoursOverrides: {}, // Mapa de días con horas modificadas manualmente
        planDiario: {}, // Objeto { 'YYYY-MM-DD': [{ proyectoIndex, tipoTarea, horas, minutos }, ...], ... } // Horas PRE-CALCULADAS
        planDiarioRaw: {}, // Plan en bruto (valorCSV) utilizado para recalcular
        manualOverrideDays: {}, // Días editados manualmente que no se recalculan
        employeeId: "", // ID del empleado guardado
        overrideEnabled: false, // Toggle para activar/desactivar overrides
        overrideHoursReducido: null, // Override para horario Reducido (Verano/Viernes)
        overrideHoursNormal: null // Override para horario Normal (Resto del año)
    };

    function ensureConfigShape(config) {
        if (!config) return defaultConfig;
        if (!config.planDiario || typeof config.planDiario !== 'object') config.planDiario = {};
        if (!config.planDiarioRaw || typeof config.planDiarioRaw !== 'object') config.planDiarioRaw = {};
        if (!config.manualOverrideDays || typeof config.manualOverrideDays !== 'object') config.manualOverrideDays = {};
        if (!config.horasEsperadasDiarias || typeof config.horasEsperadasDiarias !== 'object') config.horasEsperadasDiarias = {};
        if (!config.horasEsperadasOriginales || typeof config.horasEsperadasOriginales !== 'object') {
            config.horasEsperadasOriginales = { ...(config.horasEsperadasDiarias || {}) };
        }
        if (!config.manualHoursOverrides || typeof config.manualHoursOverrides !== 'object') {
            config.manualHoursOverrides = {};
        }
        if (config.overrideHoursReducido === undefined) config.overrideHoursReducido = null;
        if (config.overrideHoursNormal === undefined) config.overrideHoursNormal = null;
        if (config.overrideEnabled === undefined) config.overrideEnabled = false;
        return config;
    }

    let currentProyectos = []; let currentSdaComun = "";
    let currentConfigData = defaultConfig; // Mantiene la config completa
    let currentWeekStartDate = null;

    // Mapeo de iniciales CSV a Tipos de Tarea y orden
    const tipoTareaMap = { 'a': 'Diseño', 'b': 'Construcción', 'c': 'Pruebas', 'd': 'Despliegue' };
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

    function canonicalizeHoursValue(value) {
        if (value === null || value === undefined) return '';
        const raw = value.toString().trim();
        if (!raw) return '';
        const upper = raw.toUpperCase();
        if (upper === 'V' || upper === 'F') {
            return upper;
        }
        const normalized = raw.replace(',', '.');
        const parsed = parseFloat(normalized);
        if (isNaN(parsed)) {
            return raw;
        }
        const rounded = Math.round(parsed * 100) / 100;
        return Number.isFinite(rounded) ? rounded.toString() : raw;
    }

    function normalizeHoursString(value) {
        const canonical = canonicalizeHoursValue(value);
        if (!canonical || canonical === 'V' || canonical === 'F') {
            return '';
        }
        return canonical;
    }

    function determineDayTypeFromValue(value) {
        const canonical = canonicalizeHoursValue(value);
        if (canonical === 'V') return 'vacaciones';
        if (canonical === 'F') return 'festivo';
        return 'laborable';
    }

    function describeDayValue(value) {
        const canonical = canonicalizeHoursValue(value);
        if (!canonical) return 'Sin valor';
        if (canonical === 'V') return 'Vacaciones (V)';
        if (canonical === 'F') return 'Festivo (F)';
        return `${canonical}h`;
    }

    // --- FUNCIÓN DE CÁLCULO (LOCAL A OPTIONS.JS) ---
    /**
     * CALCULA horas/minutos (v2.7: Número = Horas Fijas exactas, Solo Color = Reparto).
     * @param {Date} fecha - Objeto Date del día (medianoche local).
     * @param {object} configBase - Configuración con planDiario BRUTO {proyectos, sdaComun, horasEsperadasDiarias, planDiario: {..., valorCSV}}.
     * @returns {object|null} - Objeto { proyectoIndex: {horas: string, minutos: string} } o null si no laborable.
     */
    function calcularHorasParaDia_v2_7(fecha, configBase) {
        fecha = new Date(fecha); fecha.setHours(0, 0, 0, 0);
        const todayStr = formatDateYYYYMMDD(fecha);

        if (!configBase || !configBase.proyectos || !configBase.horasEsperadasDiarias || !configBase.planDiario) {
            return null;
        }

        const horasEsperadasHoyStr = (configBase.horasEsperadasDiarias[todayStr] || '').toUpperCase();
        // Normalizar horas esperadas (cambiar coma por punto)
        const horasNorm = horasEsperadasHoyStr.replace(',', '.');
        if (!horasNorm || isNaN(parseFloat(horasNorm))) { return null; }
        
        let horasTotalesNum = parseFloat(horasNorm);
        
        // Apply override based on date (summer/Friday vs rest of year) only if enabled
        if (configBase.overrideEnabled) {
            const dayOfWeek = fecha.getDay();
            const month = fecha.getMonth();
            const day = fecha.getDate();
            const isFriday = dayOfWeek === 5;
            const isSummer = month === 6 || month === 7 || (month === 8 && day <= 15);
            
            if ((isFriday || isSummer) && configBase.overrideHoursReducido !== null && configBase.overrideHoursReducido !== undefined) {
                horasTotalesNum = parseFloat(configBase.overrideHoursReducido);
            } else if (!isFriday && !isSummer && configBase.overrideHoursNormal !== null && configBase.overrideHoursNormal !== undefined) {
                horasTotalesNum = parseFloat(configBase.overrideHoursNormal);
            }
        }
        if (horasTotalesNum <= 0) { return {}; }
        let minutosTotalesDia = Math.round(horasTotalesNum * 60);

        const reglasBrutasDelDia = configBase.planDiario[todayStr] || [];
        if (reglasBrutasDelDia.length === 0) { return {}; }

        let totalMinutosFijos = 0;
        const participantesRepartoIndices = [];
        const minutosFijosPorProyecto = {};

        reglasBrutasDelDia.forEach(regla => {
            const idx = regla.proyectoIndex;
            if (idx === undefined || idx < 0 || idx >= configBase.proyectos.length) return;
            const valor = regla.valorCSV || '';
            
            // --- PARSEO DECIMAL ROBUSTO (4,5 -> 4.5) ---
            // Busca número, permitiendo punto o coma
            const matchNumero = valor.match(/(\d+([.,]\d+)?)/);
            let horasFijasNum = 0;
            
            if (matchNumero) {
                // Reemplazar coma por punto para que JS lo entienda
                const numeroString = matchNumero[0].replace(',', '.');
                horasFijasNum = parseFloat(numeroString);
            }
            // -------------------------------------------

            const tieneColor = regla.tipoTarea !== null;

            if (horasFijasNum > 0) {
                // Convertir horas decimales a minutos (ej: 4.5 * 60 = 270)
                const minutosFijos = Math.round(horasFijasNum * 60);
                minutosFijosPorProyecto[idx] = minutosFijos;
                totalMinutosFijos += minutosFijos;
            } else if (tieneColor) {
                participantesRepartoIndices.push(idx);
            }
        });

        let minutosARepartir = minutosTotalesDia - totalMinutosFijos;
        if (minutosARepartir < 0) minutosARepartir = 0;
        let minutosRepartoIndividual = 0;
        if (participantesRepartoIndices.length > 0 && minutosARepartir > 0) {
            minutosRepartoIndividual = minutosARepartir / participantesRepartoIndices.length;
        }

        const resultadoCalculado = {};
        const proyectosDelDia = [...new Set(reglasBrutasDelDia.map(r => r.proyectoIndex).filter(idx => idx !== undefined))];

        proyectosDelDia.forEach(idx => {
            let minutosFinales = minutosFijosPorProyecto[idx] || 0;
            if (participantesRepartoIndices.includes(idx)) {
                minutosFinales += minutosRepartoIndividual;
            }
            const minutosFinalesRedondeados = Math.round(minutosFinales);
            
            if (minutosFinalesRedondeados > 0) {
                // Convertir minutos totales a Horas y Minutos (ej: 270 -> 4h 30m)
                const h = Math.floor(minutosFinalesRedondeados / 60);
                const m = minutosFinalesRedondeados % 60;
                
                resultadoCalculado[idx] = {
                    horas: String(h),
                    minutos: String(m)
                };
            }
        });

        return resultadoCalculado;
    }

    /**
     * Recalcula planDiario usando el plan en bruto y las reglas actuales (incluyendo overrides).
     * Respeta los días editados manualmente indicados en manualOverrideDays.
     * @param {object} config - Configuración completa actual.
     * @returns {object} Nuevo planDiario calculado.
     */
    function recalculatePlanFromRaw(config) {
        if (!config || !config.planDiarioRaw || !Object.keys(config.planDiarioRaw).length) {
            return config?.planDiario ? { ...config.planDiario } : {};
        }

        const manualDays = config.manualOverrideDays || {};
        const baseCalcConfig = {
            proyectos: config.proyectos,
            horasEsperadasDiarias: config.horasEsperadasDiarias,
            planDiario: config.planDiarioRaw,
            overrideEnabled: config.overrideEnabled,
            overrideHoursReducido: config.overrideHoursReducido,
            overrideHoursNormal: config.overrideHoursNormal
        };

        const planCalculadoFinal = {};
        for (const dateStr of Object.keys(config.planDiarioRaw)) {
            if (manualDays[dateStr] && config.planDiario && config.planDiario[dateStr]) {
                planCalculadoFinal[dateStr] = config.planDiario[dateStr];
                continue;
            }

            const fecha = new Date(dateStr + 'T12:00:00');
            if (isNaN(fecha.getTime())) continue;

            const horasCalculadasDia = calcularHorasParaDia_v2_7(fecha, baseCalcConfig);
            if (!horasCalculadasDia || !Object.keys(horasCalculadasDia).length) continue;

            const planFinalDia = [];
            const planBrutoDia = config.planDiarioRaw[dateStr] || [];

            for (const idx of Object.keys(horasCalculadasDia)) {
                const tiempo = horasCalculadasDia[idx];
                const idxInt = parseInt(idx, 10);
                if (isNaN(idxInt)) continue;
                const reglaOriginal = planBrutoDia.find(r => r.proyectoIndex === idxInt || r.proyectoIndex == idx);
                if (!reglaOriginal) continue;
                planFinalDia.push({
                    proyectoIndex: idxInt,
                    tipoTarea: reglaOriginal.tipoTarea,
                    horas: tiempo.horas,
                    minutos: tiempo.minutos
                });
            }

            if (planFinalDia.length) {
                planCalculadoFinal[dateStr] = planFinalDia;
            }
        }

        if (config.planDiario) {
            for (const dateStr of Object.keys(config.planDiario)) {
                const isManual = manualDays[dateStr];
                const dayAlreadySet = planCalculadoFinal.hasOwnProperty(dateStr);
                const dayExistsInRaw = config.planDiarioRaw.hasOwnProperty(dateStr);
                if ((isManual || !dayExistsInRaw) && !dayAlreadySet) {
                    planCalculadoFinal[dateStr] = config.planDiario[dateStr];
                }
            }
        }

        return planCalculadoFinal;
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStrYYYYMMDD = formatDateYYYYMMDD(today);

        for (let i = 0; i < 5; i++) {
            const dayDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
            dayDate.setHours(12, 0, 0, 0);
            const dayStrYYYYMMDD = formatDateYYYYMMDD(dayDate); // YYYY-MM-DD
            const dayName = daysHeader[i];
            const dayColumn = document.createElement('div'); dayColumn.classList.add('day-column');

            if (dayStrYYYYMMDD === todayStrYYYYMMDD) {
                dayColumn.classList.add('today');
            }
            
            const horasEsperadasRaw = currentConfigData.horasEsperadasDiarias[dayStrYYYYMMDD];
            const horasEsperadas = (horasEsperadasRaw || '').toUpperCase();
            // --- USA planDiario (que ahora tiene horas calculadas) ---
            const planCalculadoDelDia = currentConfigData.planDiario[dayStrYYYYMMDD] || [];
            // --- FIN CAMBIO ---

            let horasDisplay = horasEsperadas || '-';
            let isWorkDay = !isNaN(parseInt(horasEsperadas, 10)) && parseInt(horasEsperadas, 10) > 0;
            let specialDayText = null;
            const manualHoursOverride = currentConfigData.manualHoursOverrides && currentConfigData.manualHoursOverrides[dayStrYYYYMMDD];

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
                if (manualHoursOverride) {
                    dayColumn.innerHTML += `<span class="manual-hours-pill" title="Horas ajustadas manualmente">Manual</span>`;
                }
            } else { // Mostrar horas y tareas
                // Calculate if override is active for this day
                let tooltipText = '';
                if (isWorkDay && currentConfigData && currentConfigData.overrideEnabled) {
                    const dayOfWeek = dayDate.getDay();
                    const month = dayDate.getMonth();
                    const day = dayDate.getDate();
                    const isFriday = dayOfWeek === 5;
                    const isSummer = month === 6 || month === 7 || (month === 8 && day <= 15);
                    
                    const originalHours = horasEsperadas.replace(',', '.');
                    let overrideValue = null;
                    
                    if ((isFriday || isSummer) && currentConfigData.overrideHoursReducido !== null && currentConfigData.overrideHoursReducido !== undefined) {
                        overrideValue = currentConfigData.overrideHoursReducido;
                    } else if (!isFriday && !isSummer && currentConfigData.overrideHoursNormal !== null && currentConfigData.overrideHoursNormal !== undefined) {
                        overrideValue = currentConfigData.overrideHoursNormal;
                    }
                    
                    if (overrideValue !== null && originalHours && !isNaN(parseFloat(originalHours))) {
                        tooltipText = `CSV: ${originalHours}h → Override: ${overrideValue}h`;
                        horasDisplay = String(overrideValue);
                    }
                }
                
                const hoursSpan = tooltipText ? `<span class="horas" title="${tooltipText}">(${horasDisplay}${isWorkDay?'h':''})</span>` : `<span class="horas">(${horasDisplay}${isWorkDay?'h':''})</span>`;
                dayColumn.innerHTML += hoursSpan;
                if (manualHoursOverride) {
                    dayColumn.innerHTML += `<span class="manual-hours-pill" title="Horas ajustadas manualmente">Manual</span>`;
                }
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
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'day-actions';
            const dayTypeForActions = determineDayTypeFromValue(horasEsperadasRaw);
            const canAddTasks = dayTypeForActions === 'laborable' || horasEsperadas === '' || !!manualHoursOverride;
            let actionsHtml = `
                <button class="day-action-btn edit-btn" data-date="${dayStrYYYYMMDD}" title="Editar día">✏️</button>
            `;
            if (canAddTasks) {
                actionsHtml += `
                    <button class="day-action-btn add-btn" data-date="${dayStrYYYYMMDD}" title="Añadir tarea">➕</button>
                `;
            }
            actionsDiv.innerHTML = actionsHtml;
            dayColumn.appendChild(actionsDiv);
            
            weeklyPlanContainerEl.appendChild(dayColumn);
        } // Fin for
         const hasPlan = Object.keys(currentConfigData.planDiario || {}).length > 0; // Usar planDiario
         prevWeekBtn.disabled = !hasPlan; nextWeekBtn.disabled = !hasPlan;
    }

    // Renderiza Proyectos y Resumen + Vista Semanal
    function render(config, source = 'load') {
        if (!config) config = defaultConfig;
        config = ensureConfigShape(config);
        currentConfigData = config; // Guardar config completa
        renderProjectList(config.proyectos, config.sdaComun, config.tecnologiaComun);
        summarySdaEl.textContent = config.sdaComun || 'No definido';
        if (summaryTechEl) summaryTechEl.textContent = config.tecnologiaComun ? config.tecnologiaComun : 'No definida';
        if (technologyInput) technologyInput.value = config.tecnologiaComun || '';
        if (employeeIdInput) employeeIdInput.value = config.employeeId || '';
        
        // Update override inputs and toggle
        const overrideEnabledInput = document.getElementById('override-enabled');
        const overrideSummerFridayInput = document.getElementById('override-hours-summer-friday');
        const overrideRestOfYearInput = document.getElementById('override-hours-rest-of-year');
        const overrideTable = document.getElementById('override-table');
        
        if (overrideEnabledInput) {
            overrideEnabledInput.checked = config.overrideEnabled || false;
        }
        if (overrideSummerFridayInput) {
            overrideSummerFridayInput.value = config.overrideHoursReducido !== null && config.overrideHoursReducido !== undefined ? config.overrideHoursReducido : '';
            overrideSummerFridayInput.disabled = !config.overrideEnabled;
        }
        if (overrideRestOfYearInput) {
            overrideRestOfYearInput.value = config.overrideHoursNormal !== null && config.overrideHoursNormal !== undefined ? config.overrideHoursNormal : '';
            overrideRestOfYearInput.disabled = !config.overrideEnabled;
        }
        if (overrideTable) {
            overrideTable.style.opacity = config.overrideEnabled ? '1' : '0.5';
            overrideTable.style.pointerEvents = config.overrideEnabled ? 'auto' : 'none';
        }
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
    // --- GUARDADO Y CARGA ---
    function saveOptions(configToSave) {
        if (!configToSave || !configToSave.proyectos) {
             if(window.showToast) window.showToast('Error: Configuración inválida.', 'error'); return;
        }
        const normalizedConfig = ensureConfigShape({
            ...configToSave,
            horasEsperadasDiarias: { ...(configToSave.horasEsperadasDiarias || {}) },
            horasEsperadasOriginales: { ...(configToSave.horasEsperadasOriginales || configToSave.horasEsperadasDiarias || {}) },
            manualHoursOverrides: { ...(configToSave.manualHoursOverrides || {}) },
            planDiario: { ...(configToSave.planDiario || {}) },
            planDiarioRaw: { ...(configToSave.planDiarioRaw || {}) },
            manualOverrideDays: { ...(configToSave.manualOverrideDays || {}) }
        });
        // CAMBIO: Usar 'local' en lugar de 'sync'
        chrome.storage.local.set({ configV2: normalizedConfig }, () => {
            // Verificar si hubo error al guardar (por si acaso excede local, aunque es difícil)
            if (chrome.runtime.lastError) {
                console.error("Error guardando en local:", chrome.runtime.lastError);
                if (window.showToast) window.showToast('Error al guardar: ' + chrome.runtime.lastError.message, 'error');
            } else {
                if (window.showToast) window.showToast('¡Configuración guardada!', 'success');
                render(normalizedConfig, 'save');
            }
        });
    }
     // Carga la configuración completa y renderiza
    function restoreOptions() {
        // CAMBIO: Usar 'local' en lugar de 'sync'
        chrome.storage.local.get({ configV2: defaultConfig }, items => {
            const cfg = ensureConfigShape(items.configV2 || defaultConfig);
            // Migración desde nombres antiguos si existen
            if (cfg.overrideHoursReducido === undefined && cfg.overrideHoursSummerFriday !== undefined) {
                cfg.overrideHoursReducido = cfg.overrideHoursSummerFriday;
            }
            if (cfg.overrideHoursNormal === undefined && cfg.overrideHoursRestOfYear !== undefined) {
                cfg.overrideHoursNormal = cfg.overrideHoursRestOfYear;
            }
            delete cfg.overrideHoursSummerFriday;
            delete cfg.overrideHoursRestOfYear;
            render(cfg, 'load');
        });
    }

    // --- IMPORTAR / EXPORTAR JSON ---
    function exportConfig() {
        chrome.storage.local.get({ configV2: defaultConfig }, items => {
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
                     // Migrar claves antiguas si existen
                     if (importedConfig.overrideHoursReducido === undefined && importedConfig.overrideHoursSummerFriday !== undefined) {
                         importedConfig.overrideHoursReducido = importedConfig.overrideHoursSummerFriday;
                     }
                     if (importedConfig.overrideHoursNormal === undefined && importedConfig.overrideHoursRestOfYear !== undefined) {
                         importedConfig.overrideHoursNormal = importedConfig.overrideHoursRestOfYear;
                     }
                     delete importedConfig.overrideHoursSummerFriday;
                     delete importedConfig.overrideHoursRestOfYear;
                     const normalizedImported = ensureConfigShape(importedConfig);
                     if (!normalizedImported.horasEsperadasOriginales || !Object.keys(normalizedImported.horasEsperadasOriginales).length) {
                         normalizedImported.horasEsperadasOriginales = { ...(normalizedImported.horasEsperadasDiarias || {}) };
                     }
                     if (normalizedImported.planDiarioRaw && Object.keys(normalizedImported.planDiarioRaw).length) {
                         normalizedImported.planDiario = recalculatePlanFromRaw(normalizedImported);
                     }
                     // Asumimos que si no hay planDiarioRaw, el JSON ya viene calculado
                     saveOptions(normalizedImported); // Guardar Y renderizar
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
        if (typeof calcularHorasParaDia_v2_7 !== 'function') { // Asegurarse que usa la v2.5
            console.error("Error: Falta calcularHorasParaDia_v2_7 para pre-cálculo.");
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

                    // 2. Construir configuración base con planRaw y recalcular según overrides actuales
                    console.log("[Import CSV] Recalculando plan en base al CSV + overrides actuales...");
                    const newConfigFinal = ensureConfigShape({
                        proyectos: extractedDataRaw.proyectos,
                        sdaComun: extractedDataRaw.sdaComun,
                        tecnologiaComun: currentConfigData.tecnologiaComun || "",
                        horasEsperadasDiarias: { ...extractedDataRaw.horasEsperadasDiarias },
                        horasEsperadasOriginales: { ...extractedDataRaw.horasEsperadasDiarias },
                        manualHoursOverrides: {},
                        planDiarioRaw: extractedDataRaw.planDiario,
                        planDiario: {},
                        manualOverrideDays: {},
                        employeeId: employeeId.trim().toUpperCase(),
                        overrideEnabled: currentConfigData.overrideEnabled,
                        overrideHoursReducido: currentConfigData.overrideHoursReducido,
                        overrideHoursNormal: currentConfigData.overrideHoursNormal
                    });
                    newConfigFinal.planDiario = recalculatePlanFromRaw(newConfigFinal);

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
                     let valorHoras = (horasRow[colIndex] || '').trim();
                     // Normalize "0" to "V" (vacation)
                     if (valorHoras === "0") {
                         valorHoras = "V";
                     }
                     horasEsperadas[dateColumns[colIndex]] = valorHoras;
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

    // Event listeners for override toggle and hour inputs
    const overrideEnabledInput = document.getElementById('override-enabled');
    const overrideSummerFridayInput = document.getElementById('override-hours-summer-friday');
    const overrideRestOfYearInput = document.getElementById('override-hours-rest-of-year');
    const overrideTable = document.getElementById('override-table');

    if (overrideEnabledInput) {
        overrideEnabledInput.addEventListener('change', (event) => {
            const isEnabled = event.target.checked;
            const updatedConfig = ensureConfigShape({
                ...currentConfigData,
                overrideEnabled: isEnabled
            });
            
            // Update UI immediately
            if (overrideSummerFridayInput) overrideSummerFridayInput.disabled = !isEnabled;
            if (overrideRestOfYearInput) overrideRestOfYearInput.disabled = !isEnabled;
            if (overrideTable) {
                overrideTable.style.opacity = isEnabled ? '1' : '0.5';
                overrideTable.style.pointerEvents = isEnabled ? 'auto' : 'none';
            }
            
            updatedConfig.planDiario = recalculatePlanFromRaw(updatedConfig);
            saveOptions(updatedConfig);
        });
    }

    if (overrideSummerFridayInput) {
        overrideSummerFridayInput.addEventListener('change', (event) => {
            const value = event.target.value.trim();
            const numValue = value === '' ? null : parseFloat(value);
            if ((currentConfigData.overrideHoursReducido === null && numValue === null) || currentConfigData.overrideHoursReducido === numValue) return;
            const updatedConfig = ensureConfigShape({
                ...currentConfigData,
                overrideHoursReducido: numValue
            });
            updatedConfig.planDiario = recalculatePlanFromRaw(updatedConfig);
            saveOptions(updatedConfig);
        });
    }

    if (overrideRestOfYearInput) {
        overrideRestOfYearInput.addEventListener('change', (event) => {
            const value = event.target.value.trim();
            const numValue = value === '' ? null : parseFloat(value);
            if ((currentConfigData.overrideHoursNormal === null && numValue === null) || currentConfigData.overrideHoursNormal === numValue) return;
            const updatedConfig = ensureConfigShape({
                ...currentConfigData,
                overrideHoursNormal: numValue
            });
            updatedConfig.planDiario = recalculatePlanFromRaw(updatedConfig);
            saveOptions(updatedConfig);
        });
    }

    clearAllBtn.addEventListener('click', () => {
        // Show confirmation dialog
        if (confirm("¿Estás MUY seguro de que quieres borrar TODA la configuración guardada?\nEsta acción no se puede deshacer y tendrás que volver a importar tu CSV.")) {
            chrome.storage.local.clear(() => {
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

    // --- GESTIÓN DE MODAL PARA EDITAR/AÑADIR TAREAS ---
    const taskModal = document.getElementById('task-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDate = document.getElementById('modal-date');
    const taskListEl = document.getElementById('task-list');
    const addTaskBtn = document.getElementById('add-task-btn');
    const saveTasksBtn = document.getElementById('save-tasks-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const dayTypeSelect = document.getElementById('day-type-select');
    const dayHoursInput = document.getElementById('day-hours-input');
    const dayHoursHelp = document.getElementById('day-hours-help');
    const dayHoursWrapper = document.getElementById('day-hours-wrapper');
    const restoreDayHoursBtn = document.getElementById('restore-day-hours-btn');
    
    let currentEditingDate = null;
    let currentTasks = [];
    let currentDayType = 'laborable';

    if (restoreDayHoursBtn) {
        restoreDayHoursBtn.disabled = true;
        restoreDayHoursBtn.classList.add('disabled');
    }
    if (dayHoursHelp) {
        dayHoursHelp.textContent = '';
    }

    // Event delegation para botones de editar/añadir en los días
    document.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const addBtn = e.target.closest('.add-btn');
        
        if (editBtn || addBtn) {
            const dateStr = (editBtn || addBtn).dataset.date;
            openTaskModal(dateStr, addBtn ? 'add' : 'edit');
        }
    });

    if (dayTypeSelect) {
        dayTypeSelect.addEventListener('change', (event) => {
            const newType = event.target.value;
            setDayTypeState(newType);
            if (newType === 'laborable' && dayHoursInput && currentEditingDate && !dayHoursInput.value) {
                dayHoursInput.value = getSuggestedHoursForDate(currentEditingDate);
            }
        });
    }

    if (restoreDayHoursBtn) {
        restoreDayHoursBtn.addEventListener('click', handleRestoreDayHoursClick);
    }

    function openTaskModal(dateStr, mode = 'edit') {
        currentEditingDate = dateStr;
        const date = new Date(dateStr + 'T12:00:00');
        const dateFormatted = date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        modalTitle.textContent = mode === 'add' ? 'Planificar día' : 'Editar día';
        modalDate.textContent = dateFormatted;

        const existingPlan = currentConfigData.planDiario[dateStr] || [];
        currentTasks = existingPlan.map(task => ({
            proyectoIndex: task.proyectoIndex,
            tipoTarea: task.tipoTarea || '',
            horas: task.horas || '0',
            minutos: task.minutos || '0'
        }));

        const expectedValue = currentConfigData.horasEsperadasDiarias?.[dateStr] ?? currentConfigData.horasEsperadasOriginales?.[dateStr] ?? '';
        let derivedDayType = determineDayTypeFromValue(expectedValue);
        let hoursValue = derivedDayType === 'laborable' ? normalizeHoursString(expectedValue) : '';

        if (mode === 'add' && derivedDayType !== 'laborable') {
            derivedDayType = 'laborable';
        }
        if (!hoursValue && derivedDayType === 'laborable') {
            hoursValue = getSuggestedHoursForDate(dateStr);
        }

        if (dayHoursInput) {
            dayHoursInput.value = hoursValue || '';
        }

        currentDayType = derivedDayType;
        setDayTypeState(derivedDayType, { skipRender: true });
        if (dayTypeSelect) {
            dayTypeSelect.value = derivedDayType;
        }

        updateDayHoursHelpText(dateStr);
        updateRestoreButtonState(dateStr);

        const shouldSeedTask = (mode === 'add' || currentTasks.length === 0) && derivedDayType === 'laborable';
        if (shouldSeedTask) {
            currentTasks.push(defaultTask());
        }

        renderTaskList();
        taskModal.classList.add('active');
    }

    function defaultTask() {
        return {
            proyectoIndex: 0,
            tipoTarea: 'Construcción',
            horas: '0',
            minutos: '0'
        };
    }

    function handleNewProjectForTask(taskIdx) {
        const previousIndex = currentTasks[taskIdx]?.proyectoIndex ?? 0;
        const newCodeRaw = prompt('Introduce el código de la nueva tarea/proyecto (ej. FEATURE-1234):', '');
        if (newCodeRaw === null) {
            currentTasks[taskIdx].proyectoIndex = previousIndex;
            renderTaskList();
            return;
        }
        const newCode = newCodeRaw.trim();
        if (!newCode) {
            if (window.showToast) window.showToast('Código vacío. Operación cancelada.', 'info');
            currentTasks[taskIdx].proyectoIndex = previousIndex;
            renderTaskList();
            return;
        }
        const normalizedCode = newCode.toUpperCase();
        let existingIndex = currentConfigData.proyectos.findIndex(p => (p.codigo || '').toUpperCase() === normalizedCode);
        if (existingIndex === -1) {
            currentConfigData.proyectos.push({ codigo: normalizedCode });
            existingIndex = currentConfigData.proyectos.length - 1;
            renderProjectList(currentConfigData.proyectos, currentConfigData.sdaComun, currentConfigData.tecnologiaComun);
            summaryProyectosCountEl.textContent = currentConfigData.proyectos.length;
        }
        currentTasks[taskIdx].proyectoIndex = existingIndex;
        renderTaskList();
    }

    function setDayTypeState(dayType, options = {}) {
        currentDayType = dayType;
        if (dayTypeSelect && dayTypeSelect.value !== dayType) {
            dayTypeSelect.value = dayType;
        }
        if (dayHoursWrapper) {
            dayHoursWrapper.style.display = dayType === 'laborable' ? 'block' : 'none';
        }
        if (addTaskBtn) {
            const disable = dayType !== 'laborable';
            addTaskBtn.disabled = disable;
            addTaskBtn.classList.toggle('disabled', disable);
        }
        if (!options.skipRender) {
            renderTaskList();
        }
    }

    function isCurrentDayLaborable() {
        return currentDayType === 'laborable';
    }

    function updateDayHoursHelpText(dateStr) {
        if (!dayHoursHelp) return;
        if (!dateStr) {
            dayHoursHelp.textContent = '';
            return;
        }
        const originalValue = currentConfigData.horasEsperadasOriginales?.[dateStr];
        if (originalValue === undefined) {
            dayHoursHelp.textContent = 'Este día no existe en el CSV importado. Usa un valor manual.';
            return;
        }
        dayHoursHelp.textContent = `CSV: ${describeDayValue(originalValue)}`;
    }

    function updateRestoreButtonState(dateStr) {
        if (!restoreDayHoursBtn) return;
        if (!dateStr) {
            restoreDayHoursBtn.disabled = true;
            restoreDayHoursBtn.classList.add('disabled');
            return;
        }
        const hasOriginal = currentConfigData.horasEsperadasOriginales?.[dateStr] !== undefined;
        restoreDayHoursBtn.disabled = !hasOriginal;
        restoreDayHoursBtn.classList.toggle('disabled', !hasOriginal);
    }

    function handleRestoreDayHoursClick() {
        if (!currentEditingDate) {
            if (window.showToast) window.showToast('Abre un día para restaurar sus horas.', 'info');
            return;
        }
        const originalValue = currentConfigData.horasEsperadasOriginales?.[currentEditingDate];
        if (originalValue === undefined) {
            if (window.showToast) window.showToast('No hay valor original para este día.', 'info');
            return;
        }
        const restoredType = determineDayTypeFromValue(originalValue);
        const restoredHours = restoredType === 'laborable' ? normalizeHoursString(originalValue) : '';
        if (dayHoursInput) {
            dayHoursInput.value = restoredHours;
        }
        setDayTypeState(restoredType);
        updateDayHoursHelpText(currentEditingDate);
    }

    function getOverrideHoursForDate(dateObj) {
        if (!currentConfigData.overrideEnabled || !dateObj || isNaN(dateObj.getTime())) return null;
        const dayOfWeek = dateObj.getDay();
        const month = dateObj.getMonth();
        const day = dateObj.getDate();
        const isFriday = dayOfWeek === 5;
        const isSummer = month === 6 || month === 7 || (month === 8 && day <= 15);
        if ((isFriday || isSummer) && currentConfigData.overrideHoursReducido !== null && currentConfigData.overrideHoursReducido !== undefined) {
            return currentConfigData.overrideHoursReducido.toString();
        }
        if (!isFriday && !isSummer && currentConfigData.overrideHoursNormal !== null && currentConfigData.overrideHoursNormal !== undefined) {
            return currentConfigData.overrideHoursNormal.toString();
        }
        return null;
    }

    function getSuggestedHoursForDate(dateStr) {
        const directValue = normalizeHoursString(currentConfigData.horasEsperadasDiarias?.[dateStr]);
        if (directValue) return directValue;
        const originalValue = normalizeHoursString(currentConfigData.horasEsperadasOriginales?.[dateStr]);
        if (originalValue) return originalValue;
        const fallback = getOverrideHoursForDate(new Date(dateStr + 'T12:00:00'));
        if (fallback) return normalizeHoursString(fallback);
        return '8';
    }

    function getDayHoursValueForSave(dayType) {
        if (dayType === 'vacaciones') return 'V';
        if (dayType === 'festivo') return 'F';
        const rawValue = (dayHoursInput?.value || '').trim();
        if (!rawValue) {
            if (window.showToast) window.showToast('Introduce las horas esperadas para el día.', 'error');
            return null;
        }
        const normalized = normalizeHoursString(rawValue);
        if (!normalized) {
            if (window.showToast) window.showToast('Horas inválidas. Usa un número mayor que 0.', 'error');
            return null;
        }
        const parsed = parseFloat(normalized);
        if (isNaN(parsed) || parsed <= 0) {
            if (window.showToast) window.showToast('Horas inválidas. Usa un número mayor que 0.', 'error');
            return null;
        }
        return normalized;
    }

    function renderTaskList() {
        taskListEl.innerHTML = '';

        if (!isCurrentDayLaborable()) {
            const warning = document.createElement('p');
            warning.className = 'task-day-warning';
            warning.textContent = currentDayType === 'vacaciones'
                ? 'Este día está marcado como Vacaciones. Cambia el tipo a "Laborable" para añadir tareas.'
                : 'Este día está marcado como Festivo. Cambia el tipo a "Laborable" para añadir tareas.';
            taskListEl.appendChild(warning);
            return;
        }
        
        currentTasks.forEach((task, index) => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            
            const projectOptions = currentConfigData.proyectos.map((p, idx) => 
                `<option value="${idx}" ${task.proyectoIndex === idx ? 'selected' : ''}>${p.codigo}</option>`
            ).join('');
            const newTaskOption = '<option value="__new__">Nueva tarea</option>';
            
            const tipoOptions = ['Diseño', 'Construcción', 'Pruebas', 'Despliegue'].map(tipo =>
                `<option value="${tipo}" ${task.tipoTarea === tipo ? 'selected' : ''}>${tipo}</option>`
            ).join('');
            
            taskItem.innerHTML = `
                <select class="task-project" data-index="${index}">
                    ${projectOptions}
                    ${newTaskOption}
                </select>
                <select class="task-tipo" data-index="${index}">
                    ${tipoOptions}
                </select>
                <input type="number" class="task-horas" data-index="${index}" value="${task.horas}" min="0" step="1" placeholder="Horas">
                <input type="number" class="task-minutos" data-index="${index}" value="${task.minutos}" min="0" max="59" step="1" placeholder="Min">
                <button class="task-remove" data-index="${index}">🗑️</button>
            `;
            
            taskListEl.appendChild(taskItem);
        });
        
        // Event listeners para actualizar datos
        taskListEl.querySelectorAll('.task-project').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const value = e.target.value;
                if (value === '__new__') {
                    handleNewProjectForTask(idx);
                    return;
                }
                const parsedIndex = parseInt(value, 10);
                if (isNaN(parsedIndex)) {
                    currentTasks[idx].proyectoIndex = 0;
                } else {
                    currentTasks[idx].proyectoIndex = parsedIndex;
                }
            });
        });
        
        taskListEl.querySelectorAll('.task-tipo').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                currentTasks[idx].tipoTarea = e.target.value;
            });
        });
        
        taskListEl.querySelectorAll('.task-horas').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                currentTasks[idx].horas = e.target.value;
            });
        });
        
        taskListEl.querySelectorAll('.task-minutos').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                currentTasks[idx].minutos = e.target.value;
            });
        });
        
        taskListEl.querySelectorAll('.task-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                currentTasks.splice(idx, 1);
                renderTaskList();
            });
        });
    }

    addTaskBtn.addEventListener('click', () => {
        if (!isCurrentDayLaborable()) {
            if (window.showToast) window.showToast('Cambia el tipo de día a "Laborable" para añadir tareas.', 'info');
            return;
        }
        currentTasks.push(defaultTask());
        renderTaskList();
    });

    saveTasksBtn.addEventListener('click', () => {
        if (!currentEditingDate) {
            if (window.showToast) window.showToast('Selecciona un día antes de guardar.', 'error');
            return;
        }

        const dayValue = getDayHoursValueForSave(currentDayType);
        if (dayValue === null) {
            return;
        }

        const updatedConfig = ensureConfigShape({
            ...currentConfigData,
            horasEsperadasDiarias: { ...(currentConfigData.horasEsperadasDiarias || {}) },
            horasEsperadasOriginales: { ...(currentConfigData.horasEsperadasOriginales || {}) },
            manualHoursOverrides: { ...(currentConfigData.manualHoursOverrides || {}) },
            planDiario: { ...(currentConfigData.planDiario || {}) },
            manualOverrideDays: { ...(currentConfigData.manualOverrideDays || {}) }
        });

        const canonicalValue = canonicalizeHoursValue(dayValue);
        if (!updatedConfig.horasEsperadasOriginales[currentEditingDate]) {
            updatedConfig.horasEsperadasOriginales[currentEditingDate] = canonicalValue;
        }
        updatedConfig.horasEsperadasDiarias[currentEditingDate] = canonicalValue;

        const canonicalOriginal = canonicalizeHoursValue(updatedConfig.horasEsperadasOriginales[currentEditingDate]);
        if (canonicalOriginal === canonicalValue) {
            delete updatedConfig.manualHoursOverrides[currentEditingDate];
        } else {
            updatedConfig.manualHoursOverrides[currentEditingDate] = canonicalValue;
        }

        if (currentDayType === 'laborable') {
            const validTasks = currentTasks.filter(task =>
                parseInt(task.horas, 10) > 0 || parseInt(task.minutos, 10) > 0
            ).map(task => ({
                proyectoIndex: task.proyectoIndex,
                tipoTarea: task.tipoTarea,
                horas: task.horas,
                minutos: task.minutos
            }));

            if (validTasks.length > 0) {
                updatedConfig.planDiario[currentEditingDate] = validTasks;
                updatedConfig.manualOverrideDays[currentEditingDate] = true;
            } else {
                delete updatedConfig.planDiario[currentEditingDate];
                delete updatedConfig.manualOverrideDays[currentEditingDate];
            }
        } else {
            delete updatedConfig.planDiario[currentEditingDate];
            delete updatedConfig.manualOverrideDays[currentEditingDate];
        }

        updatedConfig.planDiario = recalculatePlanFromRaw(updatedConfig);
        saveOptions(updatedConfig);
        closeTaskModal();
        if (window.showToast) window.showToast('Día actualizado correctamente.', 'success');
    });

    cancelModalBtn.addEventListener('click', closeTaskModal);
    
    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) {
            closeTaskModal();
        }
    });

    function closeTaskModal() {
        taskModal.classList.remove('active');
        currentEditingDate = null;
        currentTasks = [];
        currentDayType = 'laborable';
        if (dayTypeSelect) {
            dayTypeSelect.value = 'laborable';
        }
        if (dayHoursInput) {
            dayHoursInput.value = '';
        }
        setDayTypeState('laborable', { skipRender: true });
        updateDayHoursHelpText('');
        updateRestoreButtonState('');
    }

});