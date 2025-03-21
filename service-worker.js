// Background script for NordSales Extension
console.log("NordSales service worker initialized");

// Track the currently active tab with Dynamics CRM
let currentDynamicsTab = null;

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('crm.dynamics.com')) {
    currentDynamicsTab = tabId;
    console.log("Dynamics CRM tab updated:", tabId);
    
    // Instead of trying to auto-open the panel, display a badge notification
    chrome.storage.local.get(['autoOpen'], (result) => {
      if (result.autoOpen) {
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#0078d4" });
      }
    });
  } else if (changeInfo.status === 'complete' && tab.url && !tab.url.includes('crm.dynamics.com')) {
    // Clear badge when not on Dynamics CRM
    chrome.action.setBadgeText({ text: "" });
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.includes('crm.dynamics.com')) {
      currentDynamicsTab = activeInfo.tabId;
      console.log("Dynamics CRM tab activated:", activeInfo.tabId);
    }
  } catch (err) {
    console.error("Error getting tab info:", err);
  }
});

// When the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  // Open the side panel in response to user action (this is allowed)
  chrome.sidePanel.open({ tabId: tab.id }).then(() => {
    // Clear the notification badge after opening
    chrome.action.setBadgeText({ text: "" });
  }).catch(err => {
    console.error("Error opening side panel:", err);
  });
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Service worker received message:", message.type);
  
  if (message.type === "OPPORTUNITY_DETECTED") {
    console.log("Received opportunity ID:", message.opportunityId);
    
    // Store for later use by popup
    chrome.storage.local.set({ 
      currentOpportunityId: message.opportunityId,
      lastUpdated: message.timestamp || Date.now() 
    });
    
    // Forward the message to any open side panel
    chrome.runtime.sendMessage(message).catch(err => {
      // It's normal for this to fail if side panel isn't open
      console.log("Could not forward message to side panel (probably not open)");
    });
  } 
  else if (message.type === "OPPORTUNITY_CLEARED") {
    console.log("Opportunity cleared");
    
    // Clear storage
    chrome.storage.local.remove(['currentOpportunityId', 'lastUpdated']);
    
    // Forward the message
    chrome.runtime.sendMessage(message).catch(err => {
      console.log("Could not forward message to side panel");
    });
  }
  else if (message.type === "POPUP_OPENED") {
    console.log("Side panel opened, checking for current opportunity");
    
    // If we know of an active Dynamics tab, check for opportunity
    if (currentDynamicsTab) {
      try {
        chrome.tabs.sendMessage(currentDynamicsTab, { type: "GET_OPPORTUNITY_ID" }, (response) => {
          if (chrome.runtime.lastError) {
            console.log("Could not communicate with content script:", chrome.runtime.lastError);
            return;
          }
          
          if (response && response.opportunityId) {
            console.log("Got opportunity ID from content script:", response.opportunityId);
            
            // Store and forward to side panel
            chrome.storage.local.set({ 
              currentOpportunityId: response.opportunityId,
              lastUpdated: Date.now() 
            });
            
            chrome.runtime.sendMessage({
              type: "OPPORTUNITY_DETECTED",
              opportunityId: response.opportunityId,
              timestamp: Date.now()
            }).catch(err => {
              console.log("Could not send to side panel:", err);
            });
          }
        });
      } catch (err) {
        console.error("Error checking for opportunity:", err);
      }
    }
  }
  else if (message.type === "SET_AUTO_OPEN") {
    // Store the user's preference for auto-opening
    chrome.storage.local.set({ autoOpen: message.enabled });
    sendResponse({ success: true });
  }
  
  // Return true if using sendResponse asynchronously
  return true;
});

// When extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("NordSales extension installed/updated");
  
  // Set default values
  chrome.storage.local.get(['autoOpen'], (result) => {
    if (result.autoOpen === undefined) {
      chrome.storage.local.set({ autoOpen: true });
    }
  });
});