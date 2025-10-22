document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const saveBtn = document.getElementById('save');
    const taskDefinitionContainer = document.getElementById('task-definitions');
    const addTaskBtn = document.getElementById('add-task-btn');
    const timeContainerReducida = document.getElementById('time-assignments-reducida');
    const timeContainerNormal = document.getElementById('time-assignments-normal');
    const toggleReducida = document.getElementById('toggle-reducida');

    const taskDefinitionTemplate = document.getElementById('task-definition-template');
    const timeAssignmentTemplate = document.getElementById('time-assignment-template');

    // Estructura de datos por defecto
    const defaultConfig = {
    tasks: [ { nombre: "", codigoProyecto: "" } ],
    jornadas: {
        normal: [ { horas: "", minutos: "" } ],
        reducida: [ { horas: "", minutos: "" } ]
    },
    jornadaReducidaActiva: true
};

    const render = (data) => {
        taskDefinitionContainer.innerHTML = '';
        timeContainerReducida.innerHTML = '';
        timeContainerNormal.innerHTML = '';

        const emptyTasksMsg = document.getElementById('empty-tasks-msg');
        const emptyTimesMsg = document.getElementById('empty-times-msg');

        if (typeof data.jornadaReducidaActiva !== 'undefined') {
            toggleReducida.checked = Boolean(data.jornadaReducidaActiva);
        }

        const reducirVisible = toggleReducida.checked;

        const tasks = data.tasks || [];
        const jornadasNormal = data.jornadas?.normal || [];
        const jornadasReducida = data.jornadas?.reducida || [];

        tasks.forEach((task, index) => {
            const taskRow = taskDefinitionTemplate.content.cloneNode(true).querySelector('.task-row');
            taskRow.dataset.index = index;
            taskRow.querySelector('.task-nombre').value = task.nombre || '';
            taskRow.querySelector('.task-codigo').value = task.codigoProyecto || '';
            taskDefinitionContainer.appendChild(taskRow);

            const projectCode = task.codigoProyecto ? String(task.codigoProyecto).trim() : '';
            const labelTextBase = task.nombre || `Tarea ${index + 1}`;
            const labelText = projectCode ? `${labelTextBase} — [${projectCode}]` : labelTextBase;

            const timeRow7h = timeAssignmentTemplate.content.cloneNode(true).querySelector('.time-row');
            timeRow7h.querySelector('.task-label').textContent = labelText;
            timeRow7h.querySelector('.task-horas').value = jornadasReducida[index]?.horas || '';
            timeRow7h.querySelector('.task-minutos').value = jornadasReducida[index]?.minutos || '';
            timeContainerReducida.appendChild(timeRow7h);

            const timeRow9h = timeAssignmentTemplate.content.cloneNode(true).querySelector('.time-row');
            timeRow9h.querySelector('.task-label').textContent = labelText;
            timeRow9h.querySelector('.task-horas').value = jornadasNormal[index]?.horas || '';
            timeRow9h.querySelector('.task-minutos').value = jornadasNormal[index]?.minutos || '';
            timeContainerNormal.appendChild(timeRow9h);
        });

        // Mostrar mensajes de estado y esconder/mostrar la sección de tiempos cuando no hay tareas
        const timeSection = document.getElementById('time-section');
        if (!tasks.length) {
            if (emptyTasksMsg) emptyTasksMsg.style.display = '';
            if (emptyTimesMsg) emptyTimesMsg.style.display = '';
            if (timeSection) timeSection.style.display = 'none';
        } else {
            if (emptyTasksMsg) emptyTasksMsg.style.display = 'none';
            if (emptyTimesMsg) emptyTimesMsg.style.display = 'none';
            if (timeSection) timeSection.style.display = '';
        }


    // Añadir ejemplo
    const addExampleBtn = document.getElementById('add-example-btn');
    if (addExampleBtn) {
        addExampleBtn.addEventListener('click', () => {
            const exampleConfig = {
                tasks: [
                    { nombre: 'Construcción', codigoProyecto: 'WSONE-001' },
                    { nombre: 'Planificación', codigoProyecto: 'WSONE-002' }
                ],
                jornadas: {
                    normal: [ { horas: '07', minutos: '00' }, { horas: '02', minutos: '00' } ],
                    reducida: [ { horas: '06', minutos: '00' }, { horas: '01', minutos: '00' } ]
                },
                jornadaReducidaActiva: true
            };
            // Only populate the UI with the example; do NOT persist until the user clicks Save
            showStatus('Ejemplo cargado en la UI. Pulsa Guardar para persistir.', 'green', 3000);
            render(exampleConfig);
        });
    }
        const labelReducida = document.getElementById('label-reducida');
        if (reducirVisible) {
            labelReducida.style.display = '';
            timeContainerReducida.style.display = '';
        } else {
            labelReducida.style.display = 'none';
            timeContainerReducida.style.display = 'none';
        }
    };

    const getDataFromDOM = () => {
        const data = { tasks: [], jornadas: { normal: [], reducida: [] } };
        taskDefinitionContainer.querySelectorAll('.task-row').forEach(row => {
            data.tasks.push({
                nombre: row.querySelector('.task-nombre').value,
                codigoProyecto: row.querySelector('.task-codigo').value
            });
        });

        timeContainerReducida.querySelectorAll('.time-row').forEach(row => {
            data.jornadas.reducida.push({
                horas: row.querySelector('.task-horas').value,
                minutos: row.querySelector('.task-minutos').value
            });
        });

        timeContainerNormal.querySelectorAll('.time-row').forEach(row => {
            data.jornadas.normal.push({
                horas: row.querySelector('.task-horas').value,
                minutos: row.querySelector('.task-minutos').value
            });
        });

        return data;
    };

    const showStatus = (message, color = 'green', ms = 3000) => {
        const type = color === 'red' ? 'error' : (color === 'green' ? 'success' : 'info');
        if (window && typeof window.showToast === 'function') {
            window.showToast(message, type, ms);
        } else {
            console.log('[TOAST FALLBACK]', message);
        }
    };

    const validateLastTask = () => {
        const lastTaskRow = taskDefinitionContainer.lastElementChild;
        if (!lastTaskRow) return true;
        const inputs = lastTaskRow.querySelectorAll('input');
        const isAnyInputEmpty = Array.from(inputs).some(input => input.value.trim() === '');

        if (isAnyInputEmpty) {
            showStatus('Completa la última tarea antes de añadir otra.', 'red', 2500);
            return false;
        }
        return true;
    };

    const restoreOptions = () => {
        chrome.storage.sync.get({ config: defaultConfig }, items => {
            const cfg = items.config || defaultConfig;
            render(cfg);
        });
    };

    // --- EXPORT / IMPORT ---
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    const exportConfig = () => {
        chrome.storage.sync.get({ config: defaultConfig }, items => {
            const payload = { exportedAt: new Date().toISOString(), config: items.config || defaultConfig };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `axet-config-${stamp}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showStatus('Exportada configuración', 'green', 1800);
        });
    };

    const applyImportedData = (obj) => {
        // Normalize various shapes into canonical { tasks, jornadas, jornadaReducidaActiva }
        if (!obj) throw new Error('Archivo vacío o inválido');
        if (obj.config && (obj.config.tasks || obj.config.jornadas)) return obj.config;
        if (obj.tareasConfig && obj.tareasConfig.jornadas) {
            const t = obj.tareasConfig;
            const normal = [];
            const reducida = [];
            const tasks = [];
            const maxLen = Math.max((t.jornadas?.normal || []).length, (t.jornadas?.reducida || []).length);
            for (let i = 0; i < maxLen; i++) {
                const n = (t.jornadas?.normal || [])[i] || { nombre: '', codigoProyecto: '', horas: '', minutos: '' };
                const r = (t.jornadas?.reducida || [])[i] || { nombre: '', codigoProyecto: '', horas: '', minutos: '' };
                const nombre = n.nombre || r.nombre || '';
                const codigo = n.codigoProyecto || r.codigoProyecto || '';
                tasks.push({ nombre, codigoProyecto: codigo });
                normal.push({ horas: n.horas || '', minutos: n.minutos || '' });
                reducida.push({ horas: r.horas || '', minutos: r.minutos || '' });
            }
            return { tasks, jornadas: { normal, reducida }, jornadaReducidaActiva: Boolean(t.jornadaReducidaActiva) };
        }
        // If it's already in { tasks, jornadas } shape
        if (obj.tasks && obj.jornadas) return obj;
        throw new Error('Formato de importación no reconocido');
    };

    const handleFileInput = (file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                const cfg = applyImportedData(parsed);
                chrome.storage.sync.set({ config: cfg }, () => {
                    showStatus('Configuración importada', 'green', 1800);
                    render(cfg);
                });
            } catch (err) {
                console.error('Error importando archivo:', err);
                showStatus('Error importando: ' + (err.message || 'formato inválido'), 'red', 3500);
            }
        };
        reader.onerror = () => {
            showStatus('Error leyendo el archivo', 'red', 2500);
        };
        reader.readAsText(file);
    };

    exportBtn?.addEventListener('click', exportConfig);
    importBtn?.addEventListener('click', () => importFile.click());
    importFile?.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleFileInput(file);
        e.target.value = '';
    });

    const saveOptions = () => {
        const currentData = getDataFromDOM();
        const parseToMinutes = (h, m) => {
            const hh = parseInt(h, 10) || 0;
            const mm = parseInt(m, 10) || 0;
            return hh * 60 + mm;
        };

        const normalMax = toggleReducida.checked ? 9 * 60 : 8 * 60;
        const reducidaMax = 7 * 60;

        const totalNormalMinutes = (currentData.jornadas?.normal || []).reduce((acc, t) => acc + parseToMinutes(t.horas, t.minutos), 0);
        const totalReducidaMinutes = (currentData.jornadas?.reducida || []).reduce((acc, t) => acc + parseToMinutes(t.horas, t.minutos), 0);

        if (totalNormalMinutes > normalMax) {
            showStatus(`Error: El total de la Jornada Normal excede el máximo permitido (${Math.floor(normalMax/60)}h). Ajusta los tiempos.`, 'red', 4000);
            return;
        }
        if (toggleReducida.checked && totalReducidaMinutes > reducidaMax) {
            showStatus(`Error: El total de la Jornada Reducida excede el máximo permitido (${Math.floor(reducidaMax/60)}h). Ajusta los tiempos.`, 'red', 4000);
            return;
        }

        const tareasConfig = { jornadas: { normal: [], reducida: [] }, jornadaReducidaActiva: Boolean(toggleReducida.checked) };
        const tasks = currentData.tasks || [];
        const normalTimes = currentData.jornadas?.normal || [];
        const reducidaTimes = currentData.jornadas?.reducida || [];

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i] || { nombre: '', codigoProyecto: '' };
            const n = normalTimes[i] || { horas: '', minutos: '' };
            const r = reducidaTimes[i] || { horas: '', minutos: '' };
            tareasConfig.jornadas.normal.push({ nombre: task.nombre || '', codigoProyecto: task.codigoProyecto || '', horas: n.horas || '', minutos: n.minutos || '' });
            tareasConfig.jornadas.reducida.push({ nombre: task.nombre || '', codigoProyecto: task.codigoProyecto || '', horas: r.horas || '', minutos: r.minutos || '' });
        }

        const configToSave = { ...currentData, jornadaReducidaActiva: Boolean(toggleReducida.checked) };

        chrome.storage.sync.set({ config: configToSave }, () => {
            showStatus('¡Configuración guardada!', 'green', 2000);
        });
    };

    addTaskBtn.addEventListener('click', () => {
        if (validateLastTask()) {
            const currentData = getDataFromDOM();
            currentData.tasks.push({});
            currentData.jornadas = currentData.jornadas || { normal: [], reducida: [] };
            currentData.jornadas.reducida.push({ horas: '', minutos: '' });
            currentData.jornadas.normal.push({ horas: '', minutos: '' });
            render(currentData);
        }
    });

    toggleReducida.addEventListener('change', () => {
        const currentData = getDataFromDOM();
        currentData.jornadaReducidaActiva = toggleReducida.checked;
        render(currentData);
    });

    taskDefinitionContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-task-btn')) {
            const currentData = getDataFromDOM();
            const indexToRemove = parseInt(e.target.closest('.task-row').dataset.index, 10);
            currentData.tasks.splice(indexToRemove, 1);
            currentData.jornadas = currentData.jornadas || { normal: [], reducida: [] };
            currentData.jornadas.reducida.splice(indexToRemove, 1);
            currentData.jornadas.normal.splice(indexToRemove, 1);
            render(currentData);
        }
    });

    taskDefinitionContainer.addEventListener('input', (e) => {
        const target = e.target;
        const row = target.closest('.task-row');
        if (!row) return;
        const index = parseInt(row.dataset.index, 10);

        // Determine display name and project code for label
        const nameInput = row.querySelector('.task-nombre');
        const codeInput = row.querySelector('.task-codigo');
        const nameVal = nameInput ? (nameInput.value || `Tarea ${index + 1}`) : `Tarea ${index + 1}`;
        const codeVal = codeInput ? String(codeInput.value || '').trim() : '';
        const labelText = codeVal ? `${nameVal} — [${codeVal}]` : nameVal;

        if (timeContainerReducida.children[index]) {
            const lbl7 = timeContainerReducida.children[index].querySelector('.task-label');
            if (lbl7) lbl7.textContent = labelText;
        }
        if (timeContainerNormal.children[index]) {
            const lbl9 = timeContainerNormal.children[index].querySelector('.task-label');
            if (lbl9) lbl9.textContent = labelText;
        }
    });

    saveBtn.addEventListener('click', saveOptions);
    restoreOptions();
});
