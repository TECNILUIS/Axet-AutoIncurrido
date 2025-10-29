// scripts/shared/utils.js (Completo v2.5)

/** Duerme la ejecución por ms milisegundos */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** Busca un elemento por selector que contenga TODOS los textos dados (con caso especial para Diseño) */
const findElementByText = (selector, texts, parent = document) => {
    const textsToFind = Array.isArray(texts) ? texts : [texts];
    return Array.from(parent.querySelectorAll(selector)).find(el => {
        const content = (el.textContent || '').trim(); // Asegurar que content sea string
        // Comprobar cada texto requerido
        return textsToFind.every(text => {
            // --- CASO ESPECIAL PARA DISEÑO ---
            if (text === '[Diseño]') {
                // Buscar si contiene "diseño" (ignorando mayúsculas/minúsculas)
                return content.toLowerCase().includes('diseño');
            }
            // --- FIN CASO ESPECIAL ---
            // Para otros textos, usar la comprobación normal
            return content.includes(text);
        });
    });
};

/** Espera a que un elemento (opcionalmente con texto) aparezca en el DOM */
const waitForElement = (selector, text, parent = document, timeout = 15000) => new Promise((resolve, reject) => {
    const interval = setInterval(() => {
        const element = text ? findElementByText(selector, text, parent) : parent.querySelector(selector);
        if (element) { clearInterval(interval); resolve(element); }
    }, 100);
    setTimeout(() => { clearInterval(interval); reject(new Error(`Elemento no encontrado (waitForElement): ${selector}`)); }, timeout);
});

/** Espera a que una condición (función) devuelva true */
const waitForCondition = (conditionFn, timeout = 10000, desc) => new Promise((resolve, reject) => {
    const interval = setInterval(() => { try { if (conditionFn()) { clearInterval(interval); resolve(); } } catch(e){ /* Ignore errors during check */ } }, 100);
    setTimeout(() => { clearInterval(interval); reject(new Error(`La condición '${desc}' no se cumplió (waitForCondition).`)); }, timeout);
});

/** Obtiene la fecha actual mostrada en la página principal de Axet */
const getPageDate = () => {
    const meses = { 'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11 };
    // Buscar el H2 que contiene un nombre de mes
    const dateH2 = Array.from(document.querySelectorAll('h2')).find(h2 =>
        Object.keys(meses).some(mes => (h2.textContent || '').toLowerCase().includes(mes))
    );
    if (!dateH2) {
        console.warn("[Utils] No se encontró H2 con nombre de mes.");
        return null;
    }
    const dateElement = dateH2.querySelector('.highlight'); // Buscar el span dentro del H2
    if (!dateElement || !dateElement.textContent) {
         console.warn("[Utils] No se encontró span.highlight con fecha.");
         return null;
    }
    // Extraer día, mes (texto), año
    const match = dateElement.textContent.trim().toLowerCase().match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/);
    if (!match) {
         console.warn("[Utils] El texto de la fecha no coincide con el formato esperado:", dateElement.textContent);
         return null;
    }
    const day = parseInt(match[1], 10);
    const monthStr = match[2];
    const year = parseInt(match[3], 10);

    if (meses[monthStr] !== undefined && !isNaN(day) && !isNaN(year)) {
        try {
            // Crear objeto Date (meses[monthStr] es 0-indexed)
            return new Date(year, meses[monthStr], day);
        } catch (e) {
            console.error("[Utils] Error al crear objeto Date desde:", match, e);
            return null;
        }
    } else {
        console.warn("[Utils] Día, mes o año inválido parseado:", match);
        return null;
    }
};


/** Obtiene las horas cargadas actualmente mostradas en la página */
const getHorasActuales = () => {
     const selectorHoras = 'h2 > span.highlight'; // Selector que contiene ej. "09:00"
     const h2Element = findElementByText('h2', 'Horas cargadas:'); // Encontrar el H2 contenedor

     if (!h2Element) {
         console.warn("[Utils] No se encontró H2 'Horas cargadas:'. Asumiendo 00:00.");
         return '00:00';
     }
     const highlightElement = h2Element.querySelector('.highlight');

     if (!highlightElement || !highlightElement.textContent) {
         console.warn("[Utils] No se encontró span.highlight en 'Horas cargadas:'. Asumiendo 00:00.");
         return '00:00';
     }
     const horasTexto = highlightElement.textContent.trim();
      if (!/^\d{1,2}:\d{2}$/.test(horasTexto)) { // Permitir H:MM o HH:MM
           console.warn(`[Utils] Texto horas '${horasTexto}' no tiene formato H(H):MM. Asumiendo 00:00.`);
           return '00:00';
      }
      // Asegurar formato HH:MM (pad con 0 si es necesario)
      const parts = horasTexto.split(':');
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1]; // Ya tiene 2 dígitos por regex
     return `${hours}:${minutes}`;
};

