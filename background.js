const CHARTINK_STOCKS_URL = "https://chartink.com/stocks/";
const TRADINGVIEW_BASE_URL = "https://in.tradingview.com/chart/?symbol=NSE:";

const _browser = typeof browser !== 'undefined' ? browser : chrome;

_browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    try {
        if (changeInfo.url && tab.status === "complete" && changeInfo.url !== tab.url) {
            console.log(`Tab updated: ${tab.url}`);
            await handleTabUpdate(tabId, changeInfo.url);
        }
    } catch (error) {
        console.error("Error in tabs.onUpdated listener:", error);
    }
});

async function handleTabUpdate(tabId, url) {
    try {
        const chartRedirect = await getChartRedirectState();
        if (chartRedirect && url.startsWith(CHARTINK_STOCKS_URL)) {
            const stockSymbol = extractStockSymbolFromChartinkURL(url);
            if (stockSymbol) {
                await redirectToTradingView(tabId, stockSymbol);
            }
        }
    } catch (error) {
        console.error("Error in handleTabUpdate:", error);
    }
}

function extractStockSymbolFromChartinkURL(url) {
    try {
        const symbol = url.replace(CHARTINK_STOCKS_URL, "").replace(".html", "");
        return symbol || null;
    } catch (error) {
        console.error("Error extracting stock symbol:", error);
        return null;
    }
}

async function redirectToTradingView(tabId, stockSymbol) {
    try {
        await _browser.tabs.update(tabId, { url: `${TRADINGVIEW_BASE_URL}${stockSymbol}` });
    } catch (error) {
        console.error("Error redirecting to TradingView:", error);
    }
}

async function getChartRedirectState() {
    try {
        const result = await _browser.storage.local.get("chartRedirect");
        return result.chartRedirect === undefined ? true : result.chartRedirect; // Default to true
    } catch (error) {
        console.error("Error getting redirect state:", error);
        return true; // Return default (true) in case of error
    }
}

function setChartRedirectState(state) {
    _browser.storage.local.set({ chartRedirect: state });
}

_browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        switch (request.message) {
            case "getChartRedirectState":
                getChartRedirectState().then(state => sendResponse({ chartRedirectState: state }));
                break;
            case "setChartRedirectState":
                setChartRedirectState(request.state);
                sendResponse({ success: true });
                break;
            case "redirectStateChanged":
                console.log("Redirect state changed to:", request.state);
                // Optionally, you can perform background tasks here if needed
                break;
            default:
                console.warn("Unknown message: ", request.message);
                sendResponse({ success: false, errorCode: "UNKNOWN_MESSAGE", errorMessage: "Unknown message" });
        }
    } catch (error) {
        console.error("Error in message listener:", error);
        sendResponse({ success: false, errorCode: "MESSAGE_ERROR", errorMessage: error.message });
    }
    return true; // Keep this for asynchronous responses
});

_browser.runtime.onInstalled.addListener(async () => {
    try {
        const existingState = await _browser.storage.local.get("chartRedirect");
        if (existingState.chartRedirect === undefined) {
            setChartRedirectState(true);
        }
    } catch (error) {
        console.error("Error checking existing state on install:", error);
        setChartRedirectState(true); // Default to true if error
    }
});