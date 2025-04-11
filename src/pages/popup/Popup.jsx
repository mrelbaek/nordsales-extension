// This is a modified version of your src/pages/popup/Popup.jsx file
// Adding Supabase authentication integration and fixing duplicate state declarations

import React, { useEffect, useState, useRef } from "react";
import { login, logout, isLoggedIn, getCurrentUser } from "../../utils/auth.js";
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
import DebugButton from "../../components/DebugButton.jsx";
import { getSubscriptionStatus, hasFeatureAccess } from "../../utils/subscriptions.js";
import { checkSupabaseConnection } from "../../utils/supabase.js";
import { restoreSupabaseSession } from '../../utils/session.js';

/**
 * Main popup component that manages the application state
 */
const Popup = () => {
  // Authentication & user states
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState({
    status: 'free',
    isActive: true
  });
  
  // Opportunity & data states
  const [opportunities, setOpportunities] = useState([]);
  const [currentOpportunityId, setCurrentOpportunityId] = useState(null);
  const [currentOpportunity, setCurrentOpportunity] = useState(null);
  const [activities, setActivities] = useState([]);
  const [closedOpportunities, setClosedOpportunities] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoOpen, setAutoOpen] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Refs for state management
  const stateTransitionLock = useRef(false);
  const lastOpportunityIdRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Initialize subscription information
  const initializeSubscriptions = async (userData) => {
    try {
      // Check if we have user data with email
      if (!userData || !userData.email) {
        console.warn("[Popup] Cannot initialize subscriptions: Missing user email");
        setSubscription({
          status: 'free',
          isActive: true
        });
        return;
      }
      
      console.log("[Popup] Initializing subscription for email:", userData.email);
      
      // Make sure to pass the email directly
      const subStatus = await getSubscriptionStatus(userData.email);
      setSubscription(subStatus);
      
      console.log("[Popup] Subscription initialized:", subStatus.status);
      
      // Store subscription info locally
      chrome.storage.local.set({ 
        subscriptionStatus: subStatus.status,
        subscriptionEndDate: subStatus.endDate
      });
    } catch (error) {
      console.error("Error initializing subscriptions:", error);
      // Set a default free subscription as fallback
      setSubscription({
        status: 'free',
        isActive: true
      });
    }
  };

  // Initialize the app
  useEffect(() => {
    async function initialize() {
      try {
        // Prevent multiple initializations
        if (stateTransitionLock.current) {
          console.log("[Popup] Initialization already in progress, skipping");
          return;
        }
        
        stateTransitionLock.current = true;
        
        // Check Supabase connection
        const supabaseStatus = await checkSupabaseConnection();
        if (!supabaseStatus.connected) {
          console.warn("Supabase connection issue:", supabaseStatus.error);
          // Continue with limited functionality
        }
        
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
            chrome.storage.local.set({ "organizationId": orgId });
          }

          if (!orgId) {
            // Wait and retry in 500ms
            await new Promise(resolve => setTimeout(resolve, 500));
            const retryOrgId = await getCurrentOrgId();
            setOrganizationId(retryOrgId);
            if (!retryOrgId) {
              setError("Please navigate to your Dynamics CRM environment first to use this extension.");
              stateTransitionLock.current = false;
              return;
            }
          }
        } catch (orgError) {
          console.warn("Error getting organization ID:", orgError);
          setError("Could not determine your Dynamics CRM organization. Please navigate to Dynamics CRM first.");
          stateTransitionLock.current = false;
          return;
        }
        
        // Check if already logged in
        const loggedIn = await isLoggedIn();
        
        if (loggedIn) {
          // Get stored token
          const { accessToken } = await chrome.storage.local.get(["accessToken"]);
          setAccessToken(accessToken);
          
          // Get user information
          const userData = await getCurrentUser();
          setUser(userData);
          
          // Initialize subscription status
          if (userData?.email) {
            await initializeSubscriptions(userData);
          }
          
          console.log("[Popup.jsx] Got access token:", accessToken ? "yes" : "no");
          
          // Try to get current opportunity ID
          try {
            const oppId = await getCurrentOpportunityId();
            console.log("[Popup.jsx] Current opportunity ID:", oppId);
            
            // Only update state if ID actually changed to prevent loops
            if (oppId !== lastOpportunityIdRef.current) {
              lastOpportunityIdRef.current = oppId;
              setCurrentOpportunityId(oppId);
            }
            
            // Fetch data
            if (oppId) {
              await handleFetchOpportunityDetails(accessToken, oppId);
            } else {
              await handleFetchOpportunities(accessToken);
            }
            
            // Also fetch closed opportunities for analytics
            await handleFetchClosedOpportunities(accessToken);
          } catch (idError) {
            console.warn("Error getting opportunity ID:", idError);
            await handleFetchOpportunities(accessToken);
            await handleFetchClosedOpportunities(accessToken);
          }
        } else {
          console.log("[Popup.jsx] No valid login found, user needs to log in.");
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
      } finally {
        // Release the lock
        stateTransitionLock.current = false;
      }
    }
    
    initialize();
    
    // Set up polling for opportunity ID changes with debouncing
    const storageCheckInterval = setInterval(() => {
      // Skip check if lock is active
      if (stateTransitionLock.current) return;
      
      chrome.storage.local.get(['currentOpportunityId', 'lastUpdated', 'currentOrgId'], (result) => {
        // Check for organization ID changes
        if (result.currentOrgId && result.currentOrgId !== organizationId) {
          setOrganizationId(result.currentOrgId);
        }
        
        if (result.currentOpportunityId && result.lastUpdated) {
          // If the ID is different from what we have, or we don't have one
          if (result.currentOpportunityId !== lastOpportunityIdRef.current) {
            console.log("[Popup.jsx] Storage poll detected new opportunity ID:", result.currentOpportunityId);
            
            // Clear any existing timer
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            
            // Set a new timer to debounce changes
            debounceTimerRef.current = setTimeout(() => {
              // Only proceed if state hasn't changed during timeout
              if (result.currentOpportunityId !== lastOpportunityIdRef.current) {
                lastOpportunityIdRef.current = result.currentOpportunityId;
                setCurrentOpportunityId(result.currentOpportunityId);
                
                if (accessToken) {
                  handleFetchOpportunityDetails(accessToken, result.currentOpportunityId);
                }
              }
              debounceTimerRef.current = null;
            }, 300); // 300ms debounce time
          }
        } else if (lastOpportunityIdRef.current && !result.currentOpportunityId) {
          // If we had an ID but it's now cleared in storage
          console.log("[Popup.jsx] Opportunity ID cleared in storage");
          lastOpportunityIdRef.current = null;
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
      
      // Skip message handling if lock is active
      if (stateTransitionLock.current) {
        console.log("[Popup.jsx] State transition lock active, deferring message handling");
        return;
      }
      
      if (message.type === "OPPORTUNITY_DETECTED") {
        console.log("[Popup.jsx] Received opportunity ID from content script:", message.opportunityId);
        
        // Skip if same ID to prevent loops
        if (message.opportunityId === lastOpportunityIdRef.current) {
          console.log("[Popup.jsx] Skipping duplicate opportunity ID update");
          return;
        }
        
        lastOpportunityIdRef.current = message.opportunityId;
        setCurrentOpportunityId(message.opportunityId);
        
        // Update organization ID if provided
        if (message.organizationId) {
          setOrganizationId(message.organizationId);
        }
        
        if (accessToken) {
          // Debounce the API call
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          
          debounceTimerRef.current = setTimeout(() => {
            handleFetchOpportunityDetails(accessToken, message.opportunityId);
            debounceTimerRef.current = null;
          }, 300);
        }
      } else if (message.type === "OPPORTUNITY_CLEARED") {
        console.log("[Popup.jsx] Opportunity cleared notification received");
        lastOpportunityIdRef.current = null;
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
      
      // Clear any pending timeouts
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [accessToken, organizationId]);

  // Set up styling for the app container
  useEffect(() => {
    // Set title
    document.title = "Lens";
    
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
      // Prevent concurrent operations
      if (stateTransitionLock.current) {
        console.log("[Popup.jsx] State transition in progress, deferring opportunity details fetch");
        return;
      }
      
      stateTransitionLock.current = true;
      setLoading(true);
      setError(null);
      
      // First check if the token is still valid
      await isLoggedIn().then(async (loggedIn) => {
        if (!loggedIn) {
          // Token is invalid, show login screen
          console.log("[Popup.jsx] Token invalid or expired, clearing token state");
          setAccessToken(null);
          setUser(null);
          setError("Your session has expired. Please log in again.");
          setLoading(false);
          stateTransitionLock.current = false;
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
              setLoading,
              setUser // Add the user state setter
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
    } finally {
      setLoading(false);
      stateTransitionLock.current = false;
    }
  };

  /**
   * Fetch opportunities list and set state
   */
  const handleFetchOpportunities = async (token, userId = null) => {
    try {
      // Prevent concurrent operations
      if (stateTransitionLock.current) {
        console.log("[Popup.jsx] State transition in progress, deferring opportunities fetch");
        return;
      }
      
      stateTransitionLock.current = true;
      
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
    } finally {
      stateTransitionLock.current = false;
    }
  };

  // Add this function to your Popup.jsx component
  const handleRefresh = async () => {
    try {
      // Prevent concurrent operations
      if (stateTransitionLock.current) {
        console.log("[Popup.jsx] State transition in progress, deferring refresh");
        return;
      }
      
      stateTransitionLock.current = true;
      setLoading(true);
      
      // Just fetch opportunities without trying to update subscription
      if (currentOpportunityId && currentOpportunity) {
        // If we're viewing a specific opportunity, refresh that
        await handleFetchOpportunityDetails(accessToken, currentOpportunityId);
      } else {
        // Otherwise refresh the opportunities list
        await fetchOpportunitiesWithActivities(
          accessToken, 
          setLoading, 
          setError, 
          setOpportunities, 
          setDebugInfo
        );
      }
      
      // Also refresh closed opportunities for analytics
      await handleFetchClosedOpportunities(accessToken);
      
      console.log("[Popup.jsx] Refresh completed successfully");
    } catch (error) {
      console.error("Error during refresh:", error);
      setError(`Failed to refresh data: ${error.message}`);
    } finally {
      stateTransitionLock.current = false;
      setLoading(false);
    }
  };


  /**
   * Fetch all open opportunities for current user
   */
  const handleFetchMyOpenOpportunities = async () => {
    try {
      // Prevent concurrent operations
      if (stateTransitionLock.current) {
        console.log("[Popup.jsx] State transition in progress, deferring my opportunities fetch");
        return;
      }
      
      stateTransitionLock.current = true;
      
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
    } finally {
      stateTransitionLock.current = false;
    }
  };

  /**
   * Handle login with integrated Supabase and Dynamics
   */
  const handleLogin = async () => {
    try {
      // Prevent concurrent operations
      if (stateTransitionLock.current) {
        console.log("[Popup.jsx] State transition in progress, deferring login");
        return;
      }
      
      stateTransitionLock.current = true;
      
      // Check for organization ID first
      if (!organizationId) {
        const orgId = await getCurrentOrgId();
        if (!orgId) {
          setError("Please navigate to your Dynamics CRM environment first to use this extension.");
          stateTransitionLock.current = false;
          return;
        }
        setOrganizationId(orgId);
      }
      
      setError(null);
      setLoading(true);
      
      try {
        // Integrated login that handles both Dynamics and Supabase
        const result = await login();
        
        if (!result.success) {
          throw new Error(result.error?.message || "Login failed");
        }
        
        console.log("[Popup.jsx] Login successful, got token");
        setAccessToken(result.token);
        
        // Set user data from login result
        if (result.user) {
          setUser(result.user);
          await initializeSubscriptions(result.user);
        } else {
          console.warn("[Popup.jsx] No user data in login result");
        }
        
        // Check if we have an opportunity ID
        if (lastOpportunityIdRef.current) {
          handleFetchOpportunityDetails(result.token, lastOpportunityIdRef.current);
        } else {
          handleFetchOpportunities(result.token);
          handleFetchClosedOpportunities(result.token);
        }
      } catch (loginError) {
        if (loginError.message && loginError.message.includes("did not approve")) {
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
    } finally {
      stateTransitionLock.current = false;
    }
  };

  /**
   * Handle logout action with state updates
   */
  const handleLogout = async () => {
    try {
      // Prevent concurrent operations
      if (stateTransitionLock.current || isLoggingOut) {
        console.log("[Popup.jsx] State transition or logout in progress, deferring logout");
        return;
      }
      
      stateTransitionLock.current = true;
      setIsLoggingOut(true);
      
      // Call the enhanced logout function with all state setters
      const result = await logout(
        setAccessToken,
        setOpportunities,
        setCurrentOpportunity,
        setActivities,
        setError,
        null, // Don't pass setLoading as we're using setIsLoggingOut instead
        setUser // Add the user state setter
      );
      
      if (result.success) {
        console.log("[Popup.jsx] Logout successful");
        // Clear opportunity references
        lastOpportunityIdRef.current = null;
        setCurrentOpportunityId(null);
        
        // Reset subscription status
        setSubscription({
          status: 'free',
          isActive: true
        });
      } else {
        console.error("Logout failed:", result.error);
        setError(`Logout failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Unexpected error during logout:", error);
      setError(`An unexpected error occurred during logout: ${error.message}`);
    } finally {
      setIsLoggingOut(false);
      stateTransitionLock.current = false;
    }
  };

  /**
   * Handle back button click - carefully reset state to prevent loops
   */
  const handleBackToList = () => {
    // Prevent concurrent operations
    if (stateTransitionLock.current) {
      console.log("[Popup.jsx] State transition in progress, deferring back navigation");
      return;
    }
    
    stateTransitionLock.current = true;
    
    try {
      console.log("[Popup.jsx] Handling back button click");
      
      // Clear opportunity ID references first
      lastOpportunityIdRef.current = null;
      chrome.storage.local.remove(["currentOpportunityId", "lastUpdated"], () => {
        console.log("[Popup.jsx] Cleared opportunity ID from storage");
      });
      
      // Clear opportunity details
      setCurrentOpportunity(null);
      setCurrentOpportunityId(null);
      
      // Fetch opportunities only after state is cleared
      setTimeout(() => {
        if (accessToken) {
          handleFetchOpportunities(accessToken);
        }
        stateTransitionLock.current = false;
      }, 100);
    } catch (error) {
      console.error("Error in back navigation:", error);
      stateTransitionLock.current = false;
    }
  };

  /**
   * Handle opportunity selection
   */
  const handleOpportunitySelect = (opportunityId) => {
    // Prevent loops - if already on this opportunity, do nothing
    if (opportunityId === lastOpportunityIdRef.current && currentOpportunity) {
      console.log("[Popup.jsx] Already showing this opportunity, skipping selection");
      return;
    }
    
    // Prevent concurrent operations
    if (stateTransitionLock.current) {
      console.log("[Popup.jsx] State transition in progress, deferring opportunity selection");
      return;
    }
    
    console.log("[Popup.jsx] Selecting opportunity:", opportunityId);
    
    // Update references and storage
    lastOpportunityIdRef.current = opportunityId;
    chrome.storage.local.set({ 
      currentOpportunityId: opportunityId,
      lastUpdated: Date.now()
    });
    
    // Update state
    setCurrentOpportunityId(opportunityId);
    
    // Fetch details
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
   * Check if feature is available for current subscription
   */
  const canUseFeature = (featureName) => {
    return hasFeatureAccess(featureName, subscription?.status || 'free');
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
      console.log('[Popup] User:', user?.email || 'not logged in');
      console.log('[Popup] Subscription:', subscription?.status || 'none');
      console.log('[Popup] Current Opportunity:', currentOpportunity ? currentOpportunity.opportunityid : 'none');
      console.log('[Popup] Current Opportunity ID:', currentOpportunityId);
      console.log('[Popup] State Transition Lock:', stateTransitionLock.current);
      console.log('[Popup] Last Opportunity ID Ref:', lastOpportunityIdRef.current);
      console.log('[Popup] Opportunities Count:', opportunities.length);
      console.log('[Popup] Closed Opportunities Count:', closedOpportunities.length);
      
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
    
      // Important change: Check both currentOpportunityId and currentOpportunity
      // Only render opportunity detail when we have both
      if (currentOpportunityId && currentOpportunity) {
        console.log('[Popup] Rendering opportunity detail view');
        return (
          <OpportunityDetail 
            opportunity={currentOpportunity}
            activities={activities || []}
            closedOpportunities={closedOpportunities || []}
            onBackClick={handleBackToList}
            toggleAutoOpen={toggleAutoOpen}
            autoOpen={autoOpen}
            onLogout={handleLogout}
            onFetchMyOpenOpportunities={handleRefresh}
            isLoggingOut={isLoggingOut}
            subscription={subscription}
            canUseFeature={canUseFeature}
            user={user}
          />
        );
      }
    
      console.log('[Popup] Rendering opportunity list view');
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
          accessToken={accessToken}
          onFetchMyOpenOpportunities={handleRefresh}
          subscription={subscription}
          canUseFeature={canUseFeature}
          user={user}
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
      backgroundColor: "#ededed"
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
          <div>User: {user?.email || 'None'}</div>
          <div>Subscription: {subscription?.status || 'None'}</div>
          <div>Opp ID: {currentOpportunityId || 'None'}</div>
          <div>Last Opp Ref: {lastOpportunityIdRef.current || 'None'}</div>
          <div>Lock: {stateTransitionLock.current ? 'Active' : 'Inactive'}</div>
          <div>Opportunities: {opportunities.length}</div>
          <div>Closed Opportunities: {closedOpportunities.length}</div>
        </details>
      </div>
    </div>
  );
};

export default Popup;