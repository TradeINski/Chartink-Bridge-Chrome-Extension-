document.addEventListener('DOMContentLoaded', () => {
    const redirectCheckbox = document.getElementById('redirect');
    const _browser = typeof browser !== 'undefined' ? browser : chrome;

    _browser.storage.local.get('chartRedirect', (result) => {
        const savedState = result.chartRedirect;
        redirectCheckbox.checked = savedState === undefined ? true : savedState; // Default to true if not set
    });

    redirectCheckbox.addEventListener('change', () => {
        const newState = redirectCheckbox.checked;
        _browser.storage.local.set({ chartRedirect: newState }, () => {
            if (_browser.runtime.lastError) {
                console.error("Error saving redirect state:", _browser.runtime.lastError);
            } else {
                console.log('Redirect state saved:', newState);
                // Send message to background script (optional, for more complex logic)
                _browser.runtime.sendMessage({ message: "redirectStateChanged", state: newState });
            }
        });
    });
});