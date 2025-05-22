window.onload = function () {
  changeURL();
  addCopyBtOnTradingView(); // Apply copy button behavior on page load
};

const dateHeader = `### ${new Date().toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
})}`;

/**
 * Changes the URL of certain links on the page based on the chart redirect state.
 * Adds a copy button next to the modified links.
 */
function changeURL() {
  chrome.runtime.sendMessage(
    { message: "getChartRedirectState" },
    function (response) {
      if (!response.chartRedirectState) {
        return;
      }

      var links = document.querySelectorAll('a[href^="/stocks"]');
      for (var i = 0; i < links.length; i++) {
        links[i].href = `https://in.tradingview.com/chart/?symbol=NSE:${compatabilitySymbolFunc(links[i].href)}`;
      }
    }
  );

      chrome.runtime.sendMessage(
        { message: "getChartRedirectState" },
        function (response) {
          var links = [];
          if (response.chartRedirectState) {
            links = document.querySelectorAll('a[href^="https://in.tradingview.com/chart/?symbol=NSE:"]');
          } else {
            links = document.querySelectorAll('a[href^="/stocks"]');
          }

          });
        }

function compatabilitySymbolFunc(url) {
  if (url.includes("stocks-new")) {
    return new URL(url).searchParams.get("symbol");
  }
  return url.substring(url.lastIndexOf("/") + 1, url.lastIndexOf(".html"));
}

const observer = new MutationObserver(function (mutations) {
  // First check if any nodes were added
  const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
  if (!hasAddedNodes) return;

  // Get current state first, then decide what to do
  chrome.runtime.sendMessage({ message: "getWidgetCopyState" }, function (response) {
    if (response.widgetCopyState) {
      // Only run these if widget copy is enabled
      changeURL();
      addEmojiCopyButtonsToTickers();
    } else {
      // Only run URL changes if widget copy is disabled
      changeURL();
      addCopyBtOnTradingView();
    }
  });
});

observer.observe(document.body, { childList: true, subtree: true });

const screenerButtonsClass = "btn btn-default btn-primary";

/**
 * Adds a copy button to the TradingView screener buttons.
 * @param {string} buttonText - The text to display on the button.
 * @param {string} buttonClass - The CSS class of the button.
 * @param {string} buttonId - The ID of the button.
 * @param {function} buttonFunction - The function to execute when the button is clicked.
 */
const addCopyToTradingViewButton = (
  buttonText,
  buttonClass,
  buttonId,
  buttonFunction
) => {
  const screenerButtons = document.getElementsByClassName(screenerButtonsClass);
  if (screenerButtons.length === 0) return;
  const screenerButtonsParent = screenerButtons[0].parentNode;
  const screenerButton = document.createElement("button");
  screenerButton.innerHTML = buttonText;
  screenerButton.className = buttonClass;
  screenerButton.id = buttonId;
  screenerButton.onclick = buttonFunction;
  screenerButtonsParent.appendChild(screenerButton);
};

// Add a copy button to the TradingView screener buttons
addCopyToTradingViewButton(
  "Bridge",
  "btn btn-default btn-primary",
  "add-to-watchlist",
  copyAllTickersOnScreen
);

/**
 * Gets the length of the pagination.
 * @returns {number} - The length of the pagination.
 */
function getPaginationLength() {
  const paginationList = document
    .getElementsByClassName("pagination")[0]
    .getElementsByTagName("li");

  return paginationList[paginationList.length - 2].innerText;
}

// Clicks the next page button
function nextPage() {
  document
    .evaluate(
      "//a[text()='Next']",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    )
    .singleNodeValue.click();
}

/**
 * Gets the number of stocks displayed on the screen.
 * @returns {number} - The number of stocks.
 */
function getNumberOfStocks() {
  const el = document.getElementsByClassName("dataTables_info")[0];
  const innerText = el.innerText;
  const numberOfStocks = innerText.match(/\d+/)[0];
  return numberOfStocks;
}

/**
 * Delays the execution of the code.
 * @param {number} t - The delay time in milliseconds.
 * @returns {Promise} - A promise that resolves after the delay.
 */
const delay = (t) => {
  return new Promise((res) => setTimeout(res, t));
};

/**
 * Copies all the tickers on the screen to the clipboard.
 */
