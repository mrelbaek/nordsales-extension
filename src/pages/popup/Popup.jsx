import React, { useEffect, useState } from "react";
import { login, getAccessToken, logout } from "../../utils/auth.js";
import {
  getCurrentOpportunityId,
  fetchOpportunityDetails,
  fetchOpportunitiesWithActivities,
  fetchMyOpenOpportunities,
  fetchClosedOpportunities
} from "../../utils/opportunityUtils.js";
import ErrorMessage from "../../components/common/ErrorMessage.jsx";
import Login from "../../components/Login.jsx";
import OpportunityList from "../../components/OpportunityList";
import OpportunityDetail from "../../components/OpportunityDetail";

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

  // Initialize the app
  useEffect(() => {
    async function initialize() {
      try {
        // Notify service worker that popup is open
        chrome.runtime.sendMessage({ type: "POPUP_OPENED" });
        
        // Clear any existing errors
        setError(null);
        setDebugInfo(null);
        
        // Get the token
        const token = await getAccessToken();
        console.log("Got access token:", token ? "yes" : "no");
        setAccessToken(token);
        
        if (token) {
          // Try to get current opportunity ID
          try {
            const oppId = await getCurrentOpportunityId();
            console.log("Current opportunity ID:", oppId);
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
          console.log("No valid token found, user needs to log in.");
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
      chrome.storage.local.get(['currentOpportunityId', 'lastUpdated'], (result) => {
        if (result.currentOpportunityId && result.lastUpdated) {
          // If the ID is different from what we have, or we don't have one
          if (result.currentOpportunityId !== currentOpportunityId) {
            console.log("Storage poll detected new opportunity ID:", result.currentOpportunityId);
            setCurrentOpportunityId(result.currentOpportunityId);
            if (accessToken) {
              handleFetchOpportunityDetails(accessToken, result.currentOpportunityId);
            }
          }
        } else if (currentOpportunityId && !result.currentOpportunityId) {
          // If we had an ID but it's now cleared in storage
          console.log("Opportunity ID cleared in storage");
          setCurrentOpportunityId(null);
          if (accessToken) {
            handleFetchOpportunities(accessToken);
          }
        }
      });
    }, 1000); // Check every second
    
    // Listen for opportunity detection from content script
    const handleMessage = (message) => {
      console.log("Popup received message:", message.type);
      
      if (message.type === "OPPORTUNITY_DETECTED") {
        console.log("Received opportunity ID from content script:", message.opportunityId);
        setCurrentOpportunityId(message.opportunityId);
        if (accessToken) {
          handleFetchOpportunityDetails(accessToken, message.opportunityId);
        }
      } else if (message.type === "OPPORTUNITY_CLEARED") {
        console.log("Opportunity cleared notification received");
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
      console.log("Effect triggered: fetching opportunity details");
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
      await fetchClosedOpportunities(
        token,
        setLoading,
        setError,
        setClosedOpportunities
      );
    } catch (error) {
      console.error("Error fetching closed opportunities:", error);
      setError(`Failed to fetch closed opportunities: ${error.message}`);
    }
  };

  /**
   * Fetch opportunity details and set state
   */
  const handleFetchOpportunityDetails = async (token, oppId) => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the utility function to fetch opportunity details
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
    } catch (error) {
      console.error("Error fetching opportunity details:", error);
      setError(`Failed to fetch opportunity details: ${error.message}`);
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
      setError(null);
      const token = await login();
      console.log("Login successful, got token");
      setAccessToken(token);
      
      // Check if we have an opportunity ID
      if (currentOpportunityId) {
        handleFetchOpportunityDetails(token, currentOpportunityId);
      } else {
        handleFetchOpportunities(token);
        handleFetchClosedOpportunities(token);
      }
    } catch (error) {
      console.error("Login failed:", error);
      setError(`Login failed: ${error.message}`);
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    await logout();
    setAccessToken(null);
    setOpportunities([]);
    setCurrentOpportunity(null);
    setActivities([]);
    setClosedOpportunities([]);
    setError(null);
    setDebugInfo(null);
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
      console.log('RENDER CONTENT DEBUG:');
      console.log('Access Token:', !!accessToken);
      console.log('Current Opportunity:', currentOpportunity);
      console.log('Opportunities Count:', opportunities.length);
      console.log('Closed Opportunities Count:', closedOpportunities.length);
      console.log('Opportunities:', JSON.stringify(opportunities.map(o => ({
        id: o.opportunityid, 
        name: o.name, 
        activitiesCount: o.activities?.length || 0
      })), null, 2));
  
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
                console.log(`Processing opportunity:`, opp);
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
          <div>Token: {accessToken ? 'Yes' : 'No'}</div>
          <div>ID: {currentOpportunityId || 'None'}</div>
          <div>Opportunities: {opportunities.length}</div>
          <div>Closed Opportunities: {closedOpportunities.length}</div>
        </details>
      </div>
    </div>
  );
};

export default Popup;