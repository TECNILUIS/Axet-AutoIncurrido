document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const saveBtn = document.getElementById('save');
    const statusEl = document.getElementById('status');
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

    /**
     * Sincroniza y renderiza todo el formulario a partir de los datos.
     * Esta es la función principal que dibuja la interfaz.
     */
    const render = (data) => {
        // 1. Limpia los contenedores
    taskDefinitionContainer.innerHTML = '';
    timeContainerReducida.innerHTML = '';
    timeContainerNormal.innerHTML = '';

        // Ajustar el estado del toggle si se provee antes de renderizar filas
        if (typeof data.jornadaReducidaActiva !== 'undefined') {
            toggleReducida.checked = Boolean(data.jornadaReducidaActiva);
        }

        const reducirVisible = toggleReducida.checked;

        // 2. Renderiza las definiciones de tareas
        const tasks = data.tasks || [];
    const jornadasNormal = data.jornadas?.normal || [];
    const jornadasReducida = data.jornadas?.reducida || [];

        tasks.forEach((task, index) => {
            const taskRow = taskDefinitionTemplate.content.cloneNode(true).querySelector('.task-row');
            taskRow.dataset.index = index; // Guardamos el índice para referencia
            taskRow.querySelector('.task-nombre').value = task.nombre || '';
            taskRow.querySelector('.task-codigo').value = task.codigoProyecto || '';
            taskDefinitionContainer.appendChild(taskRow);
            
            // 3. Renderiza las asignaciones de tiempo para esta tarea
            // Jornada Reducida (7h) -> siempre renderizamos las filas para preservar valores,
            // pero el contenedor se oculta si el toggle está desactivado.
            const timeRow7h = timeAssignmentTemplate.content.cloneNode(true).querySelector('.time-row');
            timeRow7h.querySelector('.task-label').textContent = task.nombre || `Tarea ${index + 1}`;
            timeRow7h.querySelector('.task-horas').value = jornadasReducida[index]?.horas || '';
            timeRow7h.querySelector('.task-minutos').value = jornadasReducida[index]?.minutos || '';
            timeContainerReducida.appendChild(timeRow7h);

            // Jornada Normal (9h/8h según configuración)
            const timeRow9h = timeAssignmentTemplate.content.cloneNode(true).querySelector('.time-row');
            timeRow9h.querySelector('.task-label').textContent = task.nombre || `Tarea ${index + 1}`;
            timeRow9h.querySelector('.task-horas').value = jornadasNormal[index]?.horas || '';
            timeRow9h.querySelector('.task-minutos').value = jornadasNormal[index]?.minutos || '';
            timeContainerNormal.appendChild(timeRow9h);
        });
        // Mostrar/ocultar el bloque de jornada reducida según el toggle
        const labelReducida = document.getElementById('label-reducida');
        if (reducirVisible) {
            labelReducida.style.display = '';
            timeContainerReducida.style.display = '';
        } else {
            labelReducida.style.display = 'none';
            timeContainerReducida.style.display = 'none';
        }
    };

    /**
     * Recoge los datos del DOM, los estructura y los devuelve.
     */
    const getDataFromDOM = () => {
        // Devolveremos la nueva forma (jornadas.normal/reducida) pero seguiremos guardando
        // compatiblemente en 'config' y en 'tareasConfig' para el content script.
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

    /**
     * Valida la última tarea antes de añadir una nueva.
     */
    const validateLastTask = () => {
        const lastTaskRow = taskDefinitionContainer.lastElementChild;
        if (!lastTaskRow) return true;
        const inputs = lastTaskRow.querySelectorAll('input');
        const isAnyInputEmpty = Array.from(inputs).some(input => input.value.trim() === '');

        if (isAnyInputEmpty) {
            statusEl.textContent = 'Completa la última tarea antes de añadir otra.';
            statusEl.style.color = 'red';
            setTimeout(() => { statusEl.textContent = ''; }, 2500);
            return false;
        }
        return true;
    };
    
    /**
     * Carga la configuración desde chrome.storage y renderiza el formulario.
     */
    const restoreOptions = () => {
        chrome.storage.sync.get({ config: defaultConfig }, items => {
            // Compatibilidad: si el usuario tenía solo tareasConfig guardado (por content.js), combinar
            const cfg = items.config || defaultConfig;
            render(cfg);
        });
    };

    /**
     * Guarda la configuración en chrome.storage.
     * También convierte los datos al formato que espera el content.js
     */
    const saveOptions = () => {
        const currentData = getDataFromDOM();
        
        // Antes de construir el objeto para guardar, validamos que el sumatorio por jornada no exceda
        // las horas permitidas según el toggle.
        const parseToMinutes = (h, m) => {
            const hh = parseInt(h, 10) || 0;
            const mm = parseInt(m, 10) || 0;
            return hh * 60 + mm;
        };

        // Si jornadaReducida activa: Normal=9h (540min), Reducida=7h (420min)
        // Si desactivada: Normal=8h (480min), Reducida no se aplica (pero dejamos valida 7h si el usuario la usa)
        const normalMax = toggleReducida.checked ? 9 * 60 : 8 * 60;
        const reducidaMax = 7 * 60;

    // Calculamos sumatorios por jornada (sumamos todas las tareas configuradas)
    const totalNormalMinutes = (currentData.jornadas?.normal || []).reduce((acc, t) => acc + parseToMinutes(t.horas, t.minutos), 0);
    const totalReducidaMinutes = (currentData.jornadas?.reducida || []).reduce((acc, t) => acc + parseToMinutes(t.horas, t.minutos), 0);

        // Validaciones: cada sumatorio no puede exceder el máximo asignado por jornada
        if (totalNormalMinutes > normalMax) {
            statusEl.textContent = `Error: El total de la Jornada Normal excede el máximo permitido (${Math.floor(normalMax/60)}h). Ajusta los tiempos.`;
            statusEl.style.color = 'red';
            return;
        }
        if (toggleReducida.checked && totalReducidaMinutes > reducidaMax) {
            statusEl.textContent = `Error: El total de la Jornada Reducida excede el máximo permitido (${Math.floor(reducidaMax/60)}h). Ajusta los tiempos.`;
            statusEl.style.color = 'red';
            return;
        }

        // Si pasa validaciones, proceder a construir el objeto para guardar
        // Formato para el script de contenido (content.js)
        // Construimos tareasConfig con objetos completos por tarea: { nombre, codigoProyecto, horas, minutos }
        const tareasConfig = {
            jornadas: {
                normal: [],
                reducida: []
            },
            jornadaReducidaActiva: Boolean(toggleReducida.checked)
        };

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
        
        // Guardamos AMBAS estructuras
        // Guardamos también el objeto 'config' que mantiene la estructura usada por la página de opciones
        const configToSave = { ...currentData, jornadaReducidaActiva: Boolean(toggleReducida.checked) };

        // No eliminamos los datos de 'reducida' al guardar si el toggle está desactivado:
        // simplemente los dejamos guardados para que reaparezcan si el usuario reactiva el toggle.
        chrome.storage.sync.set({ config: configToSave, tareasConfig: tareasConfig }, () => {
            statusEl.textContent = '¡Configuración guardada!';
            statusEl.style.color = 'green';
            setTimeout(() => { statusEl.textContent = ''; }, 2000);
        });
    };
    
    // --- EVENTOS ---

    addTaskBtn.addEventListener('click', () => {
        if (validateLastTask()) {
            const currentData = getDataFromDOM();
            currentData.tasks.push({}); // Añade una tarea vacía
            // Aseguramos que existen las estructuras de jornadas
            currentData.jornadas = currentData.jornadas || { normal: [], reducida: [] };
            currentData.jornadas.reducida.push({ horas: '', minutos: '' });
            currentData.jornadas.normal.push({ horas: '', minutos: '' });
            render(currentData); // Re-dibuja toda la interfaz
        }
    });

    // Cuando se cambia el toggle, re-renderizamos la UI para ocultar/mostrar la jornada reducida
    toggleReducida.addEventListener('change', () => {
        const currentData = getDataFromDOM();
        // Mantener el flag en la estructura para que render use el estado correcto
        currentData.jornadaReducidaActiva = toggleReducida.checked;
        render(currentData);
    });

    taskDefinitionContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-task-btn')) {
            const currentData = getDataFromDOM();
            const indexToRemove = parseInt(e.target.closest('.task-row').dataset.index, 10);

            // Elimina la tarea y sus tiempos asociados por su índice
            currentData.tasks.splice(indexToRemove, 1);
            currentData.jornadas = currentData.jornadas || { normal: [], reducida: [] };
            currentData.jornadas.reducida.splice(indexToRemove, 1);
            currentData.jornadas.normal.splice(indexToRemove, 1);

            render(currentData); // Re-dibuja la interfaz sin el elemento
        }
    });

    // Actualiza las etiquetas de tiempo dinámicamente mientras se escribe
    taskDefinitionContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('task-nombre')) {
            const index = parseInt(e.target.closest('.task-row').dataset.index, 10);
            const newName = e.target.value || `Tarea ${index + 1}`;
            // Comprobaciones defensivas: los contenedores pueden no tener esa fila (cuando reducida está oculta)
            if (timeContainerReducida.children[index]) {
                const lbl7 = timeContainerReducida.children[index].querySelector('.task-label');
                if (lbl7) lbl7.textContent = newName;
            }
            if (timeContainerNormal.children[index]) {
                const lbl9 = timeContainerNormal.children[index].querySelector('.task-label');
                if (lbl9) lbl9.textContent = newName;
            }
        }
    });

    saveBtn.addEventListener('click', saveOptions);
    restoreOptions();
});