async function copyAllTickersOnScreen() {
  // Get the chart redirect state from the background script
  chrome.runtime.sendMessage(
    { message: "getChartRedirectState" },
    async function (response) {
      if (response.chartRedirectState) {
        let allTickersArray = [];
        let allTags = [];
        const numberOfPages = getPaginationLength();

        // Iterate through each page
        for (let i = 0; i < numberOfPages; i++) {
          if (i > 0) {
            await delay(500);
          }

          // Find all tags with href starting with "https://in.tradingview.com/chart/?symbol=NSE:"
          allTags.push(
            document.querySelectorAll(
              'a[href^="https://in.tradingview.com/chart/?symbol=NSE:"]'
            )
          );

          nextPage();
  }

        // Flatten the array of tags
        const allTickers = allTags.map((tag) => Array.from(tag)).flat();

        // Extract the symbols from the URLs and add them to the tickers array
        allTickers.forEach((ticker) => {
          allTickersArray.push(
            replaceSpecialCharsWithUnderscore(
              extracrtSymbolFromURL(ticker.href)
            )
          );
        });

        // Add "NSE:" prefix to the tickers
        allTickersArray = addColonNSEtoTickers(allTickersArray);

        // Create a fake textarea to copy the tickers to the clipboard
        createFakeTextAreaToCopyText(
          [...removeDuplicateTickers(allTickersArray)].join(", ")
        );
        replaceButtonText("add-to-watchlist");
        return;
      }

      let allTickersArray = [];
      let allTags = [];
      const numberOfPages = getPaginationLength();

      console.log(numberOfPages);
      // Iterate through each page
      for (let i = 0; i < numberOfPages; i++) {
        if (i > 0) {
          await delay(200);
        }

        allTags.push(document.querySelectorAll('a[href^="/stocks-new"]'));

        nextPage();
      }
      console.log(allTags);
      // Flatten the array of tags
      const allTickers = allTags.map((tag) => Array.from(tag)).flat();
      // Extract the symbols from the URLs and add them to the tickers array
      allTickers.forEach((ticker) => {
        allTickersArray.push(
          replaceSpecialCharsWithUnderscore(
            extractSymbolFromTradingViewURL(ticker.href)
          )
        );
      });
      // Add "NSE:" prefix to the tickers
      allTickersArray = addColonNSEtoTickers(allTickersArray);

      // Create a fake textarea to copy the tickers to the clipboard
      createFakeTextAreaToCopyText(
        [...removeDuplicateTickers(allTickersArray)].join(", ")
      );
      replaceButtonText("add-to-watchlist");
    }
  );
}

/**
 * Replaces the text of a button with a success message and then restores it after a delay.
 * @param {string} buttonId - The ID of the button.
 */
function replaceButtonText(buttonId) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  button.innerHTML = "Copied to clipboard 📋";
  setTimeout(() => {
    button.innerHTML = "Bridge";
  }, 2000);
}

/**
 * Creates a fake textarea, copies the text to it, and then copies the text from the textarea to the clipboard.
 * @param {string} text - The text to copy to the clipboard.
 */
function createFakeTextAreaToCopyText(text) {
  chrome.storage.local.get(['copyButtonVisibility'], (result) => {
    const tickers = text.split(',')
      .map(item => item.trim())
      .filter(item => item && !item.includes('###'));

    // If Group Tickers toggle is ON, limit to first 30 tickers
    const tickersToCopy = result.copyButtonVisibility ? tickers.slice(0, 30) : tickers;

    const textToCopy = `${dateHeader},${tickersToCopy.join(', ')}`;

    const fakeTextArea = document.createElement("textarea");
    fakeTextArea.value = textToCopy;
    document.body.appendChild(fakeTextArea);
    fakeTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(fakeTextArea);

    // Save to storage
    chrome.storage.local.set({ lastCopiedTickers: tickers }, () => {
      console.log('Tickers saved to storage:', tickersToCopy);
    });
  });
}


/**
* Removes duplicate tickers from an array.
* @param {string[]} tickers - The array of tickers.
* @returns {string[]} - The array of tickers with duplicates removed.
*/
function removeDuplicateTickers(tickers) {
  return [...new Set(tickers)];
}

/**
* Adds "NSE:" prefix to each ticker in an array.
* @param {string[]} tickers - The array of tickers.
* @returns {string[]} - The array of tickers with "NSE:" prefix added.
*/
function addColonNSEtoTickers(tickers) {
  return tickers.map((ticker) => `NSE:${ticker}`);
}

/**
 * Replaces special characters in a ticker with underscores.
 * @param {string} ticker - The ticker.
 * @returns {string} - The ticker with special characters replaced.
 */
function replaceSpecialCharsWithUnderscore(ticker) {
  return ticker.replace(/[^a-zA-Z0-9]/g, "_");
}

// Add this function to content.js
function handleDashboardCopy(tickers) {
  const cleanedTickers = tickers.map(ticker => {
    const cleanTicker = ticker.replace(/^NSE:/i, '');
    return `NSE:${cleanTicker}`;
  });

  // ✅ Copy only 30 if toggle is ON, but save all for popup
  chrome.storage.local.get(['copyButtonVisibility'], (result) => {
    const tickersToCopy = result.copyButtonVisibility ? cleanedTickers.slice(0, 30) : cleanedTickers;
    const symbolsText = tickersToCopy.join(", ");
    copyToClipboard(symbolsText);

    // ✅ Save full list to popup
    chrome.storage.local.set({ lastCopiedTickers: cleanedTickers }, () => {
      console.log('Widget full tickers saved, clipboard limited:', tickersToCopy);
    });
  });
}