/** Obtiene el lunes de la semana que contiene la fecha dada */
function getMonday(d) {
    d = new Date(d); d.setHours(0,0,0,0);
    const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

/** Formatea una fecha como YYYY-MM-DD localmente */
function formatDateYYYYMMDD(date) {
    if (!date || !(date instanceof Date)) return ''; // Comprobar si es Date
    try {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("[Utils] Error formateando fecha:", date, e);
        return '';
    }
}

// Constante para ordenar tareas
const tipoTareaOrder = { 'Diseño': 1, 'Construcción': 2, 'Pruebas': 3, 'Despliegue': 4 };

/**
 * CALCULA horas/minutos (v2.5: Número = Horas Fijas exactas, Solo Color = Reparto).
 * @param {Date} fecha - Objeto Date del día (medianoche local).
 * @param {object} config - Configuración V2.4 {proyectos, sdaComun, horasEsperadasDiarias, planDiario}.
 * @returns {object|null} - Objeto { proyectoIndex: {horas: string, minutos: string} } o null si no laborable.
 */
function calcularHorasParaDia(fecha, config) { // Renombrada de v2_5
    fecha = new Date(fecha); fecha.setHours(0, 0, 0, 0);
    const todayStr = formatDateYYYYMMDD(fecha);

    if (!config || !config.proyectos || !config.horasEsperadasDiarias || !config.planDiario) {
        console.error("[Calc Horas v2.5] Config inválida."); return null;
    }

    // 1. Horas Totales y día laborable
    const horasEsperadasHoyStr = (config.horasEsperadasDiarias[todayStr] || '').toUpperCase();
    if (!horasEsperadasHoyStr || isNaN(parseInt(horasEsperadasHoyStr, 10))) { return null; } // No laborable
    const horasTotalesNum = parseInt(horasEsperadasHoyStr, 10);
    if (horasTotalesNum <= 0) { return {}; } // 0 horas
    let minutosTotalesDia = horasTotalesNum * 60;

    // 2. Reglas del Plan Diario (USAMOS EL PLAN CON valorCSV)
    // NECESITAMOS ASEGURARNOS que la config que llega aquí aún tiene valorCSV
    // Si options.js ya precalcula y guarda HORAS/MINUTOS en planDiario, esta función debe adaptarse
    // ASUMIENDO que options.js guarda planDiario con HORAS/MINUTOS PRECALCULADOS:
    // Esta función ya no es necesaria, incurrir.js leería directo.
    // SI options.js guarda planDiario con valorCSV, ESTA FUNCIÓN ES CORRECTA:
    const reglasBrutasDelDia = config.planDiario[todayStr] || [];
    if (reglasBrutasDelDia.length === 0) { return {}; } // Sin plan

    // 3. Calcular Minutos Fijos (basado en NÚMEROS en valorCSV)
    let totalMinutosFijos = 0;
    const participantesRepartoIndices = []; // Índices de proyectos que SOLO tienen color
    const minutosFijosPorProyecto = {}; // { proyectoIndex: minutosFijos }

    reglasBrutasDelDia.forEach(regla => {
        // Asegurarse que la regla tiene los campos esperados
        if (regla === null || typeof regla !== 'object' || regla.proyectoIndex === undefined || regla.valorCSV === undefined) {
             console.warn(`[Calc Horas v2.5] ${todayStr}: Regla inválida encontrada:`, regla);
             return; // Saltar regla inválida
        }
        const idx = regla.proyectoIndex;
        // Validar índice
        if (idx < 0 || idx >= config.proyectos.length) {
             console.warn(`[Calc Horas v2.5] ${todayStr}: Índice de proyecto inválido ${idx} en regla:`, regla);
             return; // Saltar regla inválida
        }

        const valor = regla.valorCSV || '';
        const valorLower = valor.toLowerCase();
        const matchNumero = valor.match(/(\d+(\.\d+)?)/); // Número (puede ser decimal) al inicio o solo
        const horasFijasNum = matchNumero ? parseFloat(matchNumero[1]) : 0;
        const tieneColor = regla.tipoTarea !== null && regla.tipoTarea !== undefined; // tipoTarea solo se setea si hay inicial de color

        if (horasFijasNum > 0) {
            const minutosFijos = Math.round(horasFijasNum * 60);
            minutosFijosPorProyecto[idx] = (minutosFijosPorProyecto[idx] || 0) + minutosFijos; // Acumular por si acaso
            totalMinutosFijos += minutosFijos;
        } else if (tieneColor) {
             // Si NO hay número pero SÍ tiene color, participa en reparto (si no está ya)
             if (!participantesRepartoIndices.includes(idx)) {
                 participantesRepartoIndices.push(idx);
             }
        }
        // Nota: Si tiene número Y color ('1Az'), SOLO fijo, NO reparto.
    });
    console.log(`[Calc v2.5] ${todayStr}: Fijos=${totalMinutosFijos} min. Reparto=${participantesRepartoIndices.length} tareas.`);

    // 4. Calcular Reparto
    let minutosARepartir = minutosTotalesDia - totalMinutosFijos;
    if (minutosARepartir < 0) minutosARepartir = 0;
    let minutosRepartoIndividual = 0;
    if (participantesRepartoIndices.length > 0 && minutosARepartir > 0) {
        minutosRepartoIndividual = minutosARepartir / participantesRepartoIndices.length;
        console.log(`[Calc v2.5] ${todayStr}: Reparto Indiv=${minutosRepartoIndividual.toFixed(2)} min`);
    } else if (minutosARepartir > 0) {
         console.warn(`[Calc v2.5] ${todayStr}: Sobraron ${minutosARepartir} min.`);
    }

    // 5. Asignar Minutos Finales y Formatear
    const resultadoCalculado = {};
    let minutosTotalesAsignados = 0;
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

    console.log("[Calc v2.5] Resultado (idx:{h,m}):", resultadoCalculado);
    if (Math.abs(minutosTotalesAsignados - minutosTotalesDia) > 1 && participantesRepartoIndices.length > 0) {
         console.warn(`[Calc v2.5] ${todayStr}: Discrepancia redondeo. Asignado=${minutosTotalesAsignados}, Esperado=${minutosTotalesDia}`);
    }

    return resultadoCalculado;
}


console.log("utils.js loaded (v2.5 con calcularHorasParaDia)");