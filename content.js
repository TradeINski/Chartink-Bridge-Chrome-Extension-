// ===== On page load =====
window.onload = function () {
  changeURL();
  addCopyBtOnTradingView();
};

// ===== Create date header for clipboard copy =====
const dateHeader = `### ${new Date().toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
})}`;

// ===== URL Manipulation based on Chart Redirect Setting =====
function changeURL() {
  chrome.runtime.sendMessage({ message: "getChartRedirectState" }, function (response) {
    if (!response.chartRedirectState) return;

    // Update links to TradingView format
    const links = document.querySelectorAll('a[href^="/stocks"]');
    for (let i = 0; i < links.length; i++) {
      links[i].href = `https://in.tradingview.com/chart/?symbol=NSE:${compatabilitySymbolFunc(links[i].href)}`;
    }
  });
}

// ===== Convert /stocks/abc.html → abc or fetch symbol from URL param =====
function compatabilitySymbolFunc(url) {
  if (url.includes("stocks-new")) {
    return new URL(url).searchParams.get("symbol");
  }
  return url.substring(url.lastIndexOf("/") + 1, url.lastIndexOf(".html"));
}

// ===== DOM Observer to detect mutation and trigger update =====
const observer = new MutationObserver((mutations) => {
  const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
  if (!hasAddedNodes) return;

  chrome.runtime.sendMessage({ message: "getWidgetCopyState" }, function (response) {
    if (response.widgetCopyState) {
      changeURL();
      addEmojiCopyButtonsToTickers();
    } else {
      changeURL();
      addCopyBtOnTradingView();
    }
  });
});

observer.observe(document.body, { childList: true, subtree: true });

// ===== Add "Bridge" Button =====
const screenerButtonsClass = "btn btn-default btn-primary";

const addCopyToTradingViewButton = (text, cssClass, id, onClickFn) => {
  const btns = document.getElementsByClassName(screenerButtonsClass);
  if (btns.length === 0) return;

  const parent = btns[0].parentNode;
  const newBtn = document.createElement("button");
  newBtn.innerHTML = text;
  newBtn.className = cssClass;
  newBtn.id = id;
  newBtn.onclick = onClickFn;

  parent.appendChild(newBtn);
};

addCopyToTradingViewButton("Bridge", screenerButtonsClass, "add-to-watchlist", copyAllTickersOnScreen);

// ===== Pagination / Table Logic =====
function getPaginationLength() {
  const pages = document.getElementsByClassName("pagination")[0].getElementsByTagName("li");
  return pages[pages.length - 2].innerText;
}

function nextPage() {
  document.evaluate("//a[text()='Next']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.click();
}

function getNumberOfStocks() {
  const info = document.getElementsByClassName("dataTables_info")[0].innerText;
  return info.match(/\d+/)[0];
}

const delay = (t) => new Promise((res) => setTimeout(res, t));

// ===== Copy All Tickers Logic =====
async function copyAllTickersOnScreen() {
  chrome.runtime.sendMessage({ message: "getChartRedirectState" }, async function (response) {
    let allTags = [], allTickersArray = [];
    const numberOfPages = getPaginationLength();

    for (let i = 0; i < numberOfPages; i++) {
      if (i > 0) await delay(response.chartRedirectState ? 500 : 200);
      allTags.push(document.querySelectorAll(
        response.chartRedirectState
          ? 'a[href^="https://in.tradingview.com/chart/?symbol=NSE:"]'
          : 'a[href^="/stocks-new"]'
      ));
      nextPage();
    }

    const allTickers = allTags.map(tags => Array.from(tags)).flat();

    allTickersArray = allTickers.map(t => {
      const symbol = response.chartRedirectState
        ? extracrtSymbolFromURL(t.href)
        : extractSymbolFromTradingViewURL(t.href);
      return replaceSpecialCharsWithUnderscore(symbol);
    });

    const uniqueTickers = removeDuplicateTickers(allTickersArray);
    const finalTickers = addColonNSEtoTickers(uniqueTickers);

    createFakeTextAreaToCopyText(finalTickers.join(", "));
    replaceButtonText("add-to-watchlist");
  });
}

// ===== Utility Functions =====
function replaceButtonText(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.innerHTML = "Copied to clipboard 📋";
  setTimeout(() => (btn.innerHTML = "Bridge"), 2000);
}

function createFakeTextAreaToCopyText(text) {
  chrome.storage.local.get(['copyButtonVisibility'], (result) => {
    const tickers = text.split(',').map(t => t.trim()).filter(t => t && !t.includes('###'));
    const tickersToCopy = result.copyButtonVisibility ? tickers.slice(0, 30) : tickers;
    const textToCopy = `${dateHeader},${tickersToCopy.join(', ')}`;

    const textarea = document.createElement("textarea");
    textarea.value = textToCopy;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);

    chrome.storage.local.set({ lastCopiedTickers: tickers }, () => {
      console.log("Tickers saved:", tickersToCopy);
    });
  });
}

function removeDuplicateTickers(arr) {
  return [...new Set(arr)];
}

function addColonNSEtoTickers(arr) {
  return arr.map(t => `NSE:${t}`);
}

function replaceSpecialCharsWithUnderscore(t) {
  return t.replace(/[^a-zA-Z0-9]/g, "_");
}

