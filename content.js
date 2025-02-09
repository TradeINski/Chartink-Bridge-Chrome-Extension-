(() => {
    const _browser = typeof browser !== 'undefined' ? browser : chrome;
  
    window.addEventListener('load', () => {
        initialize();
    });
  
    function initialize() {
        _browser.storage.local.get('chartRedirect', (result) => {
            const shouldRedirect = result.chartRedirect === undefined ? true : result.chartRedirect;
            if (shouldRedirect) {
                changeURL();
                addBridgeButton();
                observeMutations();
            }
        });
    }
  
    function changeURL() {
        try {
            const links = document.querySelectorAll('a[href^="/stocks"]');
            links.forEach(link => {
                const symbol = extractSymbolFromURL(link.href);
                if (symbol) {
                    link.href = `https://in.tradingview.com/chart/?symbol=NSE:${symbol}`;
                } else {
                  // If shouldRedirect is false, leave the link as is (Chartink default)
                  link.href = `https://chartink.com/stocks-new?symbol=${symbol}`; // or whatever the original Chartink link was.
                }
                });
        } catch (error) {
            console.error("Error in changeURL:", error);
        }
    }
  
    function observeMutations() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    setTimeout(changeURL, 100); // Debounce
                    setTimeout(addBridgeButton, 100); // Re-add button if DOM changes
                }
            });
        });
  
        const config = { childList: true, subtree: true };
        const targetNode = document.querySelector('body'); // Observe changes within the body - you might want to make this more specific
        if(targetNode)
            observer.observe(targetNode, config);
    }
  
    function extractSymbolFromURL(url) {
        try {
            const lastSlash = url.lastIndexOf("/");
            const lastDot = url.lastIndexOf(".html");
            if (lastSlash !== -1 && lastDot !== -1 && lastSlash < lastDot) {
                return url.substring(lastSlash + 1, lastDot);
            }
            return null;
        } catch (error) {
            console.error("Error extracting symbol from URL:", error);
            return null;
        }
    }
  
    const addBridgeButton = () => {
        if (document.getElementById("copy-tickers")) return; // Check if button exists
  
        try {
            const screenerButtons = document.querySelectorAll(".btn.btn-default.btn-primary"); // Selector might need adjustment
            if (screenerButtons.length === 0) return;
  
            const screenerButtonsParent = screenerButtons[0].parentNode;
            if (!screenerButtonsParent) return;
  
            const bridgeButton = document.createElement("button");
            bridgeButton.textContent = "Bridge";
            bridgeButton.classList.add("btn", "btn-default", "btn-primary");
            bridgeButton.id = "copy-tickers";
            bridgeButton.addEventListener("click", copyAllTickers);
            screenerButtonsParent.appendChild(bridgeButton);
        } catch (error) {
            console.error("Error adding Bridge button:", error);
        }
    };
  
    async function copyAllTickers() {
        try {
            const table = document.querySelector("table.dataTable"); // Selector might need adjustment
            if (!table) {
                alert("Scanner Output Table Not Found!");
                return;
            }
  
            const headerCells = table.querySelectorAll("thead tr th");
            const symbolIndex = Array.from(headerCells).findIndex(th => th.innerText.trim().toLowerCase() === "symbol");
  
            if (symbolIndex === -1) {
                alert("Symbol column not found!");
                return;
            }
  
            let allTickers = [];
            let currentPage = 1;
  
            while (true) {
                const rows = table.querySelectorAll("tbody tr");
                if (rows.length === 0) break;
  
                rows.forEach(row => {
                    const symbolCell = row.querySelector(`td:nth-child(${symbolIndex + 1})`);
                    if (symbolCell) {
                        const symbol = symbolCell.innerText.trim();
                        allTickers.push(`NSE:${symbol}`);
                    }
                });
  
                const nextButton = document.querySelector("li.paginate_button.next:not(.disabled) a"); // Selector might need adjustment
                if (!nextButton) break;
  
                nextButton.click();
                await delay(500); // Adjust delay as needed
                currentPage++;
            }
  
            if (allTickers.length > 0) {
                const commaSeparatedTickers = allTickers.join(", ");
                navigator.clipboard.writeText(commaSeparatedTickers)
                    .then(() => alert("Tickers Copied Successfully!"))
                    .catch(err => console.error("Copy failed:", err));
            } else {
                alert("No Tickers Found To Copy!");
            }
        } catch (error) {
            console.error("Error in copyAllTickers:", error);
        }
    }
  
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
  
  })();