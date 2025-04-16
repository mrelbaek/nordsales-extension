// Modified service-worker.js with direct tab navigation
console.log("NordSales service worker initialized");

// Storage for polling intervals by tab ID
const tabPollingIntervals = {};

// Helper function to extract organization ID from URL
function extractOrgIdFromUrl(url) {
  const orgPattern = /https:\/\/([^.]+)\.crm\.dynamics\.com/i;
  const matches = url.match(orgPattern);
  
  if (matches && matches.length > 1) {
    return matches[1];
  }
  
  return null;
}

// Function to navigate to an opportunity in a given tab
async function navigateToOpportunity(tabId, opportunityId) {
  try {
    // Get information about the tab
    const tab = await chrome.tabs.get(tabId);
    
    if (!tab || !tab.url || !tab.url.includes('crm.dynamics.com')) {
      console.warn("Tab is not a Dynamics CRM tab");
      return false;
    }
    
    // Extract the base URL from the tab
    const match = tab.url.match(/(https:\/\/[^\/]+)/);
    if (!match) {
      console.warn("Could not extract base URL from tab");
      return false;
    }
    
    const baseUrl = match[1];
    
    // Construct the opportunity URL
    const opportunityUrl = `${baseUrl}/main.aspx?etn=opportunity&pagetype=entityrecord&id=${opportunityId}`;
    
    // Navigate the tab to the opportunity
    await chrome.tabs.update(tabId, { url: opportunityUrl });

    // After navigation, wait and re-check for opportunity
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: "CHECK_OPPORTUNITY_ID" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("CHECK_OPPORTUNITY_ID error:", chrome.runtime.lastError.message);
          return;
        }

        if (response && response.opportunityId) {
          chrome.storage.local.set({
            currentOpportunityId: response.opportunityId,
            lastUpdated: Date.now()
          });
          chrome.runtime.sendMessage({
            type: "OPPORTUNITY_DETECTED",
            opportunityId: response.opportunityId
          });
        }
      });
    }, 1500); 

    // Wait and re-check for opportunity ID
    setTimeout(() => {
      pollForOpportunityChanges(tabId);
    }, 1000);
    
    // Close the extension popup if it's open
    // Note: This doesn't seem to be directly possible, but the navigation should cause the popup to close
    
    return true;
  } catch (error) {
    console.warn("Error navigating to opportunity:", error);
    return false;
  }
}

// Poll for opportunity changes
function pollForOpportunityChanges(tabId) {
  chrome.tabs.get(tabId).then(tab => {
    if (tab && tab.url && tab.url.includes('crm.dynamics.com')) {
      const orgId = extractOrgIdFromUrl(tab.url);
      
      if (orgId) {
        chrome.storage.local.set({
          currentOrgId: orgId,
          lastOrgIdUpdated: Date.now()
        });
      }
      
      chrome.tabs.sendMessage(tabId, { type: "CHECK_OPPORTUNITY_ID" }, response => {
        if (chrome.runtime.lastError) {
          console.error("Message error:", chrome.runtime.lastError.message);
          chrome.scripting.executeScript({
            target: { tabId },
            files: ["contentScript.js"]
          }).catch(err => {
            console.error("Error re-injecting content script:", err);
          });
          return;
        }
        
        if (response && response.opportunityId) {
          chrome.storage.local.set({
            currentOpportunityId: response.opportunityId,
            lastUpdated: Date.now(),
          });
          
          chrome.runtime.sendMessage({
            type: "OPPORTUNITY_DETECTED",
            opportunityId: response.opportunityId,
            organizationId: response.organizationId || orgId,
            timestamp: Date.now()
          }).catch(() => {
            // Popup not open, that's fine
          });
        } else {
          chrome.storage.local.remove(['currentOpportunityId', 'lastUpdated']);
          chrome.runtime.sendMessage({ type: "OPPORTUNITY_CLEARED" }).catch(() => {
            // Popup not open, that's fine
          });
        }
      });
    } else {
      clearInterval(tabPollingIntervals[tabId]);
      delete tabPollingIntervals[tabId];
    }
  }).catch(() => {
    clearInterval(tabPollingIntervals[tabId]);
    delete tabPollingIntervals[tabId];
  });
}

