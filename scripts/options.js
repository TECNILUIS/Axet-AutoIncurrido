// scripts/options.js v2.4 (Importación CSV avanzada + SDA numérico)

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    // Eliminado: const saveBtn = document.getElementById('save'); // Guardado automático
    // Eliminado: const addProjectBtn = document.getElementById('add-project');
    // Eliminado: const addAsignacionRuleBtn = document.getElementById('add-asignacion-rule');

    const projectList = document.getElementById('project-list');
    // Eliminado: const asignacionList = document.getElementById('asignacion-list');

    const projectTemplate = document.getElementById('project-template');
    // Eliminado: const asignacionRuleTemplate = document.getElementById('asignacion-rule-template');

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
    const summaryPlanDiarioEl = document.getElementById('summary-plan-diario');

    // Estructura v2.4: Se añade planDiario, se quitan reglasPlanificacion, sdaComun es numérico
    const defaultConfig = {
        proyectos: [], // Array de { codigo: string }
        sdaComun: "", // String para el número SDATool único
        horasEsperadasDiarias: {}, // Objeto { 'YYYY-MM-DD': 'horas/codigo', ... }
        planDiario: {} // Objeto { 'YYYY-MM-DD': [{ proyectoIndex: number, tipoTarea: string, tipoImputacionHoras: string }, ...], ... }
    };

    let currentProyectos = []; // Cache local de proyectos { codigo }
    let currentSdaComun = ""; // Cache local de SDA (numérico)
    // Eliminado: let currentHorasEsperadas = {};
    // Eliminado: let currentReglasPlanificacion = [];

    // Mapeo de iniciales CSV a Tipos de Tarea
    const tipoTareaMap = {
        'az': 'Construcción', 'am': 'Diseño', 'mo': 'Pruebas', 've': 'Despliegue'
    };

    // --- RENDERIZACIÓN (Simplificada) ---

    function renderProjectList(proyectos = [], sdaGlobal = "") {
        projectList.innerHTML = ''; currentProyectos = []; currentSdaComun = sdaGlobal;
        if (!proyectos || !proyectos.length) return;
        proyectos.forEach((proj, index) => {
            currentProyectos.push({ codigo: proj.codigo });
            const row = projectTemplate.content.cloneNode(true).querySelector('.rule-row');
            row.dataset.index = index;
            row.querySelector('.project-codigo').value = proj.codigo || '';
            const sdaDisplay = row.querySelector('.project-sda-display');
            if (sdaDisplay) sdaDisplay.textContent = sdaGlobal ? `(SDA: ${sdaGlobal})` : '';
            projectList.appendChild(row);
        });
    }

    function renderSummary(config) {
        summarySdaEl.textContent = config.sdaComun || 'No definido';
        summaryProyectosCountEl.textContent = config.proyectos?.length || 0;
        const planDaysCount = Object.keys(config.planDiario || {}).length;
        summaryDiasCountEl.textContent = planDaysCount;

        // Limpiar y mostrar ejemplo del plan diario
        summaryPlanDiarioEl.innerHTML = '<h4>Plan Diario (Resumen):</h4>'; // Resetear contenido

        if (planDaysCount === 0) {
            summaryPlanDiarioEl.innerHTML += '<p>Importa un archivo CSV para ver la planificación.</p>';
            return;
        }

        // Mostrar solo algunos días como ejemplo (ej. los primeros 5 o los últimos 5)
        const allPlanDays = Object.keys(config.planDiario).sort(); // Ordenar fechas
        const daysToShow = allPlanDays.slice(-7); // Mostrar los últimos 7 días planificados

        if (daysToShow.length === 0 && allPlanDays.length > 0) {
            // Si slice falla por alguna razón pero hay días, mostrar mensaje genérico
             summaryPlanDiarioEl.innerHTML += '<p>Plan diario cargado pero no se pudo mostrar resumen.</p>';
             return;
        }
         if (allPlanDays.length > daysToShow.length) {
            summaryPlanDiarioEl.innerHTML += `<p><i>Mostrando ${daysToShow.length} de ${allPlanDays.length} días planificados...</i></p>`;
        }


        daysToShow.forEach(dateStr => {
            const planDelDia = config.planDiario[dateStr];
            const horasEsperadas = config.horasEsperadasDiarias[dateStr] || '?';
            const dateObj = new Date(dateStr + 'T00:00:00'); // Para formato local
            const formattedDate = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });

            const dayDiv = document.createElement('div');
            dayDiv.innerHTML = `<strong>${formattedDate} (Total: ${horasEsperadas}h)</strong>`;
            const taskList = document.createElement('ul');

            if (planDelDia && planDelDia.length > 0) {
                planDelDia.forEach(regla => {
                    const proyecto = config.proyectos[regla.proyectoIndex];
                    if (proyecto) {
                        const li = document.createElement('li');
                        li.innerHTML = `
                            ${proyecto.codigo}:
                            <span class="tipo-tarea">${regla.tipoTarea || '?'}</span> -
                            <span class="tipo-imputacion">${regla.tipoImputacionHoras || '?'}</span>
                        `;
                        taskList.appendChild(li);
                    }
                });
            } else {
                 const li = document.createElement('li');
                 li.textContent = ' (Sin tareas asignadas)';
                 taskList.appendChild(li);
            }
            dayDiv.appendChild(taskList);
            summaryPlanDiarioEl.appendChild(dayDiv);
        });
    }

    // Renderiza Proyectos y Resumen
    function render(config) {
        if (!config) config = defaultConfig;
        renderProjectList(config.proyectos, config.sdaComun);
        renderSummary(config); // Llamar a la nueva función
    }

    // --- GUARDADO Y CARGA ---

    // Simplificado: Solo guarda la configuración pasada
    function saveOptions(configToSave) {
        // Validar estructura v2.4
        if (!configToSave || !configToSave.proyectos || configToSave.sdaComun === undefined ||
            configToSave.horasEsperadasDiarias === undefined || configToSave.planDiario === undefined) {
             if(window.showToast) window.showToast('Error: Intento de guardar config inválida V2.4.', 'error');
             console.error("Configuración inválida para guardar:", configToSave);
             return;
        }

        chrome.storage.sync.set({ configV2: configToSave }, () => {
            if (window.showToast) window.showToast('¡Configuración guardada!', 'success');
            render(configToSave); // Re-renderizar
        });
    }

     // Carga la configuración y renderiza
     function restoreOptions() {
        chrome.storage.sync.get({ configV2: defaultConfig }, items => {
            render(items.configV2 || defaultConfig);
        });
    }

    // --- IMPORTAR / EXPORTAR JSON ---
    // exportConfig (sin cambios funcionales)
    function exportConfig() {
        chrome.storage.sync.get({ configV2: defaultConfig }, items => {
            const configToExport = items.configV2 || defaultConfig;
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
    // importConfigJson adaptado para v2.4
    function importConfigJson(event) {
         const file = event.target.files[0]; if (!file) return;
         const reader = new FileReader();
         reader.onload = (e) => {
             try {
                 const importedConfig = JSON.parse(e.target.result);
                 // Validar estructura v2.4
                 if (importedConfig.proyectos && importedConfig.sdaComun !== undefined &&
                     importedConfig.horasEsperadasDiarias !== undefined && importedConfig.planDiario !== undefined) {
                     saveOptions(importedConfig); // Guardar directamente
                     if (window.showToast) window.showToast('¡Config JSON importada y guardada!', 'success');
                 } else { throw new Error('El archivo JSON no tiene el formato V2.4 correcto.'); }
             } catch (error) { if (window.showToast) window.showToast(`Error al importar JSON: ${error.message}`, 'error'); }
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
                        reglasPlanificacion: [] // Mantener vacío/eliminar si la estructura ya no lo usa
                    };

                    saveOptions(newConfig); // Guardar la config importada
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

    // --- FUNCIÓN ACTUALIZADA: Extrae Proyectos, SDA (numérico), Horas y Plan Diario ---
    function findEmployeeDataAndPlanInCsv(data, employeeId) {
        let employeeRowIndex = -1; let headerRow = []; let headerIndex = -1;
        let dateColumns = {}; const projectsMap = new Map();
        let sdaComun = ""; // Guardará solo el número
        let horasRow = []; const planDiario = {}; let foundHorasRow = false;

        // 1. Encontrar encabezados y parsear fechas
        for (let i = 0; i < data.length; i++) {
            const lowerCaseRow = data[i].map(cell => (cell || '').trim().toLowerCase());
            if (lowerCaseRow.includes('usuario')) {
                headerRow = data[i].map(cell => (cell || '').trim()); headerIndex = i;
                console.log(`[CSV Parser] Encabezados en fila ${headerIndex + 1}.`); break;
            }
        }
        if (headerIndex === -1) throw new Error('Fila de encabezados no encontrada.');
        const lowerHeader = headerRow.map(h => h.toLowerCase());
        const userIdCol = lowerHeader.indexOf('usuario'); const sdaCol = lowerHeader.indexOf('sdatool'); const featureCol = lowerHeader.indexOf('feature');
        if (userIdCol === -1 || sdaCol === -1 || featureCol === -1) throw new Error('Columnas clave no encontradas.');
        // Parsear fechas (sin cambios)
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
                const dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
            const sdaCompleto = (row[sdaCol] || '').trim(); // SDA completo
            const codigo = currentFeature;
            const isHorasEsperadasRow = currentFeature.toLowerCase() === 'horas esperadas';

            let isEmployeeRow = (employeeRowIndex === -1 && currentUserId === employeeId) || (employeeRowIndex !== -1 && currentUserId === '');

            if (isEmployeeRow) {
                if (employeeRowIndex === -1) employeeRowIndex = i; // Marcar inicio

                // --- CORRECCIÓN: Extraer solo número de SDA ---
                if (!sdaComun && sdaCompleto) {
                    const sdaMatch = sdaCompleto.match(/SDATool-(\d+)/i);
                    const sdaNumero = sdaMatch ? sdaMatch[1] : '';
                    if (sdaNumero) sdaComun = sdaNumero; // Guardar solo el número
                }
                // --- FIN CORRECCIÓN ---

                // Añadir proyecto si es nuevo y NO es horas esperadas
                if (codigo && !isHorasEsperadasRow && !projectsMap.has(codigo)) {
                    projectsMap.set(codigo, { index: projectsMap.size });
                }

                // Procesar plan diario si es fila de proyecto
                if (codigo && !isHorasEsperadasRow && projectsMap.has(codigo)) {
                    const proyectoIndex = projectsMap.get(codigo).index;
                    for (const colIndex in dateColumns) {
                        const dateStr = dateColumns[colIndex];
                        const cellValue = (row[colIndex] || '').trim().toLowerCase();
                        if (!cellValue) continue; // Saltar celdas vacías

                        let tipoTarea = null;
                        let tieneHoraFija = cellValue.includes('1');
                        for (const inicial in tipoTareaMap) {
                            if (cellValue.includes(inicial)) { tipoTarea = tipoTareaMap[inicial]; break; }
                        }
                        let tipoImputacionHoras = null;
                        if (tieneHoraFija && tipoTarea) tipoImputacionHoras = 'fija_patron';
                        else if (tieneHoraFija) tipoImputacionHoras = 'fija';
                        else if (tipoTarea) tipoImputacionHoras = 'patron';

                        if (tipoTarea && tipoImputacionHoras) {
                            if (!planDiario[dateStr]) planDiario[dateStr] = [];
                            planDiario[dateStr].push({ proyectoIndex, tipoTarea, tipoImputacionHoras });
                        } else if (tipoImputacionHoras === 'fija') {
                             // Lógica temporal si solo hay '1'
                             tipoTarea = 'Construcción'; // Asumir Construcción (REVISAR)
                             console.warn(`[CSV Parser] Día ${dateStr}, Prj ${codigo}: '1' sin tipo. Asumiendo ${tipoTarea}.`);
                             if (!planDiario[dateStr]) planDiario[dateStr] = [];
                             planDiario[dateStr].push({ proyectoIndex, tipoTarea, tipoImputacionHoras });
                        }
                    } // fin for dateColumns
                } // fin if es fila de proyecto

                // Comprobar si es la fila de Horas Esperadas
                if (isHorasEsperadasRow) { horasRow = row; foundHorasRow = true; }

            } else if (employeeRowIndex !== -1) { // Ya pasamos al empleado
                 if (!foundHorasRow && isHorasEsperadasRow){ horasRow = row; foundHorasRow = true; }
                 if(!isHorasEsperadasRow) { break; } // Parar si no es la fila de horas
            }
             if (foundHorasRow && i > employeeRowIndex) break; // Parar si ya procesamos horas
        } // fin for data rows

        if (employeeRowIndex === -1) return null; // Empleado no encontrado

        // 3. Extraer Horas Esperadas (sin cambios)
        const horasEsperadas = {};
        if (horasRow.length > 0) {
             for (const colIndex in dateColumns) {
                 if (colIndex < horasRow.length && horasRow[colIndex] !== undefined) {
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
    // Eliminado: addProjectBtn listener
    // Eliminado: addReglaBtn listener
    // Eliminado: saveBtn listener
    exportBtn.addEventListener('click', exportConfig);
    importJsonBtn.addEventListener('click', () => importJsonFileInput.click());
    importJsonFileInput.addEventListener('change', importConfigJson);
    importCsvBtn.addEventListener('click', () => {
        const employeeId = employeeIdInput.value;
        if (!employeeId) { if (window.showToast) window.showToast('Introduce tu ID.', 'error'); return; }
        importCsvFileInput.click();
    });
    importCsvFileInput.addEventListener('change', (event) => { // Llama a la nueva función
        const file = event.target.files[0];
        const employeeId = employeeIdInput.value;
        if (file && employeeId) { parseCsvAndExtractData(file, employeeId); }
        event.target.value = '';
    });

    restoreOptions(); // Carga inicial
});