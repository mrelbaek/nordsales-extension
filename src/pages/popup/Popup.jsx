import React, { useEffect, useState } from "react";
import { login, getAccessToken, logout } from "./utils/auth.js";
import { getCurrentOpportunityId, fetchOpportunityDetails, fetchOpportunitiesWithActivities } from "./utils/api.js";
import ErrorMessage from "./components/common/ErrorMessage.jsx";
import Login from "./components/Login.jsx";
import OpportunityList from "./components/OpportunityList";
import OpportunityDetail from "./components/OpportunityDetail";

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

  // Initialize the app
  useEffect(() => {
    async function initialize() {
      try {
        // Notify service worker that popup is open
        chrome.runtime.sendMessage({ type: "POPUP_OPENED" });
        
        // Get the token
        const token = await getAccessToken();
        console.log("Got access token:", token ? "yes" : "no");
        setAccessToken(token);
        
        if (token) {
          // Try to get current opportunity ID
          const oppId = await getCurrentOpportunityId();
          console.log("Current opportunity ID:", oppId);
          setCurrentOpportunityId(oppId);
          
          // Fetch data
          if (oppId) {
            await handleFetchOpportunityDetails(token, oppId);
          } else {
            await handleFetchOpportunities(token);
          }
        }

        // Get the auto-open preference
        chrome.storage.local.get(['autoOpen'], (result) => {
          setAutoOpen(result.autoOpen !== false);
        });
      } catch (error) {
        console.warn("Initialization error:", error);
        setError(error.message);
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
   * Fetch opportunity details and set state
   */
  const handleFetchOpportunityDetails = async (token, oppId) => {
    try {
      setLoading(true);
      setError(null);
      
      const opportunity = await fetchOpportunityDetails(token, oppId);
      setCurrentOpportunity(opportunity);
    } catch (error) {
      console.error("Error fetching opportunity details:", error);
      setError(`Failed to fetch opportunity details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch opportunities list and set state
   */
  const handleFetchOpportunities = async (token, userId = null) => {
    try {
      setLoading(true);
      setError(null);
      
      const opportunities = await fetchOpportunitiesWithActivities(token, userId);
      setOpportunities(opportunities);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      setError(`Failed to fetch opportunities list: ${error.message}`);
    } finally {
      setLoading(false);
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
    setError(null);
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
    if (!accessToken) {
      return <Login onLogin={handleLogin} />;
    }

    if (currentOpportunity) {
      return (
        <OpportunityDetail 
          opportunity={currentOpportunity}
          onBackClick={handleBackToList}
          toggleAutoOpen={toggleAutoOpen}
          autoOpen={autoOpen}
        />
      );
    }

    return (
      <OpportunityList 
        opportunities={opportunities}
        loading={loading}
        onLogout={handleLogout}
        onOpportunitySelect={handleOpportunitySelect}
        toggleAutoOpen={toggleAutoOpen}
        autoOpen={autoOpen}
      />
    );
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
      {/* Error message if any */}
      <ErrorMessage 
        message={error} 
        onDismiss={() => setError(null)} 
      />

      {/* Main content */}
      {renderContent()}
      
      {/* Debug panel - can be removed in production */}
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
        </details>
      </div>
    </div>
  );
};

export default Popup;