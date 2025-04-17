const DEBUG = false;

// Modified service-worker.js with direct tab navigation
if (DEBUG) console.log("NordSales service worker initialized");

// Storage for polling intervals by tab ID
const tabPollingIntervals = {};
// Track content script injection status
const contentScriptInjected = {};

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
      if (DEBUG) console.warn("Tab is not a Dynamics CRM tab");
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
    setTimeout(async () => {
      // Make sure content script is injected after navigation
      await ensureContentScriptInjected(tabId);
      
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
          }).catch(() => {
            // Popup might not be open, that's fine
          });
        }
      });
    }, 1500); 

    // Wait and re-check for opportunity ID
    setTimeout(() => {
      pollForOpportunityChanges(tabId);
    }, 2000);
    
    return true;
  } catch (error) {
    console.warn("Error navigating to opportunity:", error);
    return false;
  }
}

// Ensure content script is injected and ready
async function ensureContentScriptInjected(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    
    if (!tab || !tab.url || !tab.url.includes('crm.dynamics.com')) {
      return false;
    }
    
    if (!contentScriptInjected[tabId]) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["contentScript.js"]
      });
      
      contentScriptInjected[tabId] = true;
      
      // Give the content script a moment to initialize
      return new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return true;
  } catch (error) {
    console.warn("Error ensuring content script:", error);
    return false;
  }
}

// Poll for opportunity changes
async function pollForOpportunityChanges(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    
    if (!tab || !tab.url || !tab.url.includes('crm.dynamics.com')) {
      clearInterval(tabPollingIntervals[tabId]);
      delete tabPollingIntervals[tabId];
      delete contentScriptInjected[tabId];
      return;
    }
    
    const orgId = extractOrgIdFromUrl(tab.url);
    
    if (orgId) {
      chrome.storage.local.set({
        currentOrgId: orgId,
        lastOrgIdUpdated: Date.now()
      });
    }
    
    // Make sure content script is injected before sending message
    await ensureContentScriptInjected(tabId);
    
    // Send message with a timeout
    const sendMessageWithTimeout = () => {
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: "CHECK_OPPORTUNITY_ID" }, (response) => {
          if (chrome.runtime.lastError) {
            if (DEBUG) console.warn("Message error:", chrome.runtime.lastError.message);
            
            // Mark content script as needing re-injection on next poll
            contentScriptInjected[tabId] = false;
            resolve(null);
            return;
          }
          
          resolve(response);
        });
        
        // Resolve after timeout if no response
        setTimeout(() => resolve(null), 1000);
      });
    };
    
    const response = await sendMessageWithTimeout();
    
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
  } catch (error) {
    if (DEBUG) console.warn("Error in polling:", error);
    
    clearInterval(tabPollingIntervals[tabId]);
    delete tabPollingIntervals[tabId];
    delete contentScriptInjected[tabId];
  }
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const isCRM = tab.url?.includes('crm.dynamics.com');

    // Send context update to popup
    chrome.runtime.sendMessage({
      type: 'TAB_CONTEXT_UPDATE',
      isCRM
    }).catch(() => {});

    if (isCRM) {
      const orgId = extractOrgIdFromUrl(tab.url);
      if (orgId) {
        chrome.storage.local.set({ currentOrgId: orgId });
      }

      // Mark as needing injection
      contentScriptInjected[tabId] = false;
      
      ensureContentScriptInjected(tabId).then(() => {
        startOpportunityPolling(tabId);
      }).catch((err) => {
        console.error("Error injecting content script:", err);
      });

      chrome.storage.local.get(['autoOpen'], (result) => {
        const autoOpen = result.autoOpen !== false;
        if (autoOpen) {
          chrome.action.setBadgeText({ text: "!" });
          chrome.action.setBadgeBackgroundColor({ color: "#0078d4" });
        }
      });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  }
});


// Clean up polling when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabPollingIntervals[tabId]) {
    clearInterval(tabPollingIntervals[tabId]);
    delete tabPollingIntervals[tabId];
    delete contentScriptInjected[tabId];
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
      if (DEBUG) console.warn("Could not forward message to side panel (probably not open)");
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === "OPPORTUNITY_CLEARED") {
    // Add a debounce mechanism
    if (this.lastClearedTimestamp && (Date.now() - this.lastClearedTimestamp < 500)) {
      return;
    }
    
    this.lastClearedTimestamp = Date.now();
    
    // Forward the message
    chrome.runtime.sendMessage(message).catch(err => {
      if (DEBUG) console.warn("Could not forward message to side panel", err);
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
  
          // Mark as needing injection
          contentScriptInjected[currentDynamicsTab] = false;
          
          // Ensure content script is injected
          ensureContentScriptInjected(currentDynamicsTab).then(() => {
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
                  if (DEBUG) console.warn("Could not send to side panel:", err);
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
  
  
  // Navigate to opportunity in the current tab
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
  chrome.storage.local.get(['autoOpen', 'currentOrgId'], (result) => {
    if (result.autoOpen === undefined) {
      chrome.storage.local.set({ autoOpen: true });
    }
  });
});