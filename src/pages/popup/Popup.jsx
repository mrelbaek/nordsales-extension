// Fixed Popup.jsx with properly implemented handleFetchOpportunityDetails function
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
import { checkSupabaseConnection, supabase } from "../../utils/supabase.js";
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
  const lastFetchedOpportunityRef = useRef(null);

  
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
  const [isOnCrmTab, setIsOnCrmTab] = useState(true);

  // Initialize subscription information
  const initializeSubscriptions = async () => {
    try {
      // No need to check for Supabase Auth user, just get the user from storage
      const { user } = await chrome.storage.local.get(["user"]);
      
      if (!user || !user.email) {
        // [Popup] No user in storage, defaulting to free tier
        setSubscription({ status: 'free', isActive: true });
        return;
      }
      
      const subStatus = await getSubscriptionStatus();
      setSubscription(subStatus);
      
      chrome.storage.local.set({
        subscriptionStatus: subStatus.status,
        subscriptionEndDate: subStatus.endDate
      });
    } catch (err) {
      console.error("Error initializing subscriptions:", err);
      setSubscription({ status: 'free', isActive: true });
    }
  };

  /**
   * Fetch opportunity details and set state
   * This is the missing function that was causing the error
   */
  const handleFetchOpportunityDetails = async (token, oppId) => {
    try {
      
      // Validate inputs
      if (!token) {
        console.error("[Popup.jsx] No token provided to handleFetchOpportunityDetails");
        return;
      }
      
      if (!oppId) {
        console.error("[Popup.jsx] No opportunity ID provided to handleFetchOpportunityDetails");
        setError("No opportunity ID available");
        return;
      }
      
      // Prevent concurrent operations
      if (stateTransitionLock.current) {
        return;
      }
      
      // Acquire lock and set loading state
      stateTransitionLock.current = true;
      setLoading(true);
      
      if (lastFetchedOpportunityRef.current === oppId) {
        stateTransitionLock.current = false;
        setLoading(false);
        return;
      }


      if (currentOpportunity?.opportunityid === oppId) {
        return;
      }
      
      try {
        // Verify token validity first to prevent unnecessary API calls
        const loggedIn = await isLoggedIn();
        
        if (!loggedIn) {
          setAccessToken(null);
          setUser(null);
          setError("Your session has expired. Please log in again.");
          return;
        }
        
        // Now fetch opportunity details
        try {
          
          // Direct call to the API utility function
          await fetchOpportunityDetails(
            token,
            oppId,
            (isLoading) => setLoading(isLoading),
            setError,
            setCurrentOpportunity,
            setActivities
          );
                    
          // Also fetch closed opportunities for analytics in the background
          handleFetchClosedOpportunities(token).catch(err => {
            console.warn("[Popup.jsx] Error fetching closed opportunities:", err);
            // Don't fail the main operation if this background task fails
          });
        } catch (apiError) {
          // Handle API errors, especially authentication failures
          if (apiError.message && (
              apiError.message.includes("Authentication failed") ||
              apiError.message.includes("401"))) {
            console.error("[Popup.jsx] Authentication failed during API call:", apiError);
            await logout(
              setLoading,
              setAccessToken,
              setOpportunities,
              setCurrentOpportunity,
              setActivities,
              setUser,
              setError
            );
          } else {
            console.error("[Popup.jsx] Error fetching opportunity details:", apiError);
            setError(`Failed to fetch opportunity details: ${apiError.message}`);
            
            // If we fail to load details, clear the opportunity state to show the list view
            setCurrentOpportunity(null);
          }
        }
      } catch (error) {
        console.error("[Popup.jsx] Error checking login status:", error);
        setError("Failed to verify authentication status. Please try again.");
        
        // If we encounter an error, clear the opportunity state to show the list view
        setCurrentOpportunity(null);
      } finally {
        setLoading(false);
        stateTransitionLock.current = false;
      }
    } catch (error) {
      console.error("[Popup.jsx] General error in handleFetchOpportunityDetails:", error);
      setError("An unexpected error occurred");
      setLoading(false);
      stateTransitionLock.current = false;
      
      // If we encounter an error, clear the opportunity state to show the list view
      setCurrentOpportunity(null);
    }
  };

  // Initialize the app
  useEffect(() => {
    async function initialize() {
      try {
        // Prevent multiple initializations
        if (stateTransitionLock.current) {
          return;
        }
        
        stateTransitionLock.current = true;
        
        // Check Supabase connection but don't fail if there's an issue
        try {
          const supabaseStatus = await checkSupabaseConnection();
          if (!supabaseStatus.connected) {
            console.warn("Supabase connection issue:", supabaseStatus.error);
            // Continue anyway - we can still use the app with limited functionality
          }
        } catch (supabaseError) {
          console.warn("Error checking Supabase connection:", supabaseError);
          // Continue anyway
        }
        
        // Notify service worker that popup is open
        chrome.runtime.sendMessage({ type: "POPUP_OPENED" }).catch((err) => {
          console.warn("[Popup] POPUP_OPENED:", err?.message || err);
        });
        
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
          
          try {
            // Try to initialize subscriptions but don't fail if it doesn't work
            await initializeSubscriptions();
          } catch (subscriptionError) {
            console.warn("Error initializing subscriptions, continuing with free tier:", subscriptionError);
            setSubscription({ status: 'free', isActive: true });
          }
          
          // console.log("[Popup.jsx] Got access token:", accessToken ? "yes" : "no");
          
          // Try to get current opportunity ID
          try {
            const oppId = await getCurrentOpportunityId();
            
            // Only update state if ID actually changed to prevent loops
            if (oppId) {
              setCurrentOpportunityId(oppId); // ✅ Triggers the centralized fetch logic in useEffect
            } else {
              await handleFetchOpportunities(accessToken);
            }
            
            // Fetch data
            if (oppId) {
              // Set a temporary loading state for better UX
              setCurrentOpportunity({
                opportunityid: oppId,
                name: "Loading...",
                loading: true
              });
                            
              // Fetch the opportunity details with a small timeout to ensure state is updated
              setTimeout(async () => {
                try {
                  await fetchOpportunityDetails(
                    accessToken,
                    oppId,
                    (isLoading) => setLoading(isLoading),
                    setError,
                    setCurrentOpportunity,
                    setActivities
                  );

                  lastOpportunityIdRef.current = oppId;

                } catch (fetchError) {
                  console.error("[Popup.jsx] Error loading initial opportunity:", fetchError);
                  // If there's an error, fall back to the list view
                  setCurrentOpportunity(null);
                  setCurrentOpportunityId(null);
                  await handleFetchOpportunities(accessToken);
                }
              }, 100);
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
      if (stateTransitionLock.current) return;
    
      chrome.storage.local.get(['currentOpportunityId', 'lastUpdated', 'currentOrgId'], (result) => {
        const newId = result.currentOpportunityId;
    
        // More conservative check for clearing opportunity
        if (!newId && (currentOpportunityId || lastOpportunityIdRef.current)) {
          
          // Prevent multiple simultaneous resets
          if (stateTransitionLock.current) return;
          
          stateTransitionLock.current = true;
          
          setCurrentOpportunityId(null);
          setCurrentOpportunity(null);
          lastOpportunityIdRef.current = null;
          
          if (accessToken) {
            setTimeout(async () => {
              try {
                await handleFetchOpportunities(accessToken);
              } catch (error) {
                console.error("[Popup.jsx] Error refetching opportunities:", error);
              } finally {
                stateTransitionLock.current = false;
              }
            }, 500);
          }
          return;
        }
    
        // Rest of the existing interval logic...
      });
    }, 2000);  // Increased interval to reduce frequency
    
    
    // Listen for opportunity detection from content script
    const handleMessage = (message) => {
    
    // Listen for CRM tab open  
    if (message.type === "TAB_CONTEXT_UPDATE") {
      setIsOnCrmTab(message.isCRM);
    }

      // Prevent concurrent or redundant operations
      if (stateTransitionLock.current) {
        return;
      }
      
      if (message.type === "OPPORTUNITY_DETECTED") {
      
        const newId = message.opportunityId;
        if (
          newId &&
          newId !== currentOpportunityId &&
          newId !== lastOpportunityIdRef.current &&
          !stateTransitionLock.current
        ) {
          setCurrentOpportunityId(newId); // 🔁 this will trigger the fetch via useEffect
        }
      }
      
      if (message.type === "OPPORTUNITY_CLEARED") {
        
        // Prevent immediate re-fetch if already in list view
        if (!currentOpportunityId && !currentOpportunity) {
          return;
        }
    
        // Use a more controlled reset
        stateTransitionLock.current = true;
        
        setCurrentOpportunityId(null);
        setCurrentOpportunity(null);
        lastOpportunityIdRef.current = null;
    
        // Add a slight delay to prevent immediate re-fetch
        setTimeout(async () => {
          try {
            await handleFetchOpportunities(accessToken);
          } catch (error) {
            console.error("[Popup.jsx] Error refetching opportunities:", error);
          } finally {
            stateTransitionLock.current = false;
          }
        }, 300);
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
  }, [accessToken, organizationId, currentOpportunityId, JSON.stringify(user), JSON.stringify(subscription)]);

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
      await fetchClosedOpportunities(
        token,
        setLoading,
        setError,
        setClosedOpportunities
      );
      // Need to use setTimeout because state updates are asynchronous
      setTimeout(() => {
      }, 100);
    } catch (error) {
      console.error("Error fetching closed opportunities:", error);
    }
  };

  /**
   * Fetch opportunities list and set state
   */
  const handleFetchOpportunities = async (token, userId = null) => {
    try {
      // Prevent concurrent operations
      if (stateTransitionLock.current) {
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

  /**
   * Handle refresh button click - reload current data
   */
  const handleRefresh = async () => {
    try {
      // Prevent concurrent operations
      if (stateTransitionLock.current) {
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
          // console.log("[Popup.jsx] User cancelled the login dialog");
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
   * Handle opportunity selection by navigating the main CRM tab to the opportunity
   */
  const handleOpportunitySelect = async (opportunityId) => {
    try {
      
      // Get all tabs and find the Dynamics CRM tab
      const tabs = await chrome.tabs.query({ url: "*://*.crm.dynamics.com/*" });
      
      if (!tabs || tabs.length === 0) {
        setError("No Dynamics CRM tab found");
        return;
      }
      
      // Assume the first CRM tab is the one we want to navigate
      const crmTab = tabs[0];
      
      // Extract the base URL from the CRM tab
      const baseUrl = crmTab.url.match(/(https:\/\/[^\/]+)/)[1];
      
      // Construct the opportunity URL
      const opportunityUrl = `${baseUrl}/main.aspx?etn=opportunity&pagetype=entityrecord&id=${opportunityId}`;
            
      // Update the CRM tab with the new URL - this navigates the tab to the opportunity
      await chrome.tabs.update(crmTab.id, { url: opportunityUrl, active: true });
      
      // No need to close the popup manually as it will close automatically
      // when the background tab is activated
      
    } catch (error) {
      console.error("[Popup.jsx] Error navigating to opportunity:", error);
      setError(`Could not navigate to opportunity: ${error.message}`);
    }
  };

  /**
   * Handle logout action with state updates
   */
  const handleLogout = async () => {
    if (stateTransitionLock.current) {
      return;
    }
  
    stateTransitionLock.current = true;
    setIsLoggingOut(true);
    
    try {
      // Clear storage directly first to prevent race conditions
      await chrome.storage.local.remove([
        "accessToken", 
        "expirationTime", 
        "user", 
        "subscription", 
        "currentOpportunityId", 
        "lastUpdated"
      ]);
      
      // Clear all state in a specific order
      setCurrentOpportunityId(null);
      setCurrentOpportunity(null);
      setOpportunities([]);
      setActivities([]);
      setClosedOpportunities([]);
      lastOpportunityIdRef.current = null;
      
      // Clear credentials last to force login screen to appear
      setAccessToken(null);
      setUser(null);
      
      // Clear any errors
      setError(null);
      
    } catch (error) {
      console.error("Unexpected error during logout:", error);
      setError(`An unexpected error occurred during logout: ${error.message}`);
    } finally {
      stateTransitionLock.current = false;
      setIsLoggingOut(false);
    }
  };

  /**
   * Handle back button click by navigating the CRM tab to the opportunities list
   */
  const handleBackToList = async () => {
    try {
      
      // Get all tabs and find the Dynamics CRM tab
      const tabs = await chrome.tabs.query({ url: "*://*.crm.dynamics.com/*" });
      
      if (!tabs || tabs.length === 0) {
        setError("No Dynamics CRM tab found");
        return;
      }
      
      // Assume the first CRM tab is the one we want to navigate
      const crmTab = tabs[0];
      
      // Extract the base URL from the CRM tab
      const baseUrl = crmTab.url.match(/(https:\/\/[^\/]+)/)[1];
      
      // Construct the opportunities list URL
      const opportunitiesUrl = `${baseUrl}/main.aspx?pagetype=entitylist&etn=opportunity&viewid=00000000-0000-0000-00AA-000010001003&viewtype=1039`;
            
      // Update the CRM tab with the new URL - this navigates the tab to the opportunities list
      await chrome.tabs.update(crmTab.id, { url: opportunitiesUrl, active: true });
      
      // Completely reset state to prevent loops
      stateTransitionLock.current = true;
      
      // Clear storage and state
      await chrome.storage.local.remove(["currentOpportunityId", "lastUpdated"]);
      
      // Reset all relevant states
      setCurrentOpportunity(null);
      setCurrentOpportunityId(null);
      lastOpportunityIdRef.current = null;
      
      // Fetch opportunities after a short delay to ensure clean state
      setTimeout(async () => {
        try {
          await handleFetchOpportunities(accessToken);
          await handleFetchClosedOpportunities(accessToken);
        } catch (error) {
          console.error("[Popup.jsx] Error refreshing opportunities after back:", error);
        } finally {
          stateTransitionLock.current = false;
        }
      }, 500);
      
    } catch (error) {
      console.error("[Popup.jsx] Error navigating to opportunities list:", error);
      setError(`Could not navigate to opportunities list: ${error.message}`);
      stateTransitionLock.current = false;
    }
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
    chrome.runtime.sendMessage({ type: "SET_AUTO_OPEN", enabled: newValue }).catch((err) => {
      console.warn("[Popup] Could not send message (SET_AUTO_OPEN):", err?.message || err);
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

      if (!isOnCrmTab) {
        return (
          <div style={{ padding: "20px", textAlign: "center" }}>
            <h3>Lens is inactive</h3>
            <p>Please switch to your Dynamics CRM tab to use this extension.</p>
          </div>
        );
      }

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
      if (
        currentOpportunityId && 
        currentOpportunity && 
        currentOpportunity.opportunityid === currentOpportunityId
      ) {
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
        <div>Access Token: {accessToken ? 'Yes' : 'No'}</div>
        <div>User: {user?.email || 'None'}</div>
        <div>Subscription: {subscription?.status || 'None'}</div>
        <div>Current Opp ID: {currentOpportunityId || 'None'}</div>
        <div>Matched Opp ID: {currentOpportunity?.opportunityid === currentOpportunityId ? 'Yes' : 'No'}</div>
        <div>Last Opp Ref: {lastOpportunityIdRef.current || 'None'}</div>
        <div>Lock: {stateTransitionLock.current ? 'Active' : 'Inactive'}</div>
        <div>Loading: {loading ? 'Yes' : 'No'}</div>
        <div>Opps: {opportunities.length}</div>
        <div>Closed Opps: {closedOpportunities.length}</div>
        </details>
      </div>
    </div>
  );
};

export default Popup;