// Start polling for a tab
function startOpportunityPolling(tabId) {
  if (tabPollingIntervals[tabId]) {
    clearInterval(tabPollingIntervals[tabId]);
  }
  
  tabPollingIntervals[tabId] = setInterval(() => {
    pollForOpportunityChanges(tabId);
  }, 2000); // Poll every 2 seconds
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('crm.dynamics.com')) {
    
    const orgId = extractOrgIdFromUrl(tab.url);
    if (orgId) {
      chrome.storage.local.set({ currentOrgId: orgId });
    }
    
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["contentScript.js"]
    }).then(() => {
      startOpportunityPolling(tabId);
    }).catch((err) => {
      console.error("Error injecting content script:", err);
    });
    
    // Check auto-open setting for notification badges
    chrome.storage.local.get(['autoOpen'], (result) => {
      const autoOpen = result.autoOpen !== false;
      if (autoOpen) {
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#0078d4" });
      }
    });
  } else if (changeInfo.status === 'complete' && tab.url && !tab.url.includes('crm.dynamics.com')) {
    chrome.action.setBadgeText({ text: "" });
  }
});

// Clean up polling when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabPollingIntervals[tabId]) {
    clearInterval(tabPollingIntervals[tabId]);
    delete tabPollingIntervals[tabId];
  }
});

// When the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  // Open the side panel in response to user action (this is allowed)
  chrome.sidePanel.open({ tabId: tab.id }).then(() => {
    // Clear the notification badge after opening
    chrome.action.setBadgeText({ text: "" });
  }).catch((err) => {
    console.error("Error opening side panel:", err);
  });
});

// Handle messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.type === "OPPORTUNITY_DETECTED") {
    
    chrome.storage.local.set({
      currentOpportunityId: message.opportunityId,
      lastUpdated: message.timestamp || Date.now()
    });
    
    // Try to forward to popup if open
    chrome.runtime.sendMessage(message).catch(err => {
      console.warn("Could not forward message to side panel (probably not open)");
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === "OPPORTUNITY_CLEARED") {
    // Add a debounce mechanism
    if (this.lastClearedTimestamp && (Date.now() - this.lastClearedTimestamp < 500)) {
      console.log("Duplicate opportunity clear message, skipping");
      return;
    }
    
    this.lastClearedTimestamp = Date.now();
    
    // Forward the message
    chrome.runtime.sendMessage(message).catch(err => {
      console.warn("Could not forward message to side panel", err);
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === "POPUP_OPENED") {
    chrome.tabs.query({ active: true, url: "*://*.crm.dynamics.com/*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const currentDynamicsTab = tabs[0].id;
  
        chrome.tabs.get(currentDynamicsTab).then(tab => {
          const orgId = extractOrgIdFromUrl(tab.url);
          if (orgId) {
            chrome.storage.local.set({ currentOrgId: orgId });
          }
  
          // ✅ Ensure contentScript is injected
          chrome.scripting.executeScript({
            target: { tabId: currentDynamicsTab },
            files: ["contentScript.js"]
          }).then(() => {
            chrome.tabs.sendMessage(currentDynamicsTab, { type: "CHECK_OPPORTUNITY_ID" }, response => {
              if (chrome.runtime.lastError) {
                console.warn("Error communicating with content script:", chrome.runtime.lastError.message);
                return;
              }
  
              if (response && response.opportunityId) {
                chrome.storage.local.set({
                  currentOpportunityId: response.opportunityId,
                  lastUpdated: Date.now()
                });
  
                chrome.runtime.sendMessage({
                  type: "OPPORTUNITY_DETECTED",
                  opportunityId: response.opportunityId,
                  organizationId: response.organizationId || orgId
                }).catch(err => {
                  console.warn("Could not send to side panel:", err);
                });
              }
            });
          }).catch(err => {
            console.error("Error injecting content script from POPUP_OPENED:", err);
          });
  
        }).catch(err => {
          console.warn("Tab no longer exists:", err);
        });
      }
    });
  
    sendResponse({ success: true });
    return true;
  }
  
  
  // NEW HANDLER: Navigate to opportunity in the current tab
  if (message.type === "NAVIGATE_TO_OPPORTUNITY") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs && tabs.length > 0) {
        const activeTabId = tabs[0].id;
        const success = await navigateToOpportunity(activeTabId, message.opportunityId);
        sendResponse({ success });
      } else {
        sendResponse({ success: false, error: "No active tab found" });
      }
    });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
  
  if (message.type === "SET_AUTO_OPEN") {
    chrome.storage.local.set({ autoOpen: message.enabled });
    sendResponse({ success: true });
    return true;
  }
  
  sendResponse({ success: false, error: "Unknown message type" });
  return true;
});

// Handle extension installation or update
chrome.runtime.onInstalled.addListener(() => {
  console.log("Lens extension installed/updated");
  chrome.storage.local.get(['autoOpen', 'currentOrgId'], (result) => {
    if (result.autoOpen === undefined) {
      chrome.storage.local.set({ autoOpen: true });
    }
  });
});