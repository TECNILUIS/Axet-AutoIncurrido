// scripts/options.js v2.4 (Con Vista Semanal Lun-Vie + SDA Numérico + Plan Diario Completo)

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const projectList = document.getElementById('project-list');
    const projectTemplate = document.getElementById('project-template');
    const exportBtn = document.getElementById('export-btn');
    const importJsonBtn = document.getElementById('import-json-btn');
    const importJsonFileInput = document.getElementById('import-json-file');
    const employeeIdInput = document.getElementById('employee-id');
    const importCsvBtn = document.getElementById('import-csv-btn');
    const importCsvFileInput = document.getElementById('import-csv-file');
    const statusEl = document.getElementById('status');
    const summarySdaEl = document.getElementById('summary-sda');
    const summaryProyectosCountEl = document.getElementById('summary-proyectos-count');
    const summaryDiasCountEl = document.getElementById('summary-dias-count');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const currentWeekDisplayEl = document.getElementById('current-week-display');
    const weeklyPlanContainerEl = document.getElementById('weekly-plan-container');

    // Estructura v2.4
    const defaultConfig = {
        proyectos: [], // Array de { codigo: string }
        sdaComun: "", // String para el número SDATool único
        horasEsperadasDiarias: {}, // Objeto { 'YYYY-MM-DD': 'horas/codigo', ... }
        planDiario: {} // Objeto { 'YYYY-MM-DD': [{ proyectoIndex: number, tipoTarea: string, tipoImputacionHoras: string }, ...], ... }
    };

    let currentProyectos = []; // Cache local de proyectos { codigo }
    let currentSdaComun = ""; // Cache local de SDA (numérico)
    let currentConfigData = defaultConfig; // Mantiene la config completa en memoria
    let currentWeekStartDate = null; // Lunes de la semana mostrada

    // Mapeo de iniciales CSV a Tipos de Tarea
    const tipoTareaMap = { 'az': 'Construcción', 'am': 'Diseño', 'mo': 'Pruebas', 've': 'Despliegue' };
    const diasSemanaNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']; // Para mostrar cabeceras

    // --- FUNCIONES AUXILIARES FECHAS ---
    /** Obtiene el lunes de la semana que contiene la fecha dada */
    function getMonday(d) {
        d = new Date(d); d.setHours(0,0,0,0);
        const day = d.getDay(); // 0=Dom, 1=Lun, ... 6=Sab
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuste para Dom=0 -> -6, Lun=1 -> 0...
        return new Date(d.setDate(diff));
    }
    /** Formatea una fecha como YYYY-MM-DD localmente */
    function formatDateYYYYMMDD(date) {
        if (!date) return '';
        // Usamos los getters locales para asegurar YYYY-MM-DD correcto
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // --- RENDERIZACIÓN ---
    function renderProjectList(proyectos = [], sdaGlobal = "") {
        projectList.innerHTML = ''; currentProyectos = []; currentSdaComun = sdaGlobal;
        if (!proyectos || !proyectos.length) {
            projectList.innerHTML = '<p style="text-align: center; color: #888;">Los proyectos aparecerán aquí después de importar.</p>';
            return;
        };
        proyectos.forEach((proj, index) => {
            currentProyectos.push({ codigo: proj.codigo }); // Solo guardar código en caché
            const row = projectTemplate.content.cloneNode(true).querySelector('.rule-row');
            row.dataset.index = index;
            row.querySelector('.project-codigo').value = proj.codigo || '';
            const sdaDisplay = row.querySelector('.project-sda-display');
            if (sdaDisplay) sdaDisplay.textContent = sdaGlobal ? `(SDA: ${sdaGlobal})` : '';
            projectList.appendChild(row);
        });
    }

    // Renderiza la vista semanal (Lun-Vie)
    function renderWeeklyPlanView() {
        if (!currentWeekStartDate || !currentConfigData || !currentConfigData.planDiario) {
             // Placeholder para 5 días
            weeklyPlanContainerEl.innerHTML = `
                <div class="day-column non-workday"><h5>Lun</h5><span class="no-plan">Importa</span></div>
                <div class="day-column non-workday"><h5>Mar</h5><span class="no-plan">CSV</span></div>
                <div class="day-column non-workday"><h5>Mié</h5><span class="no-plan">para ver</span></div>
                <div class="day-column non-workday"><h5>Jue</h5><span class="no-plan">el plan</span></div>
                <div class="day-column non-workday"><h5>Vie</h5><span class="no-plan">semanal.</span></div>`;
             currentWeekDisplayEl.textContent = 'Semana (Importa CSV)';
             prevWeekBtn.disabled = true; nextWeekBtn.disabled = true;
            return;
        }

        const weekStart = new Date(currentWeekStartDate); weekStart.setHours(0, 0, 0, 0);
        // El texto del display muestra Lunes a Domingo
        const weekFullEnd = new Date(weekStart); weekFullEnd.setDate(weekStart.getDate() + 6);
        currentWeekDisplayEl.textContent = `Semana del ${weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} al ${weekFullEnd.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;

        weeklyPlanContainerEl.innerHTML = ''; // Limpiar vista

        const daysHeader = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']; // Solo Lunes a Viernes

        // Iterar solo 5 veces
        for (let i = 0; i < 5; i++) {
            // Crear fecha explícitamente para evitar errores de setDate
            const dayDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
            dayDate.setHours(12, 0, 0, 0); // Mediodía local para evitar problemas timezone

            const dayStrYYYYMMDD = formatDateYYYYMMDD(dayDate); // Formato local YYYY-MM-DD
            const dayName = daysHeader[i]; // Lunes a Viernes

            const dayColumn = document.createElement('div'); dayColumn.classList.add('day-column');
            const horasEsperadas = (currentConfigData.horasEsperadasDiarias[dayStrYYYYMMDD] || '').toUpperCase(); // Convertir a mayúsculas
            const planDelDia = currentConfigData.planDiario[dayStrYYYYMMDD] || [];
            let horasDisplay = horasEsperadas || '-'; // Mostrar guión si está vacío
            let isWorkDay = !isNaN(parseInt(horasEsperadas, 10)) && parseInt(horasEsperadas, 10) > 0;

            // --- LÓGICA DE CLASES CSS ---
            if (!isWorkDay) {
                 dayColumn.classList.add('non-workday'); // Clase general no laborable
                 if (horasEsperadas === 'V') {
                     dayColumn.classList.add('day-vacation'); // Verde si es Vacaciones
                     horasDisplay = 'Vac.'; // Texto corto
                 } else if (horasEsperadas === 'F') {
                     dayColumn.classList.add('day-holiday'); // Rojo si es Festivo
                     horasDisplay = 'Fest.'; // Texto corto
                 } else if (horasEsperadas === 'S' || horasEsperadas === 'D') {
                     // Ya tiene non-workday, no hacemos nada extra para S/D
                     horasDisplay = horasEsperadas; // Mostrar S o D
                 } else if (horasEsperadas === '') {
                    horasDisplay = '-'; // Mostrar guión si está fuera de rango en CSV
                 }
            }
             // --- FIN LÓGICA CLASES ---

            // Mostrar el día y las horas/código
            dayColumn.innerHTML = `<h5>${dayName} ${dayDate.getDate()}</h5><span class="horas">(${horasDisplay}${isWorkDay?'h':''})</span>`;

            // Mostrar tareas solo si es día laborable
            if (isWorkDay && planDelDia.length > 0) {
                const taskList = document.createElement('ul');
                // Ordenar tareas: Diseño primero, luego Construcción, luego el resto
                planDelDia.sort((a, b) => {
                    const order = { 'Diseño': 1, 'Construcción': 2, 'Pruebas': 3, 'Despliegue': 4 };
                    const typeA = a.tipoTarea || '';
                    const typeB = b.tipoTarea || '';
                    return (order[typeA] || 99) - (order[typeB] || 99);
                });

                planDelDia.forEach(regla => {
                    const proyecto = currentConfigData.proyectos[regla.proyectoIndex];
                    if (proyecto) {
                        const li = document.createElement('li');
                        li.innerHTML = `
                            ${proyecto.codigo}:
                            <span class="tipo-tarea">${regla.tipoTarea || '?'}</span><br/>
                            <span class="tipo-imputacion">${regla.tipoImputacionHoras || '?'}</span>
                        `;
                        taskList.appendChild(li);
                    } else { console.warn(`Proyecto índice ${regla.proyectoIndex} no encontrado para ${dayStrYYYYMMDD}`); }
                });
                if (taskList.children.length > 0) dayColumn.appendChild(taskList);
                else dayColumn.innerHTML += '<span class="no-plan">(Plan Inválido)</span>';
            } else if (isWorkDay) {
                dayColumn.innerHTML += '<span class="no-plan">(Sin plan)</span>';
            } else if (horasDisplay !== 'Vac.' && horasDisplay !== 'Fest.' && horasDisplay !== 'S' && horasDisplay !== 'D' && horasDisplay !== '-') {
                 // Si no es laborable pero tampoco V/F/S/D/-, mostramos el código
                 dayColumn.innerHTML += `<span class="no-plan">${horasDisplay}</span>`;
            }

            weeklyPlanContainerEl.appendChild(dayColumn);
        } // Fin del bucle for (i < 5)

         // Habilitar/Deshabilitar botones
         const hasPlan = Object.keys(currentConfigData.planDiario || {}).length > 0;
         prevWeekBtn.disabled = !hasPlan; nextWeekBtn.disabled = !hasPlan;
    }


    // Renderiza Proyectos y Resumen general + Vista Semanal
    function render(config, source = 'load') { // Añadido source para saber si es carga inicial o importación
        if (!config) config = defaultConfig;
        currentConfigData = config; // Actualizar config global en memoria

        renderProjectList(config.proyectos, config.sdaComun); // Renderiza Proyectos y actualiza caches

        // Actualizar resumen general
        summarySdaEl.textContent = config.sdaComun || 'No definido';
        summaryProyectosCountEl.textContent = config.proyectos?.length || 0;
        const planDaysCount = Object.keys(config.planDiario || {}).length;
        summaryDiasCountEl.textContent = planDaysCount;

        // Establecer semana inicial SOLO en la carga inicial o tras importación
        if (source === 'load' || source === 'import') {
             // Si hay plan, ir a la semana del primer día planificado, si no, a la de hoy
             const firstPlanDay = planDaysCount > 0 ? Object.keys(config.planDiario).sort()[0] : null;
             // Asegurarse de usar mediodía para evitar problemas de timezone al crear la fecha
             const baseDate = firstPlanDay ? new Date(firstPlanDay + 'T12:00:00') : new Date();
             currentWeekStartDate = getMonday(baseDate);
        }
        // Si source es 'save', mantenemos la semana que ya estaba visible

        renderWeeklyPlanView(); // Renderizar la semana (usará currentWeekStartDate)
    }


    // --- GUARDADO Y CARGA ---
    // Simplificado: Solo guarda la configuración pasada
    function saveOptions(configToSave) {
        // Validar estructura v2.4
        if (!configToSave || !configToSave.proyectos || configToSave.sdaComun === undefined ||
            configToSave.horasEsperadasDiarias === undefined || configToSave.planDiario === undefined) {
             if(window.showToast) window.showToast('Error: Configuración inválida V2.4.', 'error');
             console.error("Config inválida para guardar:", configToSave); return;
        }
        chrome.storage.sync.set({ configV2: configToSave }, () => {
            if (window.showToast) window.showToast('¡Configuración guardada!', 'success');
            // FIX IMPORTANTE: Llamar a render DESPUÉS de guardar para asegurar que currentConfigData se actualice
            // y para que la vista semanal refleje los datos guardados.
            render(configToSave, 'save'); // Pasamos 'save' para no resetear la semana si ya estaba definida
        });
    }
     // Carga la configuración y renderiza
     function restoreOptions() {
        chrome.storage.sync.get({ configV2: defaultConfig }, items => {
            render(items.configV2 || defaultConfig, 'load'); // Pasar 'load' para inicializar semana
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
                 // Validar estructura v2.4
                 if (importedConfig.proyectos && importedConfig.sdaComun !== undefined &&
                     importedConfig.horasEsperadasDiarias !== undefined && importedConfig.planDiario !== undefined) {
                     saveOptions(importedConfig); // Guardar Y renderizar (render pondrá semana correcta)
                     if (window.showToast) window.showToast('¡Config JSON importada y guardada!', 'success');
                 } else { throw new Error('Formato V2.4 incorrecto.'); }
             } catch (error) { if (window.showToast) window.showToast(`Error import JSON: ${error.message}`, 'error'); }
             finally { importJsonFileInput.value = ''; }
         };
         reader.readAsText(file);
     }


    // --- LÓGICA: IMPORTAR TODO DESDE CSV ---
    function parseCsvAndExtractData(file, employeeId) {
        if (!employeeId) { if (window.showToast) window.showToast('Introduce tu ID.', 'error'); return; }
        if (!window.Papa) { if (window.showToast) window.showToast('Error: PapaParse no cargado.', 'error'); return; }
        Papa.parse(file, {
            complete: (results) => {
                try {
                    console.log("CSV Parseado:", results.data);
                    // Esta función ahora devuelve: { proyectos, sdaComun (numérico), horasEsperadas, planDiario }
                    const extractedData = findEmployeeDataAndPlanInCsv(results.data, employeeId.trim().toUpperCase());
                    if (!extractedData || !extractedData.proyectos || extractedData.proyectos.length === 0) {
                        if (window.showToast) window.showToast(`No se encontraron datos válidos para ID ${employeeId}.`, 'error', 5000); return;
                    }
                    console.log("Datos extraídos:", extractedData);
                    const newConfig = {
                        proyectos: extractedData.proyectos,
                        sdaComun: extractedData.sdaComun, // Ya es numérico
                        horasEsperadasDiarias: extractedData.horasEsperadas,
                        planDiario: extractedData.planDiario,
                        // Asegurar que reglasPlanificacion (obsoleto) esté vacío o ausente
                        // reglasPlanificacion: [] // Opcional, dependiendo de si content.js lo necesita vacío
                    };
                    saveOptions(newConfig); // Guardar Y renderizar (render pondrá semana correcta)
                    if (window.showToast) window.showToast(`¡${extractedData.proyectos.length} proyectos y plan diario importados!`, 'success', 5000);
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
    // Función que extrae datos del CSV (incluye SDA numérico y plan diario)
    function findEmployeeDataAndPlanInCsv(data, employeeId) {
        let employeeRowIndex = -1; let headerRow = []; let headerIndex = -1;
        let dateColumns = {}; const projectsMap = new Map(); // { codigo: { index } }
        let sdaComun = ""; let horasRow = []; const planDiario = {}; let foundHorasRow = false;

        // 1. Encontrar fila de encabezados y parsear fechas
        for (let i = 0; i < data.length; i++) {
            const lowerCaseRow = data[i].map(cell => (cell || '').trim().toLowerCase());
            if (lowerCaseRow.includes('usuario')) {
                headerRow = data[i].map(cell => (cell || '').trim()); headerIndex = i;
                console.log(`[CSV Parser] Encabezados en fila ${headerIndex + 1}.`); break;
            }
        }
        if (headerIndex === -1) throw new Error('Fila de encabezados no encontrada (buscando "Usuario").');
        const lowerHeader = headerRow.map(h => h.toLowerCase());
        const userIdCol = lowerHeader.indexOf('usuario'); const sdaCol = lowerHeader.indexOf('sdatool'); const featureCol = lowerHeader.indexOf('feature');
        if (userIdCol === -1 || sdaCol === -1 || featureCol === -1) throw new Error('Columnas "Usuario", "SDATool" o "Feature" no encontradas.');

        let currentMonthStr = ""; let currentYear = "";
        const monthMap = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
        const monthYearRow = data[0].map(cell => (cell || '').trim().toLowerCase()); const dayRow = headerRow;
        for (let j = featureCol + 1; j < monthYearRow.length; j++) {
            const monthYearCell = monthYearRow[j]; const dayCell = dayRow[j];
            const monthMatch = monthYearCell.match(/(\w+)\s+(\d{4})/);
            if (monthMatch && monthMatch[1] in monthMap) { currentMonthStr = monthMatch[1]; currentYear = monthMatch[2]; }
            const day = parseInt(dayCell, 10);
            if (currentYear && currentMonthStr && monthMap[currentMonthStr] !== undefined && !isNaN(day) && day >= 1 && day <= 31) {
                const monthIndex = monthMap[currentMonthStr];
                const dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; // YYYY-MM-DD
                dateColumns[j] = dateStr;
            }
        }
        console.log("[CSV Parser] Mapeo Columnas->Fechas:", dateColumns);

        // 2. Buscar empleado, extraer datos
        for (let i = headerIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length <= Math.max(userIdCol, sdaCol, featureCol) || row.every(cell => (cell || '').trim() === '')) continue;
            const currentUserId = (row[userIdCol] || '').trim().toUpperCase();
            const currentFeature = (row[featureCol] || '').trim();
            const sdaCompleto = (row[sdaCol] || '').trim();
            const codigo = currentFeature;
            const isHorasEsperadasRow = currentFeature.toLowerCase() === 'horas esperadas';
            let isEmployeeRow = (employeeRowIndex === -1 && currentUserId === employeeId) || (employeeRowIndex !== -1 && currentUserId === '');

            if (isEmployeeRow) {
                if (employeeRowIndex === -1) employeeRowIndex = i; // Marcar inicio
                // Extraer SDA numérico
                if (!sdaComun && sdaCompleto) {
                    const sdaMatch = sdaCompleto.match(/SDATool-(\d+)/i);
                    if (sdaMatch && sdaMatch[1]) sdaComun = sdaMatch[1];
                }
                // Añadir proyecto si es nuevo y NO es horas esperadas
                if (codigo && !isHorasEsperadasRow && !projectsMap.has(codigo)) {
                    projectsMap.set(codigo, { index: projectsMap.size });
                }
                // Procesar plan diario si es fila de proyecto
                if (codigo && !isHorasEsperadasRow && projectsMap.has(codigo)) {
                    const proyectoIndex = projectsMap.get(codigo).index;
                    for (const colIndex in dateColumns) {
                        const dateStr = dateColumns[colIndex]; // YYYY-MM-DD
                        if (!dateStr || colIndex >= row.length) continue; // Safety check
                        const cellValue = (row[colIndex] || '').trim().toLowerCase();
                        if (!cellValue || cellValue === 's' || cellValue === 'd') continue; // Saltar vacías, S, D

                        let tipoTarea = null; let tieneHoraFija = cellValue.includes('1');
                        // Buscar inicial de color (solo si no es V o F)
                        if (cellValue !== 'v' && cellValue !== 'f') {
                            for (const inicial in tipoTareaMap) {
                                if (cellValue.includes(inicial)) { tipoTarea = tipoTareaMap[inicial]; break; }
                            }
                        }

                        let tipoImputacionHoras = null;
                        if (tieneHoraFija && tipoTarea) tipoImputacionHoras = 'fija_patron';
                        else if (tieneHoraFija) tipoImputacionHoras = 'fija';
                        else if (tipoTarea) tipoImputacionHoras = 'patron';
                        // Ignorar V y F aquí, se manejan por horasEsperadasDiarias

                        // Añadir al plan solo si se identificó un tipo de imputación y tarea
                        if (tipoTarea && tipoImputacionHoras) {
                            if (!planDiario[dateStr]) planDiario[dateStr] = [];
                            // Evitar duplicados si la celda tiene '1Az', por ejemplo
                            if (!planDiario[dateStr].some(p => p.proyectoIndex === proyectoIndex)) {
                                 planDiario[dateStr].push({ proyectoIndex, tipoTarea, tipoImputacionHoras });
                            }
                        } else if (tipoImputacionHoras === 'fija' && !tipoTarea) {
                             // Lógica si solo hay '1'
                             tipoTarea = 'Construcción'; // Asunción (REVISAR)
                             console.warn(`[CSV Parser] ${dateStr}, Prj ${codigo}: '1' sin tipo. Asumiendo ${tipoTarea}.`);
                             if (!planDiario[dateStr]) planDiario[dateStr] = [];
                             if (!planDiario[dateStr].some(p => p.proyectoIndex === proyectoIndex)) {
                                 planDiario[dateStr].push({ proyectoIndex, tipoTarea, tipoImputacionHoras });
                             }
                        }
                    } // fin for dateColumns
                } // fin if es fila de proyecto
                // Comprobar si es la fila de Horas Esperadas
                if (isHorasEsperadasRow) { horasRow = row; foundHorasRow = true; }
            } else if (employeeRowIndex !== -1) { // Ya pasamos al empleado
                 // Capturar fila de horas si aparece después
                 if (!foundHorasRow && isHorasEsperadasRow){ horasRow = row; foundHorasRow = true; }
                 // Parar si encontramos otro empleado Y no es la fila de horas
                 if(!isHorasEsperadasRow && currentUserId !== '') { break; }
            }
             // Si ya procesamos la fila de horas (y no era la primera fila del empleado), podemos parar
             if (foundHorasRow && i > employeeRowIndex) break;
        } // fin for data rows

        if (employeeRowIndex === -1) return null; // Empleado no encontrado

        // 3. Extraer Horas Esperadas
        const horasEsperadas = {};
        if (horasRow.length > 0) {
             for (const colIndex in dateColumns) {
                 if (colIndex < horasRow.length && horasRow[colIndex] !== undefined) {
                     // Guardar el valor exacto (puede ser '9', '7', 'V', 'F', 'S', 'D')
                     horasEsperadas[dateColumns[colIndex]] = (horasRow[colIndex] || '').trim();
                 }
             }
        }
        console.log("[CSV Parser] Horas Esperadas:", horasEsperadas);

        // Convertir projectsMap a array { codigo }
        const proyectosArray = Array.from(projectsMap.keys()).map(codigo => ({ codigo }));
        console.log("[CSV Parser] Plan Diario:", planDiario);

        return {
            proyectos: proyectosArray,
            sdaComun: sdaComun, // Ya es numérico
            horasEsperadas: horasEsperadas,
            planDiario: planDiario
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

    restoreOptions(); // Carga inicial

    // Fallback Toast
    if (typeof window.showToast === 'undefined' && typeof requestPageToast !== 'function') {
         window.showToast = (message, type = 'info', duration = 4000) => {
             console.log(`[Toast Fallback] (${type}): ${message}`);
         };
     }
});