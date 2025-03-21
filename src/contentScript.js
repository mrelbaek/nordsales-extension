// Extract opportunity ID from Dynamics CRM URL
function extractOpportunityId() {
    const url = window.location.href;
    const idMatch = url.match(/[?&]id=([^&]*)/);
    
    if (idMatch && idMatch[1]) {
      const opportunityId = idMatch[1];
      console.log("Opportunity ID detected:", opportunityId);
      
      // Store in local storage for access by popup
      chrome.storage.local.set({ 
        currentOpportunityId: opportunityId,
        lastUpdated: Date.now() 
      }, function() {
        // Also notify any listeners (like the popup if it's open)
        chrome.runtime.sendMessage({ 
          type: "OPPORTUNITY_DETECTED", 
          opportunityId: opportunityId,
          timestamp: Date.now()
        });
      });
      
      return opportunityId;
    }
    
    return null;
  }
  
  // Extract opportunity ID on page load
  let currentOpportunityId = extractOpportunityId();
  
  // Dynamic URL change detection - more reliable for SPAs like Dynamics
  // Check the URL periodically
  setInterval(() => {
    const url = window.location.href;
    const idMatch = url.match(/[?&]id=([^&]*)/);
    
    if (idMatch && idMatch[1]) {
      // If we have a new ID or first ID
      if (idMatch[1] !== currentOpportunityId) {
        currentOpportunityId = idMatch[1];
        console.log("URL changed, new opportunity ID detected:", currentOpportunityId);
        
        // Store and notify
        chrome.storage.local.set({ 
          currentOpportunityId: currentOpportunityId,
          lastUpdated: Date.now() 
        }, function() {
          chrome.runtime.sendMessage({ 
            type: "OPPORTUNITY_DETECTED", 
            opportunityId: currentOpportunityId,
            timestamp: Date.now()
          });
        });
      }
    } else if (currentOpportunityId) {
      // If we had an ID but now we don't (navigated away from opportunity)
      currentOpportunityId = null;
      console.log("Navigated away from opportunity page");
      
      // Clear the stored ID
      chrome.storage.local.remove(['currentOpportunityId', 'lastUpdated'], function() {
        chrome.runtime.sendMessage({ 
          type: "OPPORTUNITY_CLEARED", 
          timestamp: Date.now()
        });
      });
    }
  }, 1000); // Check every second
  
  // Also use MutationObserver as a backup method
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(extractOpportunityId, 500); // Small delay to ensure page has loaded
    }
  }).observe(document, { subtree: true, childList: true });
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_OPPORTUNITY_ID") {
      const url = window.location.href;
      const idMatch = url.match(/[?&]id=([^&]*)/);
      
      if (idMatch && idMatch[1]) {
        sendResponse({ opportunityId: idMatch[1] });
      } else {
        sendResponse({ opportunityId: null });
      }
    } else if (message.type === "PING_CONTENT_SCRIPT") {
      // Let the popup know the content script is active
      sendResponse({ active: true, url: window.location.href });
    }
    return true; // Keep the message channel open for async response
  });
  
  console.log("NordSales Extension content script loaded");