// Shared toast utility for extension pages and injected pages
(function () {
    // showToast API exposed globally
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
            document.body.appendChild(container);
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

    // Allow content scripts to request a toast by dispatching a CustomEvent
    window.addEventListener('ExtensionShowToast', (ev) => {
        const { message, type, duration } = ev.detail || {};
        window.showToast(message, type, duration);
    });
})();
