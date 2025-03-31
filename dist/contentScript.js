(function() {
  // Logging function to help with debugging
  function log(message, ...args) {
      console.log(`[NordSales ContentScript] ${message}`, ...args);
  }

  // Function to extract opportunity ID from the current URL
  function extractOpportunityId() {
      const url = window.location.href;
      log("Current URL:", url);
      log("Host:", window.location.host);

      // Regex to match opportunity ID in different URL formats
      const idPatterns = [
          /[?&]id=([^&]*)/,  // Standard query parameter
          /opportunities\/([^/]+)/,  // Path-based URL
          /guid='([^']+)'/  // GUID format
      ];

      for (const pattern of idPatterns) {
          const idMatch = url.match(pattern);
          if (idMatch && idMatch[1]) {
              log("Opportunity ID detected:", idMatch[1]);
              return idMatch[1];
          }
      }

      return null;
  }

  // Function to store or clear opportunity ID
  function manageOpportunityId() {
      const opportunityId = extractOpportunityId();

      try {
          if (opportunityId) {
              chrome.storage.local.set({
                  currentOpportunityId: opportunityId,
                  lastUpdated: Date.now(),
                  currentUrl: window.location.href
              }, () => {
                  log("Opportunity ID stored successfully:", opportunityId);
              });
          } else {
              chrome.storage.local.remove(['currentOpportunityId', 'lastUpdated'], () => {
                  log("Cleared opportunity ID from storage");
              });
          }
      } catch (e) {
          log("Error managing opportunity ID:", e);
      }
  }

  // Initial execution when script loads
  function initialize() {
      log("Content script initialized");
      
      // Run initial ID detection
      manageOpportunityId();

      // Optional: Set up MutationObserver to detect dynamic page changes
      const observer = new MutationObserver((mutations) => {
          const isRelevantChange = mutations.some(mutation => 
              mutation.type === 'attributes' || 
              mutation.type === 'childList'
          );

          if (isRelevantChange) {
              manageOpportunityId();
          }
      });

      observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true
      });
  }

  // Message listener for extension communication
  function setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          log("Message received:", message);

          switch (message.type) {
              case "CHECK_OPPORTUNITY_ID":
                  const opportunityId = extractOpportunityId();
                  const response = {
                      opportunityId: opportunityId,
                      url: window.location.href,
                      timestamp: Date.now()
                  };

                  log("Sending opportunity ID response:", response);
                  
                  try {
                      sendResponse(response);
                  } catch (error) {
                      log("Error sending response:", error);
                  }
                  
                  return true;  // Required for async sendResponse

              case "REFRESH_OPPORTUNITY_ID":
                  manageOpportunityId();
                  sendResponse({ status: "refreshed" });
                  return true;

              default:
                  log("Unhandled message type:", message.type);
                  return false;
          }
      });
  }

  // Check if we're on a Dynamics CRM page before running
  function isDynamicsCrmPage() {
      return window.location.href.includes('crm.dynamics.com');
  }

  // Main execution
  function main() {
      if (!isDynamicsCrmPage()) {
          log("Not a Dynamics CRM page. Skipping initialization.");
          return;
      }

      initialize();
      setupMessageListener();
  }

  // Run main function
  main();
})();