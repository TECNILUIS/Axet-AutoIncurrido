(async function() {
    'use strict';

    chrome.storage.sync.get(null, (storage) => {
        console.log('[DEBUG] chrome.storage contents:', storage);

        let configuracionTareas = null;

        // Preferimos la nueva clave canonical 'config'
        if (storage.config && (storage.config.jornadas || storage.config.tasks)) {
            const cfg = storage.config;
            configuracionTareas = {
                tasks: cfg.tasks || [],
                jornadas: cfg.jornadas || { normal: [], reducida: [] },
                jornadaReducidaActiva: cfg.jornadaReducidaActiva !== undefined ? cfg.jornadaReducidaActiva : true
            };
            console.log('[DEBUG] usando storage.config');
        } else if (storage.tareasConfig && (storage.tareasConfig.jornadas || storage.tareasConfig.jornadaReducidaActiva !== undefined)) {
            // Compatibilidad: migramos tareasConfig -> config, y luego usamos la estructura existente
            console.log('[DEBUG] solo se detectó storage.tareasConfig, ejecutando migración a config...');
            const t = storage.tareasConfig;
            // Convertir tareasConfig a la forma 'config'
            // asumimos que tareasConfig.jornadas.normal/reducida son arrays alineados con las tareas
            const normal = [];
            const reducida = [];
            const tasks = [];

            // tomamos el máximo entre la longitud de las listas para reconstruir tasks
            const maxLen = Math.max((t.jornadas?.normal || []).length, (t.jornadas?.reducida || []).length);
            for (let i = 0; i < maxLen; i++) {
                const n = (t.jornadas?.normal || [])[i] || { nombre: '', codigoProyecto: '', horas: '', minutos: '' };
                const r = (t.jornadas?.reducida || [])[i] || { nombre: '', codigoProyecto: '', horas: '', minutos: '' };
                // preferir el nombre/código de normal, si no, el de reducida
                const nombre = n.nombre || r.nombre || '';
                const codigo = n.codigoProyecto || r.codigoProyecto || '';
                tasks.push({ nombre, codigoProyecto: codigo });
                normal.push({ horas: n.horas || '', minutos: n.minutos || '' });
                reducida.push({ horas: r.horas || '', minutos: r.minutos || '' });
            }

            const newConfig = { tasks, jornadas: { normal, reducida }, jornadaReducidaActiva: Boolean(t.jornadaReducidaActiva) };
            // Guardar la nueva config y continuar usando ésta
            chrome.storage.sync.set({ config: newConfig }, () => {
                console.log('[MIGRATION] config escrito desde tareasConfig');
                // Eliminamos la clave legacy para evitar duplicación futura
                chrome.storage.sync.remove('tareasConfig', () => {
                    console.log('[MIGRATION] tareasConfig eliminada tras migración');
                });
            });

            configuracionTareas = {
                tasks: newConfig.tasks || [],
                jornadas: newConfig.jornadas,
                jornadaReducidaActiva: newConfig.jornadaReducidaActiva
            };
            console.log('[DEBUG] migrado configuracion desde tareasConfig');
        }

        if (!configuracionTareas) {
            requestPageToast("Error: No se encontró la configuración válida. Abre las Opciones y guarda la configuración.");
            console.error('[ERROR] No se encontró configuración válida en chrome.storage', storage);
            return;
        }
        console.log('[DEBUG] configuracionTareas:', configuracionTareas);

        const getTareasParaDia = (fecha = new Date()) => {
            const diaSemana = fecha.getDay();
            const mes = fecha.getMonth() + 1;
            const diaMes = fecha.getDate();
            if (diaSemana === 0 || diaSemana === 6) { requestPageToast("El día seleccionado es fin de semana."); return []; }

            const esVerano = (mes > 7 || (mes === 7 && diaMes >= 1)) && (mes < 9 || (mes === 9 && diaMes <= 15));

            // Usamos exclusivamente la nueva estructura 'jornadas'
            if (!configuracionTareas.jornadas) {
                requestPageToast("Error: Configuración inválida. Por favor, actualiza la configuración en Opciones.");
                return [];
            }

            const jornadas = configuracionTareas.jornadas;
            const jornadaReducidaActiva = Boolean(configuracionTareas.jornadaReducidaActiva);

            // Seleccionamos la lista de tiempos a usar según el día
            let tiemposSeleccionados = jornadas.normal || [];
            if (jornadaReducidaActiva) {
                if (diaSemana >= 1 && diaSemana <= 4) tiemposSeleccionados = jornadas.normal || [];
                if (diaSemana === 5 || esVerano) tiemposSeleccionados = jornadas.reducida || [];
            }

            // Merge: combinamos la metadata de tareas (nombre, codigoProyecto) con los tiempos seleccionados
            const tasksMeta = Array.isArray(configuracionTareas.tasks) && configuracionTareas.tasks.length ? configuracionTareas.tasks : [];
            const maxLen = Math.max(tasksMeta.length, tiemposSeleccionados.length);
            const resultado = [];
            for (let i = 0; i < maxLen; i++) {
                const meta = tasksMeta[i] || { nombre: `Tarea ${i + 1}`, codigoProyecto: '' };
                const tiempo = tiemposSeleccionados[i] || { horas: '', minutos: '' };
                resultado.push({ nombre: meta.nombre || `Tarea ${i + 1}`, codigoProyecto: meta.codigoProyecto || '', horas: tiempo.horas || '', minutos: tiempo.minutos || '' });
            }
            return resultado;
        };

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const findElementByText = (selector, texts, parent = document) => {
            const textsToFind = Array.isArray(texts) ? texts : [texts];
            return Array.from(parent.querySelectorAll(selector)).find(el => {
                const content = el.textContent.trim();
                return textsToFind.every(text => content.includes(text));
            });
        };
        const waitForElement = (selector, text, parent = document, timeout = 15000) => new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const element = text ? findElementByText(selector, text, parent) : parent.querySelector(selector);
                if (element) { clearInterval(interval); resolve(element); }
            }, 100);
            setTimeout(() => { clearInterval(interval); reject(new Error(`Elemento no encontrado: ${selector}`)); }, timeout);
        });
        const waitForCondition = (conditionFn, timeout = 10000, desc) => new Promise((resolve, reject) => {
            const interval = setInterval(() => { if (conditionFn()) { clearInterval(interval); resolve(); } }, 100);
            setTimeout(() => { clearInterval(interval); reject(new Error(`La condición '${desc}' no se cumplió.`)); }, timeout);
        });

        /**
         * Helper to request a toast in the page context. Content scripts cannot directly call
         * functions defined in the page context, so we dispatch a CustomEvent that the shared
         * toast script listens for. If the shared script isn't present, inject it from
         * web_accessible_resources.
         */
        function requestPageToast(message, type = 'info', duration = 4000) {
            const dispatch = () => {
                window.dispatchEvent(new CustomEvent('ExtensionShowToast', { detail: { message, type, duration } }));
            };

            // If page already has a listener (shared/toast.js), dispatch immediately
            if (typeof window.showToast === 'function') {
                dispatch();
                return;
            }

            // Otherwise inject the shared toast script and dispatch after load
            try {
                const s = document.createElement('script');
                s.src = chrome.runtime.getURL('scripts/shared/toast.js');
                s.onload = () => {
                    try { dispatch(); } catch (e) { console.warn('dispatch toast failed', e); }
                    s.remove();
                };
                (document.head || document.documentElement).appendChild(s);
            } catch (err) {
                // As a last resort, show a simple alert
                console.warn('[TOAST] Could not inject shared script, falling back to console.');
                console.log(message);
            }
        }

        async function incurrirTareas(fechaParaIncurrir) {
            // Esta función no cambia
            console.log(`[INFO] Iniciando proceso de incurridos para la fecha: ${fechaParaIncurrir.toLocaleDateString()}`);
            const tareasAIncurrir = getTareasParaDia(fechaParaIncurrir);
            if (tareasAIncurrir.length === 0) return;
            
            const getHorasActuales = () => {
                 const h2 = findElementByText('h2', 'Horas cargadas:');
                 if (!h2 || !h2.querySelector('.highlight')) return null;
                 return h2.querySelector('.highlight').textContent.trim();
            };

            const totalMinutesToIncur = tareasAIncurrir.reduce((acc, tarea) => {
                return acc + (parseInt(tarea.horas, 10) * 60) + parseInt(tarea.minutos, 10);
            }, 0);
            
            const currentHoursText = getHorasActuales();
            const [currentH, currentM] = currentHoursText.split(':').map(n => parseInt(n, 10));
            const currentMinutesIncurred = (currentH * 60) + currentM;

            if (currentMinutesIncurred >= totalMinutesToIncur) {
                requestPageToast(`Ya se han incurrido ${currentHoursText} horas o más para esta fecha. El script se detendrá.`);
                return;
            }

            let tareaCounter = 1;
            for (const tarea of tareasAIncurrir) {
                console.log(`\n--- TAREA ${tareaCounter}/${tareasAIncurrir.length}: ${tarea.nombre} (${tarea.codigoProyecto}) - ${tarea.horas}h ${tarea.minutos}m) ---`);
                const horasAntesDeIncurrir = getHorasActuales();
                const dropdown = await waitForElement('.formio-component-select .choices');
                const selectionBox = dropdown.querySelector('.choices__list--single');
                dropdown.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));

                const textosABuscar = [`[${tarea.nombre}]`, tarea.codigoProyecto];
                let opcionSeleccionar;
                try {
                    // Primero intentamos la búsqueda estricta (ambos textos)
                    opcionSeleccionar = await waitForElement('div.choices__item[role="option"]', textosABuscar, dropdown, 3000);
                } catch (errStrict) {
                    // Si falla, intentamos varias estrategias más tolerantes
                    const opciones = Array.from(dropdown.querySelectorAll('div.choices__item[role="option"]'));
                    // 1) Buscar por nombre exacto (sin corchetes)
                    opcionSeleccionar = opciones.find(o => o.textContent && o.textContent.includes(tarea.nombre));
                    // 2) Si no, buscar por código
                    if (!opcionSeleccionar && tarea.codigoProyecto) {
                        opcionSeleccionar = opciones.find(o => o.textContent && o.textContent.includes(tarea.codigoProyecto));
                    }
                    // 3) Si no, buscar una coincidencia que contenga ambas partes en cualquier orden
                    if (!opcionSeleccionar && tarea.codigoProyecto) {
                        opcionSeleccionar = opciones.find(o => {
                            const txt = (o.textContent || '').trim();
                            return txt.includes(tarea.codigoProyecto) && txt.includes(tarea.nombre);
                        });
                    }

                    if (!opcionSeleccionar) {
                        const mensaje = `Tarea "${tarea.nombre}" (código ${tarea.codigoProyecto}) no encontrada en el desplegable. Comprueba que existe exactamente en la página.`;
                        console.error('[ERROR] Tarea configurada no encontrada tras múltiples intentos:', tarea, { dropdownOptionsCount: opciones.length });
                        requestPageToast(mensaje, 'error');
                        return; // Salimos de incurrirTareas para no continuar con el proceso
                    }
                }
                // Simular selección sobre la opción encontrada
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
                    const formatoCorrecto = /^\d{2}:\d{2}$/.test(horasActuales);
                    return horasActuales !== horasAntesDeIncurrir && formatoCorrecto;
                }, 10000, "actualización del contador");

                console.log(`[ÉXITO] Tarea ${tareaCounter} incurrida.`);
                tareaCounter++;
            }
            await sleep(300);
            requestPageToast("¡Proceso completado!");
        }

        async function runAutomation() {
            console.log("================ INICIO DEL SCRIPT ================");
            const meses = { 'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11 };
            
            const getPageDate = () => {
                 const dateH2 = Array.from(document.querySelectorAll('h2')).find(h2 => Object.keys(meses).some(mes => h2.textContent.toLowerCase().includes(mes)));
                 if (!dateH2) return null;
                 const dateElement = dateH2.querySelector('.highlight');
                 if (!dateElement) return null;
                 const match = dateElement.textContent.toLowerCase().match(/(\d{1,2}) de (\w+) de (\d{4})/);
                 if (!match) return null;
                 return new Date(parseInt(match[3], 10), meses[match[2]], parseInt(match[1], 10));
            };

            let pageDate = getPageDate();
            if (!pageDate) throw new Error("Asegúrate de estar en la página principal.");

            const today = new Date();
            pageDate.setHours(0,0,0,0);
            today.setHours(0,0,0,0);
            
            const horasCargadas = findElementByText('h2', 'Horas cargadas:').querySelector('.highlight').textContent.trim();

            if (pageDate.getTime() === today.getTime()) {
                await incurrirTareas(today);
            } else if (pageDate.getTime() < today.getTime() && horasCargadas === '00:00') {
                console.log(`[INFO] La fecha no es la actual, pero las horas son 00:00. Se procederá a incurrir en la fecha mostrada: ${pageDate.toLocaleDateString()}`);
                await incurrirTareas(pageDate);
            } else {
                console.log("[INFO] La fecha no es la actual y ya tiene horas. Iniciando corrección automática de fecha...");
                
                const observer = new MutationObserver(async (mutations, obs) => {
                    const calendarioDiv = document.querySelector('.calendario');
                    if (calendarioDiv) {
                        obs.disconnect(); 
                        console.log("[OBSERVER] Vista de calendario detectada. Aplicando ajuste de fecha...");
                        
                        const formElement = document.querySelector('.formio-form');
                        if (!formElement) { throw new Error("No se pudo encontrar el elemento '.formio-form'."); }
                        const componentWrapper = formElement.closest('.formio-component[id]');
                        if (!componentWrapper) { throw new Error("No se pudo encontrar el contenedor del componente con un ID."); }
                        const formId = componentWrapper.id;

                        const dia = String(today.getDate()).padStart(2, '0');
                        const mes = String(today.getMonth() + 1).padStart(2, '0');
                        const anio = today.getFullYear();
                        const fechaStr = `${dia}/${mes}/${anio}`;

                        document.body.dataset.formId = formId;
                        document.body.dataset.fechaStr = fechaStr;

                        const script = document.createElement('script');
                        script.src = chrome.runtime.getURL('injector.js');
                        
                        script.onload = function() {
                            this.remove();
                        };
                        script.onerror = function() {
                            console.error("ERROR: No se pudo cargar el script 'injector.js'.");
                            this.remove();
                        };

                        (document.head || document.documentElement).appendChild(script);

                        console.log("[INFO] Esperando a que la página principal se actualice con la fecha correcta...");
                        await waitForCondition(() => {
                            const newPageDate = getPageDate();
                            if (!newPageDate) return false;
                            newPageDate.setHours(0,0,0,0);
                            return newPageDate.getTime() === today.getTime();
                        }, 15000, "actualización de la fecha en la página principal");
                        
                        console.log("[ÉXITO] Página principal actualizada.");
                        await incurrirTareas(today);
                    }
                });
                
                observer.observe(document.body, { childList: true, subtree: true });

                const changeDateLink = findElementByText('.sidebar.navbar-nav a', 'Cambiar fecha');
                changeDateLink.click();
            }
        }

        try {
            runAutomation();
        } catch (error) {
            console.error("Extensión: Ha ocurrido un error fatal.", error);
            showToast(`Error fatal en la extensión: ${error.message}.`);
        }
    });
})();
