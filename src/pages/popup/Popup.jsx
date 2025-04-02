import React, { useEffect, useState } from "react";
import { logout, getAccessToken, login, isLoggedIn } from "../../utils/auth.js"; // Import the enhanced logout function
import {
  getCurrentOpportunityId,
  fetchOpportunityDetails,
  fetchOpportunitiesWithActivities,
  fetchMyOpenOpportunities,
  fetchClosedOpportunities,
  getCurrentOrgId
} from "../../utils/opportunityUtils.js";
import ErrorMessage from "../../components/common/ErrorMessage.jsx";
import Login from "../../components/Login.jsx";
import OpportunityList from "../../components/OpportunityList";
import OpportunityDetail from "../../components/OpportunityDetail";
import Header from "../../components/Header.jsx";

/**
 * Main popup component that manages the application state
 */
const Popup = () => {
  const [accessToken, setAccessToken] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [currentOpportunityId, setCurrentOpportunityId] = useState(null);
  const [currentOpportunity, setCurrentOpportunity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoOpen, setAutoOpen] = useState(true);
  const [activities, setActivities] = useState([]);
  const [closedOpportunities, setClosedOpportunities] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Initialize the app
  useEffect(() => {
    async function initialize() {
      try {
        // Notify service worker that popup is open
        chrome.runtime.sendMessage({ type: "POPUP_OPENED" });
        
        // Clear any existing errors
        setError(null);
        setDebugInfo(null);
        
        // Get organization ID
        try {
          const orgId = await getCurrentOrgId();
          setOrganizationId(orgId);
          
          if (orgId) {
            chrome.storage.local.set({  "organizationId": orgId });
            }

          if (!orgId) {
            // Wait and retry in 500ms
            await new Promise(resolve => setTimeout(resolve, 500));
            const retryOrgId = await getCurrentOrgId();
            setOrganizationId(retryOrgId);
            if (retryOrgId) {
              setError("Please navigate to your Dynamics CRM environment first to use this extension.");
              return;
            }
          }
        } catch (orgError) {
          console.warn("Error getting organization ID:", orgError);
          setError("Could not determine your Dynamics CRM organization. Please navigate to Dynamics CRM first.");
          return;
        }
        
        // Get the token
        const token = await getAccessToken();
        console.log("[Popup.jsx] Got access token:", token ? "yes" : "no");

        setAccessToken(token);
        console.log("[Popup.jsx] Access token used in utils:", token?.substring(0, 30));
        
        if (token) {
          // Try to get current opportunity ID
          try {
            const oppId = await getCurrentOpportunityId();
            console.log("[Popup.jsx] Current opportunity ID:", oppId);
            setCurrentOpportunityId(oppId);
            
            // Fetch data
            if (oppId) {
              await handleFetchOpportunityDetails(token, oppId);
            } else {
              await handleFetchOpportunities(token);
            }
            
            // Also fetch closed opportunities for analytics
            await handleFetchClosedOpportunities(token);
          } catch (idError) {
            console.warn("Error getting opportunity ID:", idError);
            await handleFetchOpportunities(token);
            await handleFetchClosedOpportunities(token);
          }
        } else {
          console.log("[Popup.jsx] No valid token found, user needs to log in.");
        }
  
        // Get the auto-open preference
        chrome.storage.local.get(['autoOpen'], (result) => {
          setAutoOpen(result.autoOpen !== false);
        });
      } catch (error) {
        console.error("Initialization error:", error);
        setError("Failed to initialize extension: " + error.message);
        setDebugInfo({
          errorType: "Initialization Error",
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    initialize();
    
    // Set up polling for opportunity ID changes
    const storageCheckInterval = setInterval(() => {
      chrome.storage.local.get(['currentOpportunityId', 'lastUpdated', 'currentOrgId'], (result) => {
        // Check for organization ID changes
        if (result.currentOrgId && result.currentOrgId !== organizationId) {
          setOrganizationId(result.currentOrgId);
        }
        
        if (result.currentOpportunityId && result.lastUpdated) {
          // If the ID is different from what we have, or we don't have one
          if (result.currentOpportunityId !== currentOpportunityId) {
            console.log("[Popup.jsx] Storage poll detected new opportunity ID:", result.currentOpportunityId);
            setCurrentOpportunityId(result.currentOpportunityId);
            if (accessToken) {
              handleFetchOpportunityDetails(accessToken, result.currentOpportunityId);
            }
          }
        } else if (currentOpportunityId && !result.currentOpportunityId) {
          // If we had an ID but it's now cleared in storage
          console.log("[Popup.jsx] Opportunity ID cleared in storage");
          setCurrentOpportunityId(null);
          if (accessToken) {
            handleFetchOpportunities(accessToken);
          }
        }
      });
    }, 1000); // Check every second
    
    // Listen for opportunity detection from content script
    const handleMessage = (message) => {
      console.log("[Popup.jsx] Popup received message:", message.type);
      
      if (message.type === "OPPORTUNITY_DETECTED") {
        console.log("[Popup.jsx] Received opportunity ID from content script:", message.opportunityId);
        setCurrentOpportunityId(message.opportunityId);
        
        // Update organization ID if provided
        if (message.organizationId) {
          setOrganizationId(message.organizationId);
        }
        
        if (accessToken) {
          handleFetchOpportunityDetails(accessToken, message.opportunityId);
        }
      } else if (message.type === "OPPORTUNITY_CLEARED") {
        console.log("[Popup.jsx] Opportunity cleared notification received");
        setCurrentOpportunityId(null);
        setCurrentOpportunity(null);
        if (accessToken) {
          handleFetchOpportunities(accessToken);
        }
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Clean up
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      clearInterval(storageCheckInterval);
    };
  }, []);

  // Watch for changes to the current opportunity ID
  useEffect(() => {
    if (accessToken && currentOpportunityId) {
      console.log("[Popup.jsx] Effect triggered: fetching opportunity details");
      handleFetchOpportunityDetails(accessToken, currentOpportunityId);
    }
  }, [currentOpportunityId, accessToken]);

  // Set up styling for the app container
  useEffect(() => {
    // Set title
    document.title = "NordSales Extension";
    
    // Apply styles to make it look like a proper window
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('width', '100%');
    rootStyle.setProperty('height', '100%');
    rootStyle.setProperty('overflow', 'hidden');
    
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.height = '100%';
    document.body.style.overflow = 'auto';
    
    const root = document.getElementById('root');
    if (root) {
      root.style.height = '100%';
      root.style.overflow = 'auto';
    }
  }, []);

  /**
   * Fetch closed opportunities and set state
   */
  const handleFetchClosedOpportunities = async (token) => {
    try {
      console.log("BEFORE: Fetching closed opportunities...");
      await fetchClosedOpportunities(
        token,
        setLoading,
        setError,
        setClosedOpportunities
      );
      // Need to use setTimeout because state updates are asynchronous
      setTimeout(() => {
        console.log("AFTER: Closed opportunities fetched:", closedOpportunities.length);
      }, 100);
    } catch (error) {
      console.error("Error fetching closed opportunities:", error);
    }
  };

  /**
   * Fetch opportunity details and set state
   */
  const handleFetchOpportunityDetails = async (token, oppId) => {
    try {
      setLoading(true);
      setError(null);
      
      // First check if the token is still valid
      await isLoggedIn().then(async (loggedIn) => {
        if (!loggedIn) {
          // Token is invalid, show login screen
          console.log("[Popup.jsx] Token invalid or expired, clearing token state");
          setAccessToken(null);
          setError("Your session has expired. Please log in again.");
          setLoading(false);
          return;
        }
        
        // Call the utility function to fetch opportunity details
        try {
          await fetchOpportunityDetails(
            token, 
            oppId, 
            setLoading, 
            setError, 
            setCurrentOpportunity, 
            setActivities
          );
          
          // Also fetch closed opportunities for analytics
          await handleFetchClosedOpportunities(token);
        } catch (apiError) {
          // Check if it's an authentication error
          if (apiError.message.includes("Authentication failed") || 
              apiError.message.includes("401")) {
            console.error("Authentication failed during API call:", apiError);
            
            // Clear the token and show login screen
            await logout(
              setAccessToken,
              setOpportunities,
              setCurrentOpportunity,
              setActivities,
              null, // Don't set error yet
              setLoading
            );
            
            setError("Your session has expired. Please log in again.");
          } else {
            console.error("Error fetching opportunity details:", apiError);
            setError(`Failed to fetch opportunity details: ${apiError.message}`);
          }
        }
      });
    } catch (error) {
      console.error("Error checking login status:", error);
      setError("Failed to verify authentication status. Please try again.");
      setLoading(false);
    }
  };

  /**
   * Fetch opportunities list and set state
   */
  const handleFetchOpportunities = async (token, userId = null) => {
    try {
      // Call the utility function with all required state setters
      await fetchOpportunitiesWithActivities(
        token, 
        setLoading, 
        setError, 
        setOpportunities, 
        setDebugInfo
      );
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      setError(`Failed to fetch opportunities list: ${error.message}`);
    }
  };

  /**
   * Fetch all open opportunities for current user
   */
  const handleFetchMyOpenOpportunities = async () => {
    try {
      // Call the utility function
      await fetchMyOpenOpportunities(
        accessToken,
        setLoading,
        setError,
        setOpportunities
      );
      
      // Also refresh closed opportunities
      await handleFetchClosedOpportunities(accessToken);
    } catch (error) {
      console.error("Error fetching my opportunities:", error);
      setError(`Failed to fetch opportunities list: ${error.message}`);
    }
  };

  /**
   * Handle login
   */

  const handleLogin = async () => {
    try {
      // Check for organization ID first
      if (!organizationId) {
        const orgId = await getCurrentOrgId();
        if (!orgId) {
          setError("Please navigate to your Dynamics CRM environment first to use this extension.");
          return;
        }
        setOrganizationId(orgId);
      }
      
      setError(null);
      setLoading(true);
      
      try {
        const token = await login();
        console.log("[Popup.jsx] Login successful, got token");
        setAccessToken(token);
        
        // Check if we have an opportunity ID
        if (currentOpportunityId) {
          handleFetchOpportunityDetails(token, currentOpportunityId);
        } else {
          handleFetchOpportunities(token);
          handleFetchClosedOpportunities(token);
        }
      } catch (loginError) {
        if (loginError.message.includes("did not approve")) {
          console.log("[Popup.jsx] User cancelled the login dialog");
          setError("Authentication cancelled. Please try again.");
        } else {
          console.error("Login failed:", loginError);
          setError(`Login failed: ${loginError.message}`);
        }
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error("Login preparation error:", error);
      setError(`Login preparation failed: ${error.message}`);
      setLoading(false);
    }
  };

  /**
   * Handle logout action with state updates
   */
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      
      // Call the enhanced logout function with all state setters
      const result = await logout(
        setAccessToken,
        setOpportunities,
        setCurrentOpportunity,
        setActivities,
        setError,
        null // Don't pass setLoading as we're using setIsLoggingOut instead
      );
      
      if (result.success) {
        console.log("[Popup.jsx] Logout successful");
      } else {
        console.error("Logout failed:", result.error);
        setError(`Logout failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Unexpected error during logout:", error);
      setError(`An unexpected error occurred during logout: ${error.message}`);
    } finally {
      setIsLoggingOut(false);
    }
  };

  /**
   * Handle back button click
   */
  const handleBackToList = () => {
    setCurrentOpportunity(null);
    handleFetchOpportunities(accessToken);
  };

  /**
   * Handle opportunity selection
   */
  const handleOpportunitySelect = (opportunityId) => {
    handleFetchOpportunityDetails(accessToken, opportunityId);
  };

  /**
   * Toggle auto-open preference
   */
  const toggleAutoOpen = () => {
    const newValue = !autoOpen;
    setAutoOpen(newValue);
    chrome.storage.local.set({ 
      autoOpen: newValue 
    });
    chrome.runtime.sendMessage({ 
      type: "SET_AUTO_OPEN", 
      enabled: newValue 
    });
  };

  /**
   * Render appropriate content based on app state
   */
  const renderContent = () => {
    try {
      // Add explicit logging
      console.log('[Popup] RENDER CONTENT DEBUG:');
      console.log('[Popup] Organization ID:', organizationId);
      console.log('[Popup] Access Token:', !!accessToken);
      console.log('[Popup] Current Opportunity:', currentOpportunity);
      console.log('[Popup] Opportunities Count:', opportunities.length);
      console.log('[Popup] Closed Opportunities Count:', closedOpportunities.length);
      console.log('[Popup] Opportunities:', JSON.stringify(opportunities.map(o => ({
        id: o.opportunityid, 
        name: o.name, 
        activitiesCount: o.activities?.length || 0
      })), null, 2));
      
      // Show organization selection message if no org ID is detected
      if (!organizationId) {
        return (
          <div style={{ padding: "20px", textAlign: "center" }}>
            <h3>Organization Not Detected</h3>
            <p>Please navigate to your Dynamics CRM environment first to use this extension.</p>
            <p>The extension will automatically detect your organization ID from the URL.</p>
            <p style={{ marginTop: "20px", fontWeight: "bold" }}>
              Your URL should look like: https://yourorgname.crm.dynamics.com/...
            </p>
            <button 
              onClick={() => window.open("https://make.powerapps.com/environments", "_blank")}
              style={{
                marginTop: "20px",
                padding: "10px 16px",
                backgroundColor: "#0078d4",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Go to Power Apps
            </button>
          </div>
        );
      }
  
      if (!accessToken) {
        return <Login onLogin={handleLogin} />;
      }
    
      if (currentOpportunity) {
        return (
          <OpportunityDetail 
            opportunity={currentOpportunity}
            activities={activities || []}
            closedOpportunities={closedOpportunities || []}
            onBackClick={handleBackToList}
            toggleAutoOpen={toggleAutoOpen}
            autoOpen={autoOpen}
            onLogout={handleLogout}
            isLoggingOutgOut={isLoggingOut}
          />
        );
      }
    
      return (
        <OpportunityList 
          opportunities={(() => {
            try {
              if (!Array.isArray(opportunities)) {
                console.warn("Opportunities is not an array:", opportunities);
                return [];
              }
              
              // Map each opportunity with proper safety checks
              return opportunities.map((opp) => {
                console.log(`[Popup.jsx] Processing opportunity:`, opp);
                if (!opp) {
                  console.warn("Received undefined opportunity object");
                  return {
                    opportunityid: `unknown-${Math.random().toString(36).substring(7)}`,
                    name: "Unknown opportunity",
                    activities: [],
                    opportunityIndex: 0,
                    lastActivity: null
                  };
                }
                
                // Ensure activities is always an array
                const safeOpp = {
                  ...opp,
                  opportunityIndex: opp.opportunities_list_index ?? 0,
                  // Make sure activities is always an array
                  activities: Array.isArray(opp.activities) ? opp.activities : [],
                  // Safety check for lastActivity
                  lastActivity: opp.lastActivity || null
                };
                
                return safeOpp;
              });
            } catch (mapError) {
              console.error('Error mapping opportunities:', mapError);
              return [];
            }
          })()}
          loading={loading}
          onLogout={handleLogout}
          onOpportunitySelect={handleOpportunitySelect}
          isLoggingOut={isLoggingOut}
          closedOpportunities={closedOpportunities}
          toggleAutoOpen={toggleAutoOpen}
          autoOpen={autoOpen}
          onFetchMyOpenOpportunities={handleFetchMyOpenOpportunities}
        />
      );
    } catch (renderError) {
      console.error('FATAL RENDER ERROR:', renderError);
      return <div>Error rendering content: {renderError.message}</div>;
    }
  };

  return (
    <div style={{ 
      padding: "0", 
      fontFamily: "Arial, sans-serif",
      height: "100%",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#f3f2f1"
    }}>
      <ErrorMessage 
        message={error} 
        onDismiss={() => setError(null)} 
      />

      {renderContent()}
      
      {/* Debug panel */}
      <div style={{ 
        position: "fixed", 
        bottom: "0", 
        right: "0", 
        fontSize: "10px", 
        color: "#999",
        padding: "2px",
        backgroundColor: "rgba(255,255,255,0.8)"
      }}>
        <details>
          <summary>Debug</summary>
          <div>Org ID: {organizationId || 'Not detected'}</div>
          <div>Token: {accessToken ? 'Yes' : 'No'}</div>
          <div>Opp ID: {currentOpportunityId || 'None'}</div>
          <div>Opportunities: {opportunities.length}</div>
          <div>Closed Opportunities: {closedOpportunities.length}</div>
        </details>
      </div>
    </div>
  );
};

export default Popup;