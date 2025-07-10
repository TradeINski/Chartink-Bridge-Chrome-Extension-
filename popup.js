document.addEventListener('DOMContentLoaded', () => {
  const redirectCheckbox = document.getElementById('redirect');
  const copyButtonVisibilityCheckbox = document.getElementById('copyButtonVisibility');
  const widgetCopyCheckbox = document.getElementById('widgetCopy');
  const copiedTickersList = document.getElementById('copiedTickersList');

  const _browser = typeof browser !== 'undefined' ? browser : chrome;

  // Load initial state
  _browser.storage.local.get(
    ['chartRedirect', 'copyButtonVisibility', 'widgetCopy', 'lastCopiedTickers'],
    (result) => {
      redirectCheckbox.checked = result.chartRedirect !== false;
      copyButtonVisibilityCheckbox.checked = result.copyButtonVisibility !== false;
      widgetCopyCheckbox.checked = result.widgetCopy !== false;

      if (result.lastCopiedTickers && result.lastCopiedTickers.length > 0) {
        displayGroupedTickers(result.lastCopiedTickers);
      } else {
        copiedTickersList.innerHTML = '<div class="ticker-item">No tickers copied yet</div>';
        const header = document.getElementById('tickerHeader');
        if (header) header.textContent = 'Last Copied Tickers: 0';
      }
    }
  );

  // Toggle: Redirect to TradingView
  redirectCheckbox.addEventListener('change', () => {
    const newState = redirectCheckbox.checked;
    _browser.storage.local.set({ chartRedirect: newState });
  });

  // Toggle: Grouped Popup View
  copyButtonVisibilityCheckbox.addEventListener('change', () => {
    const newState = copyButtonVisibilityCheckbox.checked;
    _browser.storage.local.set({ copyButtonVisibility: newState });
  });

  // Toggle: Emoji Copy Buttons
  widgetCopyCheckbox.addEventListener('change', () => {
    const newState = widgetCopyCheckbox.checked;
    _browser.storage.local.set({ widgetCopy: newState });
  });

  // Watch for external changes to tickers
  _browser.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.lastCopiedTickers) {
      displayGroupedTickers(changes.lastCopiedTickers.newValue);
    }
  });

  function displayGroupedTickers(tickers) {
    const tickerHeader = document.getElementById('tickerHeader');
    if (tickerHeader) tickerHeader.textContent = `Last Copied Tickers: ${tickers.length}`;

    if (!tickers || tickers.length === 0) {
      copiedTickersList.innerHTML = '<div class="ticker-item">No tickers copied yet</div>';
      return;
    }

    copiedTickersList.innerHTML = '';
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
  }

  function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  // Request last tickers from background
  _browser.runtime.sendMessage({ message: 'getLastCopiedTickers' }, (response) => {
    if (response && response.tickers) {
      displayGroupedTickers(response.tickers);
    }
  });

  // Reload + copy bullish button
  const reloadButton = document.getElementById('reloadButton');
  if (reloadButton) {
    reloadButton.addEventListener('click', () => {
      reloadButton.textContent = 'Reloading...';
      reloadButton.disabled = true;

      _browser.runtime.sendMessage({ message: 'reloadAndCopyBullish' }, (response) => {
        if (response && response.initiated) {
          console.log('Reload and copy process initiated.');
          setTimeout(() => {
            reloadButton.textContent = 'Copied!';
            setTimeout(() => {
              reloadButton.textContent = 'Reload';
              reloadButton.disabled = false;
            }, 2000);
          }, 3000);
        } else {
          console.error('Failed to initiate reload and copy process.');
          reloadButton.textContent = 'Failed!';
          setTimeout(() => {
            reloadButton.textContent = 'Reload';
            reloadButton.disabled = false;
          }, 2000);
        }
      });
    });
  }

  // Menu toggle
  const menuToggle = document.getElementById('menuToggle');
  const settingsMenu = document.getElementById('settingsMenu');
  if (menuToggle && settingsMenu) {
    menuToggle.addEventListener('click', () => {
      settingsMenu.classList.toggle('hidden');
    });
  }
});