document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const saveBtn = document.getElementById('save');
    const addProjectBtn = document.getElementById('add-project');
    const addReglaBtn = document.getElementById('add-asignacion-rule'); // Renombrado para claridad

    const projectList = document.getElementById('project-list');
    const reglasList = document.getElementById('asignacion-list'); // Renombrado para claridad

    const projectTemplate = document.getElementById('project-template');
    const reglaTemplate = document.getElementById('asignacion-rule-template'); // Renombrado

    const exportBtn = document.getElementById('export-btn');
    const importJsonBtn = document.getElementById('import-json-btn');
    const importJsonFileInput = document.getElementById('import-json-file');
    const employeeIdInput = document.getElementById('employee-id');
    const importCsvBtn = document.getElementById('import-csv-btn');
    const importCsvFileInput = document.getElementById('import-csv-file');
    const statusEl = document.getElementById('status');

    // Estructura v2.3: tipoImputacionHoras añadido a reglasPlanificacion
    const defaultConfig = {
        proyectos: [], // Array de { codigo: string }
        sdaComun: "",
        horasEsperadasDiarias: {}, // Objeto { 'YYYY-MM-DD': 'horas/codigo', ... }
        reglasPlanificacion: [] // Array de { proyectoIndex: string, tipoTarea: string, inicio: string, fin: string, tipoImputacionHoras: string }
    };

    let currentProyectos = []; // Cache local de proyectos { codigo }
    let currentSdaComun = ""; // Cache local de SDA
    let currentHorasEsperadas = {}; // Cache local de horas

    // --- RENDERIZACIÓN ---

    // renderProjectList adaptado: Proyectos solo tienen código
    function renderProjectList(proyectos = [], sdaGlobal = "") {
        projectList.innerHTML = '';
        currentProyectos = [];
        currentSdaComun = sdaGlobal; // Actualizar cache SDA
        if (!proyectos || !proyectos.length) return;

        proyectos.forEach((proj, index) => {
            // Guardar solo el código en la caché
            currentProyectos.push({ codigo: proj.codigo });
            const row = projectTemplate.content.cloneNode(true).querySelector('.rule-row');
            row.dataset.index = index;
            row.querySelector('.project-codigo').value = proj.codigo || '';
            // Opcional: Mostrar el SDA común en la fila
            const sdaDisplay = row.querySelector('.project-sda-display');
            if (sdaDisplay) {
                sdaDisplay.textContent = sdaGlobal ? `(SDA: ${sdaGlobal})` : '(SDA no definido)';
            }
            projectList.appendChild(row);
        });
    }

    // Renombrada y adaptada para la nueva estructura de reglas
    function renderReglasPlanificacion(reglas = []) {
        reglasList.innerHTML = ''; // Usa el nuevo ID/nombre
        if (!reglas || !reglas.length) return;
        reglas.forEach((regla, index) => {
            const row = reglaTemplate.content.cloneNode(true).querySelector('.rule-row'); // Usa la plantilla renombrada
            row.dataset.index = index;
            const select = row.querySelector('.rule-proyecto-select');
            select.innerHTML = '<option value="">-- Proyecto --</option>'; // Limpiar
            // Llenar dropdown usando la caché actualizada de proyectos (solo códigos)
            currentProyectos.forEach((proj, projIndex) => {
                const opt = document.createElement('option');
                opt.value = projIndex; // Guardamos el índice del proyecto en la lista `currentProyectos`
                opt.textContent = `${proj.codigo || 'N/A'}`; // Mostrar solo el código
                select.appendChild(opt);
            });
            select.value = regla.proyectoIndex !== undefined ? regla.proyectoIndex : '';
            row.querySelector('.rule-tipo-tarea').value = regla.tipoTarea || 'Diseño'; // Default a Diseño
            row.querySelector('.rule-inicio').value = regla.inicio || '';
            row.querySelector('.rule-fin').value = regla.fin || '';
            // Usar el nuevo nombre de clase y las nuevas opciones
            row.querySelector('.rule-tipo-imputacion-horas').value = regla.tipoImputacionHoras || 'patron'; // Default a 'Según Patrón'
            reglasList.appendChild(row);
        });
    }

    // Renderiza toda la página
    function render(config) {
        if (!config) config = defaultConfig;
        currentHorasEsperadas = config.horasEsperadasDiarias || {}; // Actualizar caché horas
        // Renderizar proyectos PRIMERO para actualizar `currentProyectos`
        renderProjectList(config.proyectos, config.sdaComun);
        renderReglasPlanificacion(config.reglasPlanificacion); // Llamada a la función renombrada
    }

    // --- GUARDADO Y CARGA ---

    // Adaptado para guardar la estructura v2.3
    function saveOptions(configToSave, source = 'dom') {
        let config = {};
        if (source === 'import') {
            config = configToSave;
            // Validar estructura v2.3
             if (!config.proyectos || !config.reglasPlanificacion || config.sdaComun === undefined || config.horasEsperadasDiarias === undefined) {
                 if(window.showToast) window.showToast('Error: El archivo JSON importado no tiene la estructura V2.3 correcta.', 'error');
                 return; // No guardar si es inválido
             }
        } else { // 'dom'
            config.proyectos = Array.from(projectList.querySelectorAll('.rule-row')).map(row => ({
                codigo: row.querySelector('.project-codigo').value
                // SDA es global, no se guarda aquí
            }));
            // Mantenemos el SDA común y las horas esperadas que están en la caché
            config.sdaComun = currentSdaComun;
            config.horasEsperadasDiarias = currentHorasEsperadas;
            // Adaptado para leer la nueva estructura de reglas
            config.reglasPlanificacion = Array.from(reglasList.querySelectorAll('.rule-row')).map(row => ({
                proyectoIndex: row.querySelector('.rule-proyecto-select').value,
                tipoTarea: row.querySelector('.rule-tipo-tarea').value,
                inicio: row.querySelector('.rule-inicio').value,
                fin: row.querySelector('.rule-fin').value,
                tipoImputacionHoras: row.querySelector('.rule-tipo-imputacion-horas').value // Nombre de campo y clase actualizado
            }));
        }

        // Guardar la configuración completa
        chrome.storage.sync.set({ configV2: config }, () => {
            if (window.showToast) window.showToast('¡Configuración guardada!', 'success');
            render(config); // Re-renderizar después de guardar o importar
        });
    }

     // restoreOptions sin cambios funcionales
     function restoreOptions() {
        chrome.storage.sync.get({ configV2: defaultConfig }, items => {
            render(items.configV2 || defaultConfig); // Usar default si no hay nada guardado
        });
    }

    // --- IMPORTAR / EXPORTAR JSON ---
    // exportConfig adaptado para exportar v2.3
    function exportConfig() {
        chrome.storage.sync.get({ configV2: defaultConfig }, items => {
            const dataStr = JSON.stringify(items.configV2, null, 2); // Exportará la estructura v2.3
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const a = document.createElement('a');
            a.href = url; a.download = 'axet-autoincurrido-config-v2.json';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (window.showToast) window.showToast('Configuración exportada.', 'info');
        });
    }

    // importConfigJson adaptado para validar v2.3
    function importConfigJson(event) {
         const file = event.target.files[0]; if (!file) return;
         const reader = new FileReader();
         reader.onload = (e) => {
             try {
                 const importedConfig = JSON.parse(e.target.result);
                 // Validar estructura v2.3
                 if (importedConfig.proyectos && importedConfig.reglasPlanificacion && importedConfig.sdaComun !== undefined && importedConfig.horasEsperadasDiarias !== undefined) {
                     saveOptions(importedConfig, 'import'); // Guardará y LUEGO renderizará
                     if (window.showToast) window.showToast('¡Configuración JSON importada y guardada!', 'success');
                 } else { throw new Error('El archivo no tiene el formato V2.3 correcto.'); }
             } catch (error) { if (window.showToast) window.showToast(`Error al importar JSON: ${error.message}`, 'error'); }
             finally { importJsonFileInput.value = ''; }
         };
         reader.readAsText(file);
     }


    // --- LÓGICA: IMPORTAR PROYECTOS Y HORAS DESDE CSV (Sin cambios) ---
    // Sigue importando solo proyectos {codigo}, sdaComun y horasEsperadasDiarias
    function parseCsvAndExtractData(file, employeeId) {
        if (!employeeId) { if (window.showToast) window.showToast('Introduce tu ID de empleado.', 'error'); return; }
        if (!window.Papa) { if (window.showToast) window.showToast('Error: No se pudo cargar PapaParse.', 'error'); return; }

        Papa.parse(file, {
            complete: (results) => {
                try {
                    console.log("CSV Parseado:", results.data);
                    const extractedData = findEmployeeDataInCsv(results.data, employeeId.trim().toUpperCase());
                    if (!extractedData || extractedData.proyectos.length === 0) {
                        if (window.showToast) window.showToast(`No se encontraron datos para el ID ${employeeId}.`, 'error', 5000); return;
                    }
                    console.log("Datos extraídos:", extractedData);
                    chrome.storage.sync.get({ configV2: defaultConfig }, items => {
                        const currentConfig = items.configV2 || defaultConfig;
                        currentConfig.proyectos = extractedData.proyectos; // Reemplaza proyectos
                        currentConfig.sdaComun = extractedData.sdaComun; // Reemplaza SDA
                        currentConfig.horasEsperadasDiarias = extractedData.horasEsperadas; // Reemplaza horas
                        // Mantenemos reglas existentes
                        saveOptions(currentConfig, 'import'); // Guardar y re-renderizar
                        if (window.showToast) window.showToast(`¡${extractedData.proyectos.length} proyectos y horas esperadas importados! Revisa/crea las reglas de planificación.`, 'success', 5000);
                    });
                } catch (error) {
                    console.error("Error procesando CSV:", error);
                    if (window.showToast) window.showToast(`Error al procesar CSV: ${error.message}`, 'error', 5000);
                }
            },
            error: (error) => {
                 console.error("Error al parsear CSV:", error);
                 if (window.showToast) window.showToast(`Error al leer el archivo CSV: ${error.message}`, 'error');
            }
        });
    }

    // findEmployeeDataInCsv sin cambios (ya ignora 'Horas Esperadas' para proyectos)
    function findEmployeeDataInCsv(data, employeeId) {
        let employeeRowIndex = -1; let headerRow = []; let headerIndex = -1;
        let dateColumns = {}; const projects = []; let sdaComun = ""; let horasRow = [];
        let foundHorasRow = false;

        for (let i = 0; i < data.length; i++) {
            const lowerCaseRow = data[i].map(cell => (cell || '').trim().toLowerCase());
            if (lowerCaseRow.includes('usuario')) {
                headerRow = data[i].map(cell => (cell || '').trim()); headerIndex = i;
                console.log(`[CSV Parser] Encabezados en fila ${headerIndex + 1}.`); break;
            }
        }
        if (headerIndex === -1) throw new Error('No se encontró fila de encabezados (buscando "Usuario").');

        const lowerHeader = headerRow.map(h => h.toLowerCase());
        const userIdCol = lowerHeader.indexOf('usuario'); const sdaCol = lowerHeader.indexOf('sdatool');
        const featureCol = lowerHeader.indexOf('feature');
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
                 const dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                 dateColumns[j] = dateStr;
             }
        }
        if(Object.keys(dateColumns).length === 0) console.warn("[CSV Parser] No se encontraron columnas de fecha válidas.");
        else console.log("[CSV Parser] Mapeo de columnas a fechas:", dateColumns);

        for (let i = headerIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length <= Math.max(userIdCol, sdaCol, featureCol) || row.every(cell => (cell || '').trim() === '')) continue;
            const currentUserId = (row[userIdCol] || '').trim().toUpperCase();
            const currentFeature = (row[featureCol] || '').trim();
            const sda = (row[sdaCol] || '').trim(); const codigo = currentFeature;
            const isHorasEsperadasRow = currentFeature.toLowerCase() === 'horas esperadas';

            if (employeeRowIndex === -1 && currentUserId === employeeId) {
                employeeRowIndex = i;
                if (!sdaComun && sda) sdaComun = sda;
                if (codigo && !isHorasEsperadasRow && !projects.some(p => p.codigo === codigo)) projects.push({ codigo: codigo });
            } else if (employeeRowIndex !== -1) {
                 if (currentUserId === '') {
                     if (!sdaComun && sda) sdaComun = sda;
                     if (codigo && !isHorasEsperadasRow && !projects.some(p => p.codigo === codigo)) projects.push({ codigo: codigo });
                     if (isHorasEsperadasRow) { horasRow = row; foundHorasRow = true; }
                 } else {
                     if (!foundHorasRow && isHorasEsperadasRow){ horasRow = row; foundHorasRow = true; }
                     if(!isHorasEsperadasRow) { break; }
                 }
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
         console.log("[CSV Parser] Horas Esperadas extraídas:", horasEsperadas);

        return { proyectos: projects, sdaComun: sdaComun, horasEsperadas: horasEsperadas };
    }

    function getDataFromDOM() {
        const config = {
            proyectos: Array.from(projectList.querySelectorAll('.rule-row')).map(row => ({
                codigo: row.querySelector('.project-codigo').value
            })),
            sdaComun: currentSdaComun, // Tomar de caché
            horasEsperadasDiarias: currentHorasEsperadas, // Tomar de caché
            reglasPlanificacion: Array.from(reglasList.querySelectorAll('.rule-row')).map(row => ({
                proyectoIndex: row.querySelector('.rule-proyecto-select').value,
                tipoTarea: row.querySelector('.rule-tipo-tarea').value,
                inicio: row.querySelector('.rule-inicio').value,
                fin: row.querySelector('.rule-fin').value,
                tipoImputacionHoras: row.querySelector('.rule-tipo-imputacion-horas').value
            }))
        };
        return config;
    }


    // --- EVENT LISTENERS ---
    // Adaptado para la nueva plantilla de proyecto
    addProjectBtn.addEventListener('click', () => {
        const row = projectTemplate.content.cloneNode(true);
        const sdaDisplay = row.querySelector('.project-sda-display');
        if (sdaDisplay) sdaDisplay.textContent = currentSdaComun ? `(SDA: ${currentSdaComun})` : '(SDA no definido)';
        projectList.appendChild(row);
    });

    // Adaptado para la nueva plantilla de reglas
    addReglaBtn.addEventListener('click', () => {
        const row = reglaTemplate.content.cloneNode(true);
        const select = row.querySelector('.rule-proyecto-select');
        select.innerHTML = '<option value="">-- Proyecto --</option>'; // Limpiar
        currentProyectos.forEach((proj, projIndex) => { // Usar caché actualizada
            const opt = document.createElement('option');
            opt.value = projIndex;
            opt.textContent = `${proj.codigo || 'N/A'}`; // Mostrar solo código
            select.appendChild(opt);
        });
        reglasList.appendChild(row); // Añadir a la lista correcta
    });

    // Eliminar filas (sin cambios funcionales)
    document.querySelector('.options-container').addEventListener('click', (e) => {
        const target = e.target;
        const row = target.closest('.rule-row');
        if (!row) return; // Salir si el clic no fue dentro de una fila

        const listContainer = row.closest('.list-container');
        if (!listContainer) return;

        // --- Lógica para ELIMINAR ---
        if (target.classList.contains('btn-remove')) {
            row.remove();
            // Si eliminamos un proyecto, forzamos guardado y re-renderizado
            // para actualizar los dropdowns de las reglas.
            if (listContainer.id === 'project-list') {
                saveOptions(null, 'dom');
            }
            // Nota: Si solo eliminamos una regla de planificación, no es estrictamente
            // necesario re-renderizar todo, pero tampoco hace daño. Se podría optimizar.
        }
        // --- NUEVA Lógica para CLONAR (solo para reglas de planificación) ---
        else if (target.classList.contains('btn-clone') && listContainer.id === 'asignacion-list') {
            const indexToClone = parseInt(row.dataset.index, 10);

            // 1. Obtener la configuración actual desde el DOM (incluye cambios no guardados)
            const currentConfig = getDataFromDOM(); // Usamos la función que lee el estado actual de la UI

            // 2. Validar que la regla exista
            if (indexToClone >= 0 && indexToClone < currentConfig.reglasPlanificacion.length) {
                // 3. Crear una copia profunda de la regla a clonar
                const ruleToClone = currentConfig.reglasPlanificacion[indexToClone];
                // Usamos JSON.parse/stringify para una copia profunda simple
                const clonedRule = JSON.parse(JSON.stringify(ruleToClone));

                // 4. Insertar la copia justo después de la original en el array
                currentConfig.reglasPlanificacion.splice(indexToClone + 1, 0, clonedRule);

                // 5. Re-renderizar solo la lista de reglas de planificación
                renderReglasPlanificacion(currentConfig.reglasPlanificacion);

                if (window.showToast) window.showToast('Regla clonada. No olvides Guardar Cambios.', 'info');
            } else {
                console.error("Índice para clonar inválido:", indexToClone);
            }
        }
    });

    // Botones principales (sin cambios funcionales)
    saveBtn.addEventListener('click', () => saveOptions(null, 'dom'));
    exportBtn.addEventListener('click', exportConfig);
    importJsonBtn.addEventListener('click', () => importJsonFileInput.click());
    importJsonFileInput.addEventListener('change', importConfigJson);
    importCsvBtn.addEventListener('click', () => {
        const employeeId = employeeIdInput.value;
        if (!employeeId) { if (window.showToast) window.showToast('Introduce tu ID de empleado primero.', 'error'); return; }
        importCsvFileInput.click();
    });
    importCsvFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        const employeeId = employeeIdInput.value;
        if (file && employeeId) { parseCsvAndExtractData(file, employeeId); }
        event.target.value = ''; // Resetear input
    });

    restoreOptions(); // Carga inicial
});