// --- File: Chartink Bridge/background.js ---

const CHARTINK_STOCKS_URL = "https://chartink.com/stocks/";
const TRADINGVIEW_BASE_URL = "https://in.tradingview.com/chart/?symbol=NSE:";

const _browser = typeof browser !== 'undefined' ? browser : chrome;

// --- State Getter Functions ---
async function getStorageValue(key, defaultValue) {
    try {
        const result = await _browser.storage.local.get(key);
        return result[key] === undefined ? defaultValue : result[key];
    } catch (error) {
        console.error(`Error getting ${key} from storage:`, error);
        return defaultValue; // Return default in case of error
    }
}

async function getChartRedirectState() {
    return getStorageValue("chartRedirect", true); // Default true
}

async function getWidgetCopyState() {
    return getStorageValue("widgetCopy", true); // Default true
}
// Keep getCopyButtonVisibilityState if the other toggle is still used
// async function getCopyButtonVisibilityState() {
//    return getStorageValue("copyButtonVisibility", true); // Default true
// }

// --- Content Script Notifier ---
function notifyContentScriptWidgetState(tabId, state) {
    _browser.tabs.sendMessage(tabId, { message: "updateWidgetCopyState", state: state })
        .catch(error => console.log(`Could not send widget state to tab ${tabId}: ${error.message}`));
}

// --- Event Listeners ---

// Listen for messages from popup or content scripts
_browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    let isAsync = false; // Flag to return true if any branch uses async sendResponse

    switch (request.message) {
        case "getChartRedirectState":
            getChartRedirectState().then(state => sendResponse({ chartRedirectState: state }));
            isAsync = true;
            break;
        case "getWidgetCopyState":
            getWidgetCopyState().then(state => sendResponse({ widgetCopyState: state }));
            isAsync = true;
            break;
        // Keep if the other toggle state is needed by content script
        // case "getCopyButtonVisibilityState":
        //    getCopyButtonVisibilityState().then(state => sendResponse({ copyButtonVisibilityState: state }));
        //    isAsync = true;
        //    break;

        // Listen for immediate notification from popup
        case "widgetCopyStateChanged":
            console.log("Background received widgetCopy state change:", request.newState);
            // Find active Chartink tabs and notify them
            _browser.tabs.query({ url: "https://chartink.com/*" }, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.id) { // Ensure tab ID exists
                       notifyContentScriptWidgetState(tab.id, request.newState);
                    }
                });
            });
            // Optional: Send simple acknowledgement back to popup
            sendResponse({ success: true });
            break;

        case "getLastCopiedTickers":
            getStorageValue("lastCopiedTickers", []).then(tickers => {
                 sendResponse({ tickers: tickers });
            });
            isAsync = true;
            break;

        // Add other message handlers from original code if needed
        // case "setChartRedirectState": ...
        // case "setWidgetCopyState": ... (might not be needed if only popup sets it)

        default:
            console.warn("Unknown message received: ", request.message);
            // sendResponse({ success: false, error: "Unknown message" }); // Avoid sending response if not needed
    }

    return isAsync; // Return true if sendResponse is used asynchronously
});


// --- Tab Update/Load Logic ---

// Function to handle Chartink stock page redirects
async function handleTabUpdateForRedirect(tabId, url) {
    if (!url || !url.startsWith(CHARTINK_STOCKS_URL)) {
        return; // Not a relevant URL
    }
    try {
        const chartRedirect = await getChartRedirectState();
        if (chartRedirect) {
            const stockSymbolMatch = url.match(/stocks\/([^\/]+?)\.html/);
            const stockSymbol = stockSymbolMatch ? stockSymbolMatch[1] : null;
            if (stockSymbol) {
                 // Check if already redirecting to avoid loops
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

// Update content script state and handle redirects when tabs load/update
_browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const currentUrl = changeInfo.url || tab.url;

    // Handle redirection if URL changes or tab completes on a stock page
    if (currentUrl && currentUrl.includes("chartink.com/stocks/")) {
         handleTabUpdateForRedirect(tabId, currentUrl);
    }

    // When any chartink tab finishes loading, send it the current widget state
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes("https://chartink.com/")) {
         const state = await getWidgetCopyState();
         notifyContentScriptWidgetState(tabId, state);
    }
});

// --- Startup/Install Logic ---

// Helper to update all relevant tabs with current state
async function updateAllTabsWidgetState() {
    const state = await getWidgetCopyState();
    _browser.tabs.query({ url: "https://chartink.com/*" }, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id) { // Ensure tab ID exists
               notifyContentScriptWidgetState(tab.id, state);
            }
        });
    });
}

// Update state on startup and install
_browser.runtime.onStartup.addListener(updateAllTabsWidgetState);

_browser.runtime.onInstalled.addListener(async (details) => {
    // Set default values on first install if needed
    if (details.reason === "install") {
        _browser.storage.local.set({
            chartRedirect: true,
            widgetCopy: true,
            copyButtonVisibility: false, 
            lastCopiedTickers: []
        });
    }
    // Update all tabs regardless of install/update reason
    updateAllTabsWidgetState();
});