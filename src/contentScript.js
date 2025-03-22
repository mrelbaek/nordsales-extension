// Simple content script that just extracts and reports the opportunity ID
(function() {
    // One-time function to extract and report opportunity ID
    function reportOpportunityId() {
      const url = window.location.href;
      const idMatch = url.match(/[?&]id=([^&]*)/);
      
      // Only proceed if we find an ID
      if (idMatch && idMatch[1]) {
        const opportunityId = idMatch[1];
        console.log("Opportunity ID detected:", opportunityId);
        
        // Store directly in storage
        try {
          chrome.storage.local.set({
            currentOpportunityId: opportunityId,
            lastUpdated: Date.now(),
            currentUrl: url
          });
        } catch(e) {
          // Ignore storage errors
          console.log("Error storing opportunity ID:", e);
        }
      } else {
        // No opportunity ID found, clear from storage
        try {
          chrome.storage.local.remove(['currentOpportunityId', 'lastUpdated']);
        } catch(e) {
          // Ignore storage errors
          console.log("Error clearing opportunity ID:", e);
        }
      }
    }
    
    // Execute once when loaded
    reportOpportunityId();
    
    // Simple message listener that doesn't maintain state
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      if (message.type === "CHECK_OPPORTUNITY_ID") {
        // Re-check the URL when requested
        const url = window.location.href;
        const idMatch = url.match(/[?&]id=([^&]*)/);
        
        sendResponse({
          opportunityId: idMatch && idMatch[1] ? idMatch[1] : null,
          url: url
        });
      }
      return true;
    });
    
    console.log("NordSales Extension content script loaded");
  })();