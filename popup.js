document.addEventListener('DOMContentLoaded', () => {
    const redirectCheckbox = document.getElementById('redirect');
    const copyButtonVisibilityCheckbox = document.getElementById('copyButtonVisibility');
    const widgetCopyCheckbox = document.getElementById('widgetCopy');
    const copiedTickersList = document.getElementById('copiedTickersList');
    const _browser = typeof browser !== 'undefined' ? browser : chrome;

    // Load saved settings and last copied tickers
    _browser.storage.local.get(['chartRedirect', 'copyButtonVisibility', 'widgetCopy', 'lastCopiedTickers'], (result) => {
        // Set checkbox states
        redirectCheckbox.checked = result.chartRedirect !== false;
        copyButtonVisibilityCheckbox.checked = result.copyButtonVisibility !== false;
        widgetCopyCheckbox.checked = result.widgetCopy !== false;

        // Display last copied tickers if they exist
        if (result.lastCopiedTickers && result.lastCopiedTickers.length > 0) {
            displayGroupedTickers(result.lastCopiedTickers);
        } else {
            copiedTickersList.innerHTML = '<div class="ticker-item">No tickers copied yet</div>';
            document.querySelector('.chartink-to-tv-container').style.minHeight = '150px';
        }
    });

    // Save redirect option
    redirectCheckbox.addEventListener('change', () => {
        const newState = redirectCheckbox.checked;
        _browser.storage.local.set({ chartRedirect: newState });
    });

    // Save copy button visibility option
    copyButtonVisibilityCheckbox.addEventListener('change', () => {
        const newState = copyButtonVisibilityCheckbox.checked;
        _browser.storage.local.set({ copyButtonVisibility: newState });
    });

    // Save widget copy option
    widgetCopyCheckbox.addEventListener('change', () => {
        const newState = widgetCopyCheckbox.checked;
        _browser.storage.local.set({ widgetCopy: newState });
    });

    // Listen for storage changes to update the tickers list
    _browser.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.lastCopiedTickers) {
            displayGroupedTickers(changes.lastCopiedTickers.newValue);
        }
    });

    function displayGroupedTickers(tickers) {
        if (!tickers || tickers.length === 0) {
            copiedTickersList.innerHTML = '<div class="ticker-item">No tickers copied yet</div>';
            document.querySelector('.chartink-to-tv-container').style.minHeight = '150px';
            return;
        }

        copiedTickersList.innerHTML = '';
        
        // Split tickers into groups of 30
        const groupSize = 30;
        const tickerGroups = [];
        for (let i = 0; i < tickers.length; i += groupSize) {
            tickerGroups.push(tickers.slice(i, i + groupSize));
        }

        tickerGroups.forEach((group, index) => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'ticker-group';
            
            const groupHeader = document.createElement('div');
            groupHeader.className = 'ticker-group-header';
            groupHeader.textContent = `Group ${index + 1} (${group.length} tickers)`;
            
            const tickerList = document.createElement('div');
            tickerList.className = 'ticker-group-list';
            tickerList.textContent = group.join(', ');
            
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-group-button';
            copyButton.textContent = 'Copy Group';
            copyButton.addEventListener('click', () => {
                _browser.storage.local.get(['copyButtonVisibility'], (result) => {
                    const tickersToCopy = result.copyButtonVisibility ? group.slice(0, 30) : group;
                    copyToClipboard(tickersToCopy.join(', '));
                    copyButton.textContent = 'Copied!';
                    setTimeout(() => {
                        copyButton.textContent = 'Copy Group';
                    }, 2000);
                });
            });
            groupContainer.appendChild(groupHeader);
            groupContainer.appendChild(tickerList);
            groupContainer.appendChild(copyButton);
            copiedTickersList.appendChild(groupContainer);
        });

        // Adjust popup height based on content
        const container = document.querySelector('.chartink-to-tv-container');
        const contentHeight = container.scrollHeight;
        container.style.height = `${Math.min(contentHeight, 600)}px`;
    }

    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    // Request the latest tickers when popup opens
    _browser.runtime.sendMessage(
        { message: "getLastCopiedTickers" },
        (response) => {
            if (response && response.tickers) {
                displayGroupedTickers(response.tickers);
            }
        }
    );
});