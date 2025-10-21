document.getElementById('runScript').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        // Le pedimos al background script que inyecte nuestro content script
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
        });
    });
});