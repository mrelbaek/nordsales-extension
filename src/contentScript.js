(function() {

    const DEBUG = false;
    
    // Logging function to help with debugging
    function log(message, ...args) {
        if (DEBUG) console.log(`[Lens ContentScript] ${message}`, ...args);
    }
  
    // Function to extract organization ID from the current URL
    function extractOrganizationId() {
        const url = window.location.href;
        
        // This regex captures the part between https:// and .crm.dynamics.com
        const orgPattern = /https:\/\/([^.]+)\.crm\.dynamics\.com/i;
        const matches = url.match(orgPattern);
        
        if (matches && matches[1]) {
            log("Organization ID detected:", matches[1]);
            return matches[1];
        }
        
        log("Could not extract organization ID from URL:", url);
        return null;
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
            /guid='([^']+)'/,  // GUID format
            /opportunityid=([^&]*)/  // Another possible format
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
  
    // Function to store organization ID and opportunity ID
    function manageIds() {
        const opportunityId = extractOpportunityId();
        const organizationId = extractOrganizationId();
  
        try {
            if (organizationId) {
                // Always store the organization ID when available
                chrome.storage.local.set({
                    currentOrgId: organizationId,
                    lastOrgIdUpdated: Date.now()
                }, () => {
                    log("Organization ID stored successfully:", organizationId);
                });
            }
            
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
            log("Error managing IDs:", e);
        }
    }
  
    // Initial execution when script loads
    function initialize() {
        log("Content script initialized");
        
        // Run initial ID detection
        manageIds();
  
        // Set up MutationObserver to detect dynamic page changes
        const observer = new MutationObserver((mutations) => {
            const isRelevantChange = mutations.some(mutation => 
                mutation.type === 'attributes' || 
                mutation.type === 'childList'
            );
  
            if (isRelevantChange) {
                manageIds();
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
    
            try {
                switch (message.type) {
                    case "CHECK_OPPORTUNITY_ID": {
                        const opportunityId = extractOpportunityId();
                        const organizationId = extractOrganizationId();
                        const response = {
                            opportunityId,
                            organizationId,
                            url: window.location.href,
                            timestamp: Date.now()
                        };
    
                        log("Sending response:", response);
                        sendResponse(response);
                        return true;
                    }
    
                    case "GET_ORGANIZATION_ID": {
                        const orgId = extractOrganizationId();
                        const response = {
                            organizationId: orgId,
                            url: window.location.href,
                            timestamp: Date.now()
                        };
                        log("Sending organization ID:", response);
                        sendResponse(response);
                        return true;
                    }
    
                    case "REFRESH_OPPORTUNITY_ID": {
                        manageIds();
                        sendResponse({ 
                            status: "refreshed",
                            organizationId: extractOrganizationId(),
                            opportunityId: extractOpportunityId()
                        });
                        return true;
                    }
                    
                    // Add this new case for opportunity navigation
                    case "NAVIGATE_TO_OPPORTUNITY": {
                        if (message.opportunityId) {
                            // Get the base URL for navigation
                            const currentUrl = window.location.href;
                            const baseUrl = currentUrl.split('/main.aspx')[0];
                            
                            // Extract the app ID from the current URL if available
                            let appId = '';
                            const appIdMatch = currentUrl.match(/appid=([^&]+)/);
                            if (appIdMatch && appIdMatch[1]) {
                                appId = appIdMatch[1];
                            }
                            
                            // Create the navigation URL
                            let navigationUrl;
                            if (appId) {
                                navigationUrl = `${baseUrl}/main.aspx?appid=${appId}&pagetype=entityrecord&etn=opportunity&id=${message.opportunityId}`;
                            } else {
                                navigationUrl = `${baseUrl}/main.aspx?etn=opportunity&id=${message.opportunityId}&pagetype=entityrecord`;
                            }
                            
                            // Navigate to the opportunity
                            log("Navigating to opportunity:", navigationUrl);
                            window.location.href = navigationUrl;
                            
                            sendResponse({ success: true });
                        } else {
                            log("Navigation failed: No opportunity ID provided");
                            sendResponse({ success: false, error: "No opportunity ID provided" });
                        }
                        return true;
                    }
    
                    default:
                        log("Unhandled message type:", message.type);
                        sendResponse({ error: "Unknown message type" });
                        return false;
                }
            } catch (err) {
                log("Error in message handler:", err);
                sendResponse({ error: err.message });
                return true;
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