function extracrtSymbolFromURL(url) {
  const urlParams = new URLSearchParams(new URL(url).search);
  const symbol = urlParams.get("symbol");
  return symbol ? symbol.split(":")[1] : null;
}

function extractSymbolFromTradingViewURL(url) {
  if (url.includes("NSE:")) return url.split("/")[4].split(":")[1];
  if (url.includes("/stocks-new")) return new URLSearchParams(url).get("symbol");
  if (url.includes("/stocks/")) return url.split("/").pop().replace(".html", "");
}

// ===== Widget Copy Button Logic =====
const addCopyBtOnTradingView = () => {
  const buttons = document.querySelectorAll('div[title="Copy widget"]');
  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      try {
        let parent = btn;
        let table = null;
        for (let i = 0; i < 10; i++) {
          parent = parent.parentElement;
          if (!parent) break;
          table = parent.querySelector("table");
          if (table) break;
        }
        if (!table) throw new Error("Ticker table not found");

        const anchors = table.querySelectorAll("a[href]");
        const tickers = [];

        anchors.forEach((a) => {
          let symbol = null;
          if (a.href.includes("symbol=NSE:")) {
            symbol = a.href.split("symbol=NSE:")[1];
          } else if (a.href.includes("/stocks/")) {
            symbol = a.href.split("/stocks/").pop().replace(".html", "");
          }
          if (symbol) tickers.push(`NSE:${symbol}`);
        });

        if (tickers.length === 0) {
          alert("No tickers found to copy.");
          return;
        }

        chrome.storage.local.get(['copyButtonVisibility'], (result) => {
          const tickersToCopy = result.copyButtonVisibility ? tickers.slice(0, 30) : tickers;
          copyToClipboard(tickersToCopy.join(", "));
          chrome.storage.local.set({ lastCopiedTickers: tickers });
          alert(`Copied ${tickersToCopy.length} tickers 📋`);
        });
      } catch (err) {
        console.error("Widget copy error:", err);
        alert("Widget copy failed. Please refresh and try again.");
      }

      return false;
    }, true);
  });
};

function copyToClipboard(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

// ===== Add 📋 Emoji Buttons Beside Tickers on Dashboard =====
function addEmojiCopyButtonsToTickers() {
  if (!window.location.href.includes("/dashboard/")) return;

  const tickerLinks = document.querySelectorAll('a[href*="/stocks/"]:not([href*="https://"])');
  tickerLinks.forEach((link) => {
    if (link.parentElement.classList.contains("ticker-link-wrapper")) return;

    let ticker = link.getAttribute("href").split("/").pop().replace(".html", "");
    if (!ticker || ticker.includes("?")) {
      const urlParams = new URLSearchParams(link.href);
      ticker = urlParams.get("symbol") || ticker;
    }

    if (!ticker) return;

    const formatted = `NSE:${ticker}`;
    const wrapper = document.createElement("span");
    wrapper.className = "ticker-link-wrapper";
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";

    if (link.parentNode) {
      link.parentNode.insertBefore(wrapper, link);
      wrapper.appendChild(link);
    }

    const emojiBtn = document.createElement("span");
    emojiBtn.textContent = "📋";
    emojiBtn.className = "emoji-copy-btn";
    emojiBtn.title = `Copy ${formatted}`;
    emojiBtn.style.cssText = "cursor:pointer; margin-left:4px; font-size:0.9em";

    emojiBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const ta = document.createElement("textarea");
      ta.value = formatted;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);

      chrome.storage.local.set({ lastCopiedTickers: [formatted] });
      emojiBtn.textContent = "✅";
      setTimeout(() => (emojiBtn.textContent = "📋"), 1500);
    };

    wrapper.appendChild(emojiBtn);
  });
}

// ===== Auto-click "Copy" Button in Bullish Scanner (used by background.js) =====
function clickBullishScannerCopyButton() {
  try {
    if (!window.location.href.includes("/dashboard/")) {
      console.warn("Not on Chartink dashboard page.");
      return false;
    }

    const headers = document.querySelectorAll('div[data-v-0c4502f5].flex.border-b');
    let bullishPanel = null;

    for (const header of headers) {
      if (header.textContent.includes("Bullish")) {
        bullishPanel = header.closest('div[data-v-0c4502f5].flex.border-b.dark\\:border-nightfall-navy');
        break;
      }
    }

    if (!bullishPanel) {
      console.warn("Bullish scanner panel not found.");
      return false;
    }

    const container = bullishPanel.parentElement;
    if (!container) {
      console.warn("Bullish scanner container not found.");
      return false;
    }

    const copyButton = container.querySelector('div[title="Copy widget"]');
    if (copyButton) {
      copyButton.click();
      console.log("Clicked the Copy widget button in bullish scanner.");
      return true;
    }

    console.warn("Could not find the copy button in the bullish scanner.");
    return false;
  } catch (err) {
    console.error("Error clicking bullish scanner copy button:", err);
    return false;
  }
}

// ===== Listener to handle click from background.js =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "clickBullishScannerCopyButton") {
    const success = clickBullishScannerCopyButton();
    sendResponse({ success });
    return true;
  }
  return false;
});