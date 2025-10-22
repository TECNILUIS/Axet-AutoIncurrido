try {
    const formId = document.body.dataset.formId;
    const fechaStr = document.body.dataset.fechaStr;

    if (formId && fechaStr) {
        const formInstance = window.Formio.forms[formId];
        if (formInstance) {
            formInstance.submission.data.selectedDate = fechaStr;
            formInstance.emit('change', formInstance.submission);
            const submitButton = document.getElementById('fechaConsultar');
            if (submitButton) {
                submitButton.click();
            }
        }
    }
} catch (e) {
    console.error('[Injector Script] Error durante la ejecución:', e);
}
