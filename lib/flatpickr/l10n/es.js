// Contenido para lib/flatpickr/l10n/es.js (JavaScript plano)
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.es = {}));
}(this, (function (exports) { 'use strict';

    const Spanish = {
        weekdays: {
            shorthand: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
            longhand: [
                "Domingo",
                "Lunes",
                "Martes",
                "Miércoles",
                "Jueves",
                "Viernes",
                "Sábado",
            ],
        },
        months: {
            shorthand: [
                "Ene",
                "Feb",
                "Mar",
                "Abr",
                "May",
                "Jun",
                "Jul",
                "Ago",
                "Sep",
                "Oct",
                "Nov",
                "Dic",
            ],
            longhand: [
                "Enero",
                "Febrero",
                "Marzo",
                "Abril",
                "Mayo",
                "Junio",
                "Julio",
                "Agosto",
                "Septiembre",
                "Octubre",
                "Noviembre",
                "Diciembre",
            ],
        },
        ordinal: () => {
            return "º";
        },
        firstDayOfWeek: 1, // Lunes
        rangeSeparator: " a ",
        time_24hr: true,
    };

    exports.Spanish = Spanish;
    exports.default = Spanish;

    // Registrarlo globalmente para que flatpickr.localize lo encuentre
    if (typeof flatpickr !== "undefined") {
        flatpickr.l10ns.es = Spanish;
    }

})));