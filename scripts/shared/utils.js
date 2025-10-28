// scripts/shared/utils.js

/** Duerme la ejecución por ms milisegundos */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** Busca un elemento por selector que contenga TODOS los textos dados */
const findElementByText = (selector, texts, parent = document) => {
    const textsToFind = Array.isArray(texts) ? texts : [texts];
    return Array.from(parent.querySelectorAll(selector)).find(el => {
        const content = el.textContent.trim();
        return textsToFind.every(text => content.includes(text));
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
    const interval = setInterval(() => { if (conditionFn()) { clearInterval(interval); resolve(); } }, 100);
    setTimeout(() => { clearInterval(interval); reject(new Error(`La condición '${desc}' no se cumplió (waitForCondition).`)); }, timeout);
});

/** Obtiene la fecha actual mostrada en la página principal de Axet */
const getPageDate = () => {
    const meses = { 'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11 };
    const dateH2 = Array.from(document.querySelectorAll('h2')).find(h2 => Object.keys(meses).some(mes => h2.textContent.toLowerCase().includes(mes)));
    if (!dateH2) return null;
    const dateElement = dateH2.querySelector('.highlight');
    if (!dateElement) return null;
    const match = dateElement.textContent.toLowerCase().match(/(\d{1,2}) de (\w+) de (\d{4})/);
    if (!match) return null;
    try {
        return new Date(parseInt(match[3], 10), meses[match[2]], parseInt(match[1], 10));
    } catch (e) {
        console.error("Error parsing page date:", e);
        return null;
    }
};

/** Obtiene las horas cargadas actualmente mostradas en la página */
const getHorasActuales = () => {
     const h2 = findElementByText('h2', 'Horas cargadas:');
     if (!h2 || !h2.querySelector('.highlight')) return '00:00'; // Devuelve 0 si no se encuentra
     return h2.querySelector('.highlight').textContent.trim();
};

console.log("utils.js loaded"); // Para depuración