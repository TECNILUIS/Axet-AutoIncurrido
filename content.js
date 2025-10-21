(async function() {
    'use strict';

    chrome.storage.sync.get(null, (storage) => {
        console.log('[DEBUG] chrome.storage contents:', storage);

        let configuracionTareas = null;
        if (storage.tareasConfig && (storage.tareasConfig.jornadas || storage.tareasConfig.jornadaReducidaActiva !== undefined)) {
            configuracionTareas = storage.tareasConfig;
            console.log('[DEBUG] usando storage.tareasConfig');
        } else if (storage.config && (storage.config.jornadas || storage.config.tasks)) {
            // fallback: tomar la configuración desde la página de opciones (config)
            configuracionTareas = {
                jornadas: storage.config.jornadas || { normal: [], reducida: [] },
                jornadaReducidaActiva: storage.config.jornadaReducidaActiva !== undefined ? storage.config.jornadaReducidaActiva : true
            };
            console.log('[DEBUG] fallback: construido configuracionTareas desde storage.config');
        }

        if (!configuracionTareas) {
            showToast("Error: No se encontró la configuración válida. Abre las Opciones y guarda la configuración.");
            console.error('[ERROR] No se encontró configuración válida en chrome.storage', storage);
            return;
        }
        console.log('[DEBUG] configuracionTareas:', configuracionTareas);

        const getTareasParaDia = (fecha = new Date()) => {
            const diaSemana = fecha.getDay();
            const mes = fecha.getMonth() + 1;
            const diaMes = fecha.getDate();
            if (diaSemana === 0 || diaSemana === 6) { showToast("El día seleccionado es fin de semana."); return []; }

            const esVerano = (mes > 7 || (mes === 7 && diaMes >= 1)) && (mes < 9 || (mes === 9 && diaMes <= 15));

            // Usamos exclusivamente la nueva estructura 'jornadas'
            if (!configuracionTareas.jornadas) {
                showToast("Error: Configuración inválida. Por favor, actualiza la configuración en Opciones.");
                return [];
            }

            const jornadas = configuracionTareas.jornadas;
            const jornadaReducidaActiva = Boolean(configuracionTareas.jornadaReducidaActiva);

            // Si la jornada reducida está activada
            if (jornadaReducidaActiva) {
                // Lunes a Jueves -> normal
                if (diaSemana >= 1 && diaSemana <= 4) return jornadas.normal || [];
                // Viernes o días de verano -> reducida
                if (diaSemana === 5 || esVerano) return jornadas.reducida || [];
            }

            // Si la jornada reducida está desactivada: todas las jornadas usan 'normal' (8h según validación en opciones)
            return jornadas.normal || [];
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
         * Muestra una notificación tipo "toast" en la esquina de la página.
         * @param {string} message - El mensaje a mostrar.
         * @param {string} [type='info'] - El tipo de notificación: 'info', 'success', o 'error'.
         */
        function showToast(message, type = 'info') {
            // Elimina cualquier toast anterior para no solaparlos
            const existingToast = document.getElementById('extension-toast');
            if (existingToast) {
                existingToast.remove();
            }

            const toast = document.createElement('div');
            toast.id = 'extension-toast';
            toast.textContent = message;

            // Estilos base
            toast.style.position = 'fixed';
            toast.style.top = '20px';
            toast.style.right = '20px';
            toast.style.padding = '15px 20px';
            toast.style.borderRadius = '8px';
            toast.style.color = 'white';
            toast.style.zIndex = '999999';
            toast.style.fontFamily = 'sans-serif';
            toast.style.fontSize = '16px';
            toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

            // Colores según el tipo
            if (type === 'success') {
                toast.style.backgroundColor = '#28a745'; // Verde
            } else if (type === 'error') {
                toast.style.backgroundColor = '#dc3545'; // Rojo
            } else {
                toast.style.backgroundColor = '#17a2b8'; // Azul info
            }

            document.body.appendChild(toast);

            // Animación de entrada
            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(0)';
            }, 10);

            // Desaparición automática
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300); // Elimina del DOM tras la animación
            }, 4000); // El toast dura 4 segundos
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
                showToast(`Ya se han incurrido ${currentHoursText} horas o más para esta fecha. El script se detendrá.`);
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
                        showToast(mensaje, 'error');
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
            showToast("¡Proceso completado!");
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