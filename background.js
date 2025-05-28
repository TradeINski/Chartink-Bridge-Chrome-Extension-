const CHARTINK_STOCKS_URL = "https://chartink.com/stocks/";
const TRADINGVIEW_BASE_URL = "https://in.tradingview.com/chart/?symbol=NSE:";
const _browser = typeof browser !== 'undefined' ? browser : chrome;

async function getStorageValue(key, defaultValue) {
  try {
    const result = await _browser.storage.local.get(key);
    return result[key] === undefined ? defaultValue : result[key];
  } catch (error) {
    console.error(`Error getting ${key} from storage:`, error);
    return defaultValue;
  }
}

async function getChartRedirectState() {
  return getStorageValue("chartRedirect", true);
}

async function getWidgetCopyState() {
  return getStorageValue("widgetCopy", true);
}

function notifyContentScriptWidgetState(tabId, state) {
  _browser.tabs.sendMessage(tabId, {
    message: "updateWidgetCopyState",
    state: state
  }).catch(error => console.log(`Could not send widget state to tab ${tabId}: ${error.message}`));
}

let popupWindowId = null;

_browser.action.onClicked.addListener((tab) => {
  if (popupWindowId !== null) {
    _browser.windows.get(popupWindowId, {}, (windowInfo) => {
      if (_browser.runtime.lastError) {
        createPopupWindow();
      } else {
        _browser.windows.update(popupWindowId, { focused: true });
      }
    });
  } else {
    createPopupWindow();
  }
});

function createPopupWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 300,
    height: 500,
    focused: true,
    left: 100,
    top: 100
  }, (windowInfo) => {
    popupWindowId = windowInfo.id;
    chrome.windows.onRemoved.addListener((removedWindowId) => {
      if (removedWindowId === popupWindowId) {
        popupWindowId = null;
      }
    });
  });
}

_browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let isAsync = false;

  switch (request.message) {
    case "getChartRedirectState":
      getChartRedirectState().then(state => sendResponse({ chartRedirectState: state }));
      isAsync = true;
      break;

    case "getWidgetCopyState":
      getWidgetCopyState().then(state => sendResponse({ widgetCopyState: state }));
      isAsync = true;
      break;

    case "widgetCopyStateChanged":
      console.log("Background received widgetCopy state change:", request.newState);
      _browser.tabs.query({ url: "https://chartink.com/*" }, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            notifyContentScriptWidgetState(tab.id, request.newState);
          }
        });
      });
      sendResponse({ success: true });
      break;

    case "getLastCopiedTickers":
      getStorageValue("lastCopiedTickers", []).then(tickers => {
        sendResponse({ tickers: tickers });
      });
      isAsync = true;
      break;

    case "reloadAndCopyBullish":
      _browser.tabs.query({ active: true, url: "https://chartink.com/*" }, (tabs) => {
        if (tabs.length > 0) {
          const tabId = tabs[0].id;
          _browser.storage.local.set({ pendingCopyAfterReload: tabId });
          _browser.tabs.reload(tabId);
          sendResponse({ initiated: true });
        } else {
          console.warn("No active Chartink tab found to reload.");
          sendResponse({ initiated: false, error: "No active Chartink tab found." });
        }
      });
      isAsync = true;
      break;

    default:
      console.warn("Unknown message received: ", request.message);
  }

  return isAsync;
});

async function handleTabUpdateForRedirect(tabId, url) {
  if (!url || !url.startsWith(CHARTINK_STOCKS_URL)) {
    return;
  }

  try {
    const chartRedirect = await getChartRedirectState();
    if (chartRedirect) {
      const stockSymbolMatch = url.match(/stocks\/([^\/]+?)\.html/);
      const stockSymbol = stockSymbolMatch ? stockSymbolMatch[1] : null;
      if (stockSymbol) {
        const currentTab = await _browser.tabs.get(tabId);
        const targetUrl = `${TRADINGVIEW_BASE_URL}${stockSymbol}`;
        if (currentTab.url !== targetUrl) {
          console.log(`Redirecting ${tabId} to ${targetUrl}`);
          await _browser.tabs.update(tabId, { url: targetUrl });
        }
      }
    }
  } catch (error) {
    console.error(`Error handling tab update for redirect (${tabId}, ${url}):`, error);
  }
}

_browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const currentUrl = changeInfo.url || tab.url;
  if (currentUrl && currentUrl.includes("chartink.com/stocks/")) {
    handleTabUpdateForRedirect(tabId, currentUrl);
  }

  if (changeInfo.status === 'complete' && tab.url && tab.url.includes("https://chartink.com/")) {
    const state = await getWidgetCopyState();
    notifyContentScriptWidgetState(tabId, state);

    const pendingCopy = await getStorageValue("pendingCopyAfterReload", null);
    if (pendingCopy === tabId) {
      _browser.storage.local.remove("pendingCopyAfterReload");
      setTimeout(() => {
        _browser.tabs.sendMessage(tabId, {
          message: "clickBullishScannerCopyButton"
        }, (response) => {
          console.log("Auto-copy after reload result:", response ? response.success : "No response");
        });
      }, 1500);
    }
  }
});

async function updateAllTabsWidgetState() {
  const state = await getWidgetCopyState();
  _browser.tabs.query({ url: "https://chartink.com/*" }, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        notifyContentScriptWidgetState(tab.id, state);
      }
    });
  });
}

_browser.runtime.onStartup.addListener(updateAllTabsWidgetState);

_browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    _browser.storage.local.set({
      chartRedirect: true,
      widgetCopy: true,
      copyButtonVisibility: false,
      lastCopiedTickers: []
    });
  }
  updateAllTabsWidgetState();
});
