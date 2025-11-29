// scripts/shared/toast.js v2.0 (Define showToast y requestPageToast)
(function () {
    
    /**
     * El motor del Toast: Crea y muestra el elemento visual del toast.
     * Esta función es la que realmente toca el DOM.
     */
    window.showToast = function(message, type = 'info', duration = 4000) {
        // allow multiple toasts stacked vertically
        const containerId = 'extension-toast-container';
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            Object.assign(container.style, {
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
                zIndex: '2147483647',
                pointerEvents: 'none'
            });
            // Asegurarnos de que el body exista antes de añadir
            if (document.body) {
                document.body.appendChild(container);
            } else {
                // Si el body no existe (caso raro), esperar
                document.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));
            }
        }

        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = 'extension-toast-item';
        Object.assign(toast.style, {
            pointerEvents: 'auto',
            minWidth: '220px',
            maxWidth: '720px',
            background: type === 'error' ? '#dc3545' : (type === 'success' ? '#28a745' : '#333'),
            color: 'white',
            padding: '10px 14px',
            borderRadius: '8px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
            fontFamily: 'sans-serif',
            fontSize: '14px',
            textAlign: 'center',
            opacity: '0',
            transform: 'translateY(-6px)',
            transition: 'opacity 220ms ease, transform 220ms ease'
        });

        container.appendChild(toast);
        // animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        const removeToast = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-6px)';
            setTimeout(() => { toast.remove(); if (!container.hasChildNodes()) container.remove(); }, 240);
        };

        const timeout = setTimeout(removeToast, duration);
        // allow click to dismiss earlier
        toast.addEventListener('click', () => { clearTimeout(timeout); removeToast(); });
    };

    /**
     * El "wrapper" que usan todos los demás scripts.
     * Ahora se define en el MISMO archivo que showToast, garantizando que ambos existan.
     */
    if (typeof window.requestPageToast === 'undefined') {
        window.requestPageToast = function (message, type = 'info', duration = 4000) {
            // Esta comprobación interna ahora es casi redundante, pero es segura
            if (typeof window.showToast === 'function') {
                window.showToast(message, type, duration);
            } else {
                // Este fallback ya no debería ocurrir nunca
                console.warn(`[TOAST FALLBACK INTERNO] (${type}, ${duration}ms): ${message}`);
            }
        };
    }

    // Allow content scripts to request a toast by dispatching a CustomEvent
    // (Esta parte no se usa actualmente pero es bueno tenerla)
    window.addEventListener('ExtensionShowToast', (ev) => {
        const { message, type, duration } = ev.detail || {};
        window.requestPageToast(message, type, duration); // Usar nuestra propia función wrapper
    });

    // console.log("[Toast.js] showToast y requestPageToast definidos.");

})();