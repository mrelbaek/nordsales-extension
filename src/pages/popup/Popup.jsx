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
  const initializeSubscriptions = async () => {
    try {
      // No need to check for Supabase Auth user, just get the user from storage
      const { user } = await chrome.storage.local.get(["user"]);
      
      if (!user || !user.email) {
        console.warn("[Popup] No user in storage, defaulting to free tier");
        setSubscription({ status: 'free', isActive: true });
        return;
      }
      
      console.log("[Popup] Initializing subscription for email:", user.email);
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
      console.log("[Popup.jsx] handleFetchOpportunityDetails called for opportunity:", oppId);
      
      // Validate inputs
      if (!token) {
        console.error("[Popup.jsx] No token provided to handleFetchOpportunityDetails");
        setError("Authentication required");
        return;
      }
      
      if (!oppId) {
        console.error("[Popup.jsx] No opportunity ID provided to handleFetchOpportunityDetails");
        setError("No opportunity ID available");
        return;
      }
      
      // Prevent concurrent operations
      if (stateTransitionLock.current) {
        console.log("[Popup.jsx] State transition in progress, deferring opportunity details fetch");
        return;
      }
      
      // Acquire lock and set loading state
      stateTransitionLock.current = true;
      setLoading(true);
      
      // Set a temporary state to ensure UI shows we're loading a specific opportunity
      setCurrentOpportunity(prev => {
        // Only set temporary state if we don't already have this opportunity
        if (!prev || prev.opportunityid !== oppId) {
          return {
            opportunityid: oppId,
            name: "Loading opportunity...",
            loading: true,
            estimatedvalue: 0,
            createdon: new Date().toISOString(),
            estimatedclosedate: null
          };
        }
        return prev;
      });
      
      try {
        // Verify token validity first to prevent unnecessary API calls
        const loggedIn = await isLoggedIn();
        
        if (!loggedIn) {
          console.log("[Popup.jsx] Token invalid or expired, clearing token state");
          setAccessToken(null);
          setUser(null);
          setError("Your session has expired. Please log in again.");
          return;
        }
        
        // Now fetch opportunity details
        try {
          console.log("[Popup.jsx] Calling fetchOpportunityDetails for ID:", oppId);
          
          // Direct call to the API utility function
          await fetchOpportunityDetails(
            token,
            oppId,
            (isLoading) => setLoading(isLoading),
            setError,
            setCurrentOpportunity,
            setActivities
          );
          
          console.log("[Popup.jsx] Successfully loaded opportunity details");
          
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
          console.log("[Popup] Initialization already in progress, skipping");
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
          
          try {
            // Try to initialize subscriptions but don't fail if it doesn't work
            await initializeSubscriptions();
          } catch (subscriptionError) {
            console.warn("Error initializing subscriptions, continuing with free tier:", subscriptionError);
            setSubscription({ status: 'free', isActive: true });
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
              // Set a temporary loading state for better UX
              setCurrentOpportunity({
                opportunityid: oppId,
                name: "Loading...",
                loading: true
              });
              
              console.log("[Popup.jsx] Fetching initial opportunity details:", oppId);
              
              // Fetch the opportunity details with a small timeout to ensure state is updated
              setTimeout(async () => {
                try {
                  await fetchOpportunityDetails(
                    accessToken,
                    oppId,
                    setLoading,
                    setError,
                    setCurrentOpportunity,
                    setActivities
                  );
                  console.log("[Popup.jsx] Initial opportunity details loaded successfully");
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

  /**
   * Handle refresh button click - reload current data
   */
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
   * Handle opportunity selection by navigating the main CRM tab to the opportunity
   */
  const handleOpportunitySelect = async (opportunityId) => {
    try {
      console.log("[Popup.jsx] Navigating to opportunity:", opportunityId);
      
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
      
      console.log("[Popup.jsx] Navigating CRM tab to:", opportunityUrl);
      
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
      console.log("[Popup.jsx] State transition or logout in progress, deferring logout");
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
      
      console.log("[Popup.jsx] Logout successful - all state cleared");
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
      console.log("[Popup.jsx] Navigating back to opportunities list");
      
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
      // This URL navigates to the My Open Opportunities view
      const opportunitiesUrl = `${baseUrl}/main.aspx?pagetype=entitylist&etn=opportunity&viewid=00000000-0000-0000-00AA-000010001003&viewtype=1039`;
      
      console.log("[Popup.jsx] Navigating CRM tab to:", opportunitiesUrl);
      
      // Update the CRM tab with the new URL - this navigates the tab to the opportunities list
      await chrome.tabs.update(crmTab.id, { url: opportunitiesUrl, active: true });
      
      // Also clear local storage and state for consistency
      chrome.storage.local.remove(["currentOpportunityId", "lastUpdated"]);
      setCurrentOpportunity(null);
      setCurrentOpportunityId(null);
      lastOpportunityIdRef.current = null;
      
    } catch (error) {
      console.error("[Popup.jsx] Error navigating to opportunities list:", error);
      setError(`Could not navigate to opportunities list: ${error.message}`);
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
      // Add explicit decision logging
      console.log('[Popup] RENDER DECISION:', {
        accessToken: !!accessToken,
        currentOpportunityId,
        hasCurrentOpportunity: !!currentOpportunity,
        opportunityIdMatch: currentOpportunity?.opportunityid === currentOpportunityId,
        loading,
        stateTransitionLock: stateTransitionLock.current
      });

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
        console.log('[Popup] Rendering opportunity detail view for:', currentOpportunityId);
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