// Background script for NordSales Extension
console.log("NordSales service worker initialized");

// Track the currently active tab with Dynamics CRM
let currentDynamicsTab = null;

// Store tab polling intervals
const tabPollingIntervals = {};

// Extract organization ID from URL
function extractOrgIdFromUrl(url) {
  if (!url) return null;
  
  // Pattern for org ID in CRM URLs (e.g., https://orgXXXXXXX.crm.dynamics.com)
  const orgPattern = /https:\/\/([^.]+)\.crm\.dynamics\.com/;
  const matches = url.match(orgPattern);
  
  if (matches && matches[1]) {
    console.log("Organization ID detected:", matches[1]);
    return matches[1];
  }
  
  return null;
}

// Check for opportunity ID in a tab and handle changes
function pollForOpportunityChanges(tabId) {
  // Check if tab still exists
  chrome.tabs.get(tabId).then(tab => {
    if (tab && tab.url && tab.url.includes('crm.dynamics.com')) {
      // Extract and store organization ID from the URL
      const orgId = extractOrgIdFromUrl(tab.url);
      if (orgId) {
        chrome.storage.local.set({ 
          currentOrgId: orgId,
          lastOrgIdUpdated: Date.now()
        });
      }
      
      // Tab exists and is a Dynamics CRM page, check for opportunity ID
      chrome.tabs.sendMessage(tabId, { type: "CHECK_OPPORTUNITY_ID" }, response => {
        // Check for error first to properly handle message channel closing
        if (chrome.runtime.lastError) {
          console.log("Message error:", chrome.runtime.lastError.message);
          
          // Try to re-inject the content script since it might have been invalidated
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['contentScript.js']
          }).catch(err => {
            console.log("Error re-injecting content script:", err);
          });
          return;
        }
        
        // Store organization ID from response if available
        if (response && response.organizationId) {
          chrome.storage.local.set({ 
            currentOrgId: response.organizationId,
            lastOrgIdUpdated: Date.now()
          });
        }
        
        // Only proceed if we have a valid response
        if (response && response.opportunityId) {
          // We have an opportunity ID, check if it's new
          chrome.storage.local.get(['currentOpportunityId'], result => {
            if (result.currentOpportunityId !== response.opportunityId) {
              // New opportunity ID, update storage and notify
              chrome.storage.local.set({
                currentOpportunityId: response.opportunityId,
                lastUpdated: Date.now(),
                currentUrl: response.url
              });
              
              // Notify the side panel
              chrome.runtime.sendMessage({
                type: "OPPORTUNITY_DETECTED",
                opportunityId: response.opportunityId,
                organizationId: response.organizationId,
                timestamp: Date.now()
              }).catch(() => {
                // Ignore errors if side panel isn't open
              });
            }
          });
        } else {
          // No opportunity ID, check if we need to clear
          chrome.storage.local.get(['currentOpportunityId'], result => {
            if (result.currentOpportunityId) {
              // Had an ID but now don't, clear it
              chrome.storage.local.remove(['currentOpportunityId', 'lastUpdated']);
              
              // Notify the side panel
              chrome.runtime.sendMessage({
                type: "OPPORTUNITY_CLEARED",
                timestamp: Date.now()
              }).catch(() => {
                // Ignore errors if side panel isn't open
              });
            }
          });
        }
      });
    } else {
      // Tab no longer exists or isn't a Dynamics page, stop polling
      if (tabPollingIntervals[tabId]) {
        clearInterval(tabPollingIntervals[tabId]);
        delete tabPollingIntervals[tabId];
      }
    }
  }).catch(() => {
    // Tab doesn't exist anymore, clean up
    if (tabPollingIntervals[tabId]) {
      clearInterval(tabPollingIntervals[tabId]);
      delete tabPollingIntervals[tabId];
    }
  });
}

// Set up polling for a tab
function startOpportunityPolling(tabId) {
  // Clear any existing interval for this tab
  if (tabPollingIntervals[tabId]) {
    clearInterval(tabPollingIntervals[tabId]);
  }
  
  // Set up a new polling interval
  tabPollingIntervals[tabId] = setInterval(() => {
    pollForOpportunityChanges(tabId);
  }, 1000); // Check every second
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('crm.dynamics.com')) {
    currentDynamicsTab = tabId;
    console.log("Dynamics CRM tab updated:", tabId);
    
    // Extract organization ID from the URL and store it
    const orgId = extractOrgIdFromUrl(tab.url);
    if (orgId) {
      chrome.storage.local.set({ 
        currentOrgId: orgId,
        lastOrgIdUpdated: Date.now()
      });
      console.log("Stored organization ID from tab update:", orgId);
    }
    
    // Inject content script and start polling
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['contentScript.js']
    }).then(() => {
      // Start polling this tab
      startOpportunityPolling(tabId);
    }).catch(err => {
      console.error("Error injecting content script:", err);
    });
    
    // Show notification badge
    chrome.storage.local.get(['autoOpen'], (result) => {
      if (result.autoOpen !== false) {
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#0078d4" });
      }
    });
  } else if (changeInfo.status === 'complete' && tab.url && !tab.url.includes('crm.dynamics.com')) {
    // Clear badge when not on Dynamics CRM
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
    
    // Store organization ID if available
    if (message.organizationId) {
      chrome.storage.local.set({ 
        currentOrgId: message.organizationId,
        lastOrgIdUpdated: Date.now()
      });
    }
    
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
      // Check tab still exists before sending message
      chrome.tabs.get(currentDynamicsTab).then(tab => {
        if (tab && tab.url && tab.url.includes('crm.dynamics.com')) {
          // Extract and store org ID from tab URL
          const orgId = extractOrgIdFromUrl(tab.url);
          if (orgId) {
            chrome.storage.local.set({ 
              currentOrgId: orgId,
              lastOrgIdUpdated: Date.now()
            });
          }
          
          chrome.tabs.sendMessage(currentDynamicsTab, { type: "CHECK_OPPORTUNITY_ID" }, response => {
            // Check for error first
            if (chrome.runtime.lastError) {
              console.log("Error communicating with content script:", chrome.runtime.lastError.message);
              return;
            }
            
            // Store organization ID if available
            if (response && response.organizationId) {
              chrome.storage.local.set({ 
                currentOrgId: response.organizationId,
                lastOrgIdUpdated: Date.now()
              });
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
                organizationId: response.organizationId,
                timestamp: Date.now()
              }).catch(err => {
                console.log("Could not send to side panel:", err);
              });
            }
          });
        }
      }).catch(err => {
        console.log("Tab no longer exists:", err);
      });
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
  chrome.storage.local.get(['autoOpen', 'currentOrgId'], (result) => {
    if (result.autoOpen === undefined) {
      chrome.storage.local.set({ autoOpen: true });
    }
    
    // Don't set a default organization ID, we want to detect it dynamically
  });
});