const addCopyBtOnTradingView = () => {
  const copyBts = document.querySelectorAll('div[title="Copy widget"]');
  copyBts.forEach((copyBt) => {
    copyBt.addEventListener(
      "click",
      (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();

        try {
          // Walk up to find parent with table
          let parent = copyBt;
          let table = null;

          for (let i = 0; i < 10; i++) {
            parent = parent.parentElement;
            if (!parent) break;
            table = parent.querySelector("table");
            if (table) break;
          }

          if (!table) throw new Error("Ticker table not found");

          const anchors = table.querySelectorAll("a[href]");
          const tickerList = [];

          anchors.forEach((a) => {
            let symbol = null;

            if (a.href.includes("symbol=NSE:")) {
              symbol = a.href.split("symbol=NSE:")[1];
            } else if (a.href.includes("/stocks/")) {
              symbol = a.href.split("/stocks/").pop().replace(".html", "");
            }

            if (symbol) tickerList.push(`NSE:${symbol}`);
          });

          if (tickerList.length === 0) {
            alert("No tickers found to copy.");
            return;
          }

          chrome.storage.local.get(['copyButtonVisibility'], (result) => {
            const tickersToCopy = result.copyButtonVisibility
              ? tickerList.slice(0, 30)
              : tickerList;

            const symbolsText = tickersToCopy.join(", ");
            copyToClipboard(symbolsText);

            chrome.storage.local.set({ lastCopiedTickers: tickerList }, () => {
              console.log("Widget tickers saved:", tickerList);
            });

            alert(`Copied ${tickersToCopy.length} tickers 📋`);
          });
        } catch (error) {
          console.error("Error in widget copy button:", error);
          alert("Widget copy failed. Please refresh and try again.");
        }

        return false;
      },
      true
    );
  });
};

/**
* Copies text to the clipboard.
* @param {string} text - The text to copy.
*/
function copyToClipboard(text) {
          const fakeTextArea = document.createElement("textarea");
          fakeTextArea.value = text;
          document.body.appendChild(fakeTextArea);
          fakeTextArea.select();
          document.execCommand("copy");
          document.body.removeChild(fakeTextArea);
}

// Add copy buttons to the TradingView charts
addCopyBtOnTradingView();

/**
 * Removes the ".html" extension from a ticker.
 * @param {string} ticker - The ticker.
 * @returns {string} - The ticker without the ".html" extension.
 */
function removeDotHTML(ticker) {
  return ticker.replace(".html", "");
}

/**
 * Extracts the symbol from the URL.
 * @param {string} url - The URL of the link.
 * @returns {string|null} - The extracted symbol or null if not found.
*/
function extracrtSymbolFromURL(url) {
  const urlParams = new URLSearchParams(new URL(url).search);
  const symbol = urlParams.get("symbol");
  return symbol ? symbol.split(":")[1] : null;
}

function extractSymbolFromTradingViewURL(url) {
  if (url.includes("NSE:")) {
    return url.split("/")[4].split(":")[1];
  } else if (url.includes("/stocks-new")) {
    const urlParams = new URLSearchParams(url);
    return urlParams.get("symbol");
  } else if (url.includes("/stocks/")) {
    return url.split("/").pop().replace(".html", "");
  }
}

function addEmojiCopyButtonsToTickers() {
  if (!window.location.href.includes("/dashboard/")) return;

  const tickerLinks = document.querySelectorAll('a[href*="/stocks/"]:not([href*="https://"])');
  
  tickerLinks.forEach((link) => {
    if (link.parentElement.querySelector(".emoji-copy-btn")) return;

    // Try to extract the ticker more flexibly
    let ticker = link.getAttribute("href").split("/").pop().replace(".html", "");
    if (!ticker || ticker.includes("?")) {
      const urlParams = new URLSearchParams(link.href);
      ticker = urlParams.get("symbol") || ticker;
    }

    const formattedTicker = `NSE:${ticker}`;
    const emojiBtn = document.createElement("span");
    emojiBtn.textContent = "📋";
    emojiBtn.className = "emoji-copy-btn";
    emojiBtn.style.cursor = "pointer";
    emojiBtn.style.marginLeft = "6px";
    emojiBtn.title = `Copy ${formattedTicker}`;

    emojiBtn.onclick = () => {
      const textarea = document.createElement("textarea");
      textarea.value = formattedTicker;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      chrome.storage.local.set({ lastCopiedTickers: [formattedTicker] });
      emojiBtn.textContent = "✅";
      setTimeout(() => (emojiBtn.textContent = "📋"), 1500);
    };

    link.parentElement.appendChild(emojiBtn);
  });
}
