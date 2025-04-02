import { getCurrentOrgId } from './opportunityUtils';

// Will be set dynamically based on the organization ID
let BASE_URL = null;

/**
 * Get the dynamic base URL for API calls
 * @returns {Promise<string>} The base URL for Dynamics API
 */
export const getDynamicsBaseUrl = async () => {
  if (BASE_URL) return BASE_URL;
  
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error("[API] Cannot create base URL: Organization ID not found");
    throw new Error("[API] Cannot determine organization ID. Please navigate to Dynamics CRM first.");
  }
  
  BASE_URL = `https://${orgId}.crm.dynamics.com/api/data/v9.2`;
  console.log(`[API] Using Dynamics API base URL: ${BASE_URL}`);
  return BASE_URL;
};

/**
 * Default headers for Dynamics API requests with improved token handling
 * @param {string} token - Access token
 * @returns {Object} Headers object
 */
const getDefaultHeaders = (token) => {
  if (!token) {
    console.error("[API] No token provided for API request");
    throw new Error("[API] Authentication token missing");
  }
  
  // Ensure token has Bearer prefix
  const formattedToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  console.log(`[API] Token format: ${formattedToken.substring(0, 16)}...`);
  
  return {
    "Authorization": formattedToken,
    "Accept": "application/json",
    "OData-MaxVersion": "4.0",
    "OData-Version": "4.0",
    "Content-Type": "application/json"
  };
};

/**
 * Handle API response with improved error handling
 * @param {Response} response - Fetch response object
 * @param {string} context - Context for error message
 * @returns {Promise<Object>} Parsed response data
 */
const handleApiResponse = async (response, context) => {
  console.log(`[API] ${context} response status: ${response.status}`);
  
  if (response.status === 401) {
    console.error(`[API] Authentication failed (401) during ${context}`);
    throw new Error("[API] Authentication failed. Please log in again.");
  }
  
  if (!response.ok) {
    let errorText = '';
    try {
      const errorData = await response.json();
      errorText = JSON.stringify(errorData);
    } catch (e) {
      errorText = await response.text();
    }
    
    console.error(`[API] API error during ${context}: ${response.status} - ${errorText}`);
    throw new Error(`[API] Failed to ${context}: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
};

/**
 * Get current user information with improved error handling
 * @param {string} token - Access token
 * @returns {Promise<string>} User ID
 */
export const getCurrentUserId = async (token) => {
  try {
    const baseUrl = await getDynamicsBaseUrl();
    console.log(`[API] Fetching current user with WhoAmI endpoint: ${baseUrl}/WhoAmI`);
    
    const response = await fetch(`${baseUrl}/WhoAmI`, {
      method: 'GET',
      headers: getDefaultHeaders(token)
    });
    
    const data = await handleApiResponse(response, "fetch current user");
    console.log("[API] WhoAmI response:", JSON.stringify(data, null, 2));
    
    if (!data.UserId) {
      console.error("[API] UserId not found in WhoAmI response:", data);
      throw new Error("[API] User ID not found in response");
    }
    
    console.log(`[API] Current user ID: ${data.UserId}`);
    return data.UserId;
  } catch (error) {
    console.error("[API] Error in getCurrentUserId:", error);
    throw error;
  }
};

/**
 * Fetch details for a specific opportunity with improved error handling
 * @param {string} token - Access token
 * @param {string} oppId - Opportunity ID
 * @returns {Promise<Object>} Opportunity details with activities
 */
export const fetchOpportunityDetails = async (token, oppId) => {
  if (!oppId) {
    throw new Error("[API] No opportunity ID provided");
  }
  
  try {
    console.log(`[API] Fetching opportunity details for ID: ${oppId}`);
    const baseUrl = await getDynamicsBaseUrl();
    
    // Try different query formats to handle potential issues with parentheses
    const queryFormats = [
      `opportunityid eq ${oppId}`,
      `opportunityid eq (${oppId})`,
      `opportunityid eq guid'${oppId}'`
    ];
    
    let opportunityData = null;
    let lastError = null;
    
    // Try each query format until one works
    for (const queryFormat of queryFormats) {
      try {
        const opportunityUrl = `${baseUrl}/opportunities?$select=name,opportunityid,_customerid_value,createdon,statecode,estimatedvalue,estimatedclosedate,actualclosedate&$expand=customerid_account($select=name)&$filter=${queryFormat}`;
        
        console.log(`[API] Trying opportunity query format: ${opportunityUrl}`);
        
        const opportunityResponse = await fetch(opportunityUrl, {
          headers: getDefaultHeaders(token),
        });
        
        // If we get a 401, throw immediately to trigger re-authentication
        if (opportunityResponse.status === 401) {
          throw new Error("[API] Authentication failed. Please log in again.");
        }
        
        // If the request was successful, parse the response
        if (opportunityResponse.ok) {
          opportunityData = await opportunityResponse.json();
          console.log('[API] Opportunity data received:', opportunityData);
          
          // Check if we got results
          if (opportunityData.value && opportunityData.value.length > 0) {
            break; // We found data, exit the loop
          }
        } else {
          lastError = await opportunityResponse.text();
          console.warn(`[API] Query format failed: ${queryFormat}, Error: ${opportunityResponse.status} - ${lastError}`);
        }
      } catch (formatError) {
        console.warn(`[API] Error with query format ${queryFormat}:`, formatError);
        lastError = formatError;
      }
    }
    
    // If we still don't have data after trying all formats, throw an error
    if (!opportunityData || !opportunityData.value || opportunityData.value.length === 0) {
      throw new Error(`[API] No opportunity found with ID ${oppId}. Last error: ${lastError}`);
    }
    
    const opportunity = opportunityData.value[0];
    
    // Fetch activities for this opportunity
    const activitiesUrl = `${baseUrl}/activitypointers?$filter=_regardingobjectid_value eq ${oppId}&$select=activityid,subject,activitytypecode,createdon,scheduledstart,scheduledend,actualstart,actualend&$orderby=createdon desc`;
    
    const activitiesResponse = await fetch(activitiesUrl, {
      headers: getDefaultHeaders(token),
    });
    
    let activities = [];
    
    if (activitiesResponse.ok) {
      const activitiesData = await activitiesResponse.json();
      activities = activitiesData.value || [];
      console.log(`[API] Fetched ${activities.length} activities for opportunity ${oppId}`);
    } else {
      console.warn(`[API] Could not fetch activities: ${activitiesResponse.status}`);
      // Continue without activities rather than failing completely
    }
    
    // Combine the opportunity and activities data
    return {
      ...opportunity,
      activities: activities
    };
    
  } catch (error) {
    console.error("[API] Error fetching opportunity details:", error);
    throw error;
  }
};

/**
 * Fetch list of opportunities with their activities
 * @param {string} token - Access token
 * @param {Function} setLoading - State setter for loading indicator
 * @param {Function} setError - State setter for error message
 * @param {Function} setOpportunities - State setter for opportunities list
 * @param {Function} setDebugInfo - State setter for debug information
 * @returns {Promise<void>}
 */
export const fetchOpportunitiesWithActivities = async (
  token, 
  setLoading, 
  setError, 
  setOpportunities, 
  setDebugInfo
) => {
  try {
    if (setLoading) setLoading(true);
    if (setError) setError(null);
    
    // Get base URL and current user ID
    const baseUrl = await getDynamicsBaseUrl();
    const currentUserId = await getCurrentUserId(token);
    
    console.log(`[API] Fetching opportunities for user ${currentUserId}...`);
    
    // Build URL to fetch open opportunities
    const url = `${baseUrl}/opportunities?$filter=statecode eq 0 and _ownerid_value eq ${currentUserId}&$select=name,opportunityid,_customerid_value,createdon,statecode,estimatedvalue,estimatedclosedate,actualclosedate&$expand=customerid_account($select=name)`;
    
    const response = await fetch(url, {
      headers: getDefaultHeaders(token),
    });
    
    const data = await handleApiResponse(response, "fetch opportunities list");
    const opportunities = data.value || [];
    console.log(`[API] Received ${opportunities.length} opportunities`);
    
    // For each opportunity, fetch activities
    const opportunitiesWithActivities = await Promise.all(
      opportunities.map(async (opp, index) => {
        try {
          if (!opp.opportunityid) {
            console.warn(`[API] Opportunity at index ${index} has no ID`, opp);
            return { 
              ...opp, 
              opportunities_list_index: index,
              activities: [], 
              lastActivity: null 
            };
          }
          
          // Fetch activities for this opportunity
          const activitiesUrl = `${baseUrl}/activitypointers?$filter=_regardingobjectid_value eq ${opp.opportunityid}&$select=activityid,subject,activitytypecode,scheduledstart,actualstart,createdon&$orderby=createdon desc`;
          
          const activitiesResponse = await fetch(activitiesUrl, {
            headers: getDefaultHeaders(token),
          });
          
          let activities = [];
          if (activitiesResponse.ok) {
            const activitiesData = await activitiesResponse.json();
            activities = activitiesData.value || [];
          } else if (activitiesResponse.status === 401) {
            // If authentication fails during activity fetch, propagate the error
            throw new Error("[API] Authentication failed. Please log in again.");
          }
    
          return {
            ...opp,
            opportunities_list_index: index,
            activities: activities,
            lastActivity: activities.length > 0 
              ? activities[0].createdon 
              : null
          };
        } catch (error) {
          console.error(`[API] Error processing opportunity at index ${index}:`, error);
          
          // If it's an auth error, propagate it
          if (error.message.includes("[API] Authentication failed")) {
            throw error;
          }
          
          // Otherwise return the opportunity without activities
          return {
            ...opp,
            opportunities_list_index: index,
            activities: [],
            lastActivity: null
          };
        }
      })
    );

    // Set opportunities with their activities
    if (setOpportunities) {
      setOpportunities(opportunitiesWithActivities);
    }
    
    return opportunitiesWithActivities;
  } catch (error) {
    console.error("[API] Error fetching opportunities:", error);
    
    if (setError) {
      setError(`[API] Failed to fetch opportunities: ${error.message}`);
    }
    
    if (setDebugInfo) {
      setDebugInfo({
        errorType: "[API] Opportunities List Error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    throw error;
  } finally {
    if (setLoading) setLoading(false);
  }
};

/**
 * Fetch closed opportunities for the current user
 * @param {string} token - Access token
 * @param {Function} setLoading - State setter for loading indicator
 * @param {Function} setError - State setter for error message
 * @param {Function} setClosedOpportunities - State setter for closed opportunities data
 * @returns {Promise<Array>} Array of closed opportunities
 */
export const fetchClosedOpportunities = async (
  token,
  setLoading,
  setError,
  setClosedOpportunities
) => {
  try {
    if (setLoading) setLoading(true);
    if (setError) setError(null);
    
    const baseUrl = await getDynamicsBaseUrl();
    const currentUserId = await getCurrentUserId(token);
    
    console.log(`[API] Fetching closed opportunities for user ${currentUserId}...`);
    
    const url = `${baseUrl}/opportunities?$filter=statecode ne 0 and _ownerid_value eq ${currentUserId}&$select=name,statecode,opportunityid,totalamount,actualclosedate,totaldiscountamount,exchangerate,createdon&$orderby=actualclosedate desc`;
    
    const response = await fetch(url, {
      headers: getDefaultHeaders(token),
    });
    
    const data = await handleApiResponse(response, "fetch closed opportunities");
    console.log(`[API] Received ${data.value?.length || 0} closed opportunities`);
    
    // Filter out opportunities without closing date
    const validOpportunities = (data.value || []).filter(opp => 
      opp.actualclosedate && opp.createdon
    );
    
    if (setClosedOpportunities) {
      setClosedOpportunities(validOpportunities);
    }
    
    return validOpportunities;
  } catch (error) {
    console.error("[API] Error fetching closed opportunities:", error);
    
    if (setError) {
      setError(`[API] Failed to fetch closed opportunities: ${error.message}`);
    }
    
    throw error;
  } finally {
    if (setLoading) setLoading(false);
  }
};

/**
 * Get current opportunity ID either from storage or from the active tab
 * @returns {Promise<string|null>} Opportunity ID or null if not found
 */
export const getCurrentOpportunityId = async () => {
  try {
    // First check if it's in storage
    const storedData = await chrome.storage.local.get(['currentOpportunityId']);
    
    if (storedData.currentOpportunityId) {
      console.log("[API] Found opportunity ID in storage:", storedData.currentOpportunityId);
      return storedData.currentOpportunityId;
    }
    
    // If not in storage, try to get it from the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (tabs.length > 0 && activeTab?.url && activeTab.url.includes('crm.dynamics.com')) {
      try {
        console.log("[API] Checking for opportunity ID in active tab:", activeTab.id);
        
        // Set up a timeout promise to avoid hanging if communication fails
        const messagePromise = chrome.tabs.sendMessage(activeTab.id, { type: "CHECK_OPPORTUNITY_ID" });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Message timeout after 3 seconds")), 3000)
        );
        
        // Race the message against the timeout
        const response = await Promise.race([messagePromise, timeoutPromise]);
        console.log("[API] Response from content script:", response);
        
        if (response && response.opportunityId) {
          // Store the ID so we don't have to ask again
          chrome.storage.local.set({ 
            currentOpportunityId: response.opportunityId,
            lastUpdated: Date.now() 
          });
          
          return response.opportunityId;
        }
      } catch (err) {
        console.warn("[API] Could not communicate with content script:", err);
        
        // Try to parse the URL directly as a fallback
        if (activeTab.url) {
          console.log("[API] Attempting to extract ID from URL as fallback");
          
          // Try different URL patterns
          const urlObj = new URL(activeTab.url);
          
          // Check query parameters
          const idParam = urlObj.searchParams.get('id');
          if (idParam) {
            console.log("[API] Found ID in URL parameters:", idParam);
            chrome.storage.local.set({ 
              currentOpportunityId: idParam,
              lastUpdated: Date.now(),
              source: "url_fallback"
            });
            return idParam;
          }
          
          // Check for ID in path
          const pathMatch = activeTab.url.match(/opportunit(?:y|ies)\/([a-f0-9-]+)/i);
          if (pathMatch && pathMatch[1]) {
            console.log("[API] Found ID in URL path:", pathMatch[1]);
            chrome.storage.local.set({ 
              currentOpportunityId: pathMatch[1],
              lastUpdated: Date.now(),
              source: "url_path_fallback"
            });
            return pathMatch[1];
          }
        }
      }
    }

    console.log("[API] No opportunity ID could be found");
    return null;
  } catch (err) {
    console.error("[API] Error getting opportunity ID:", err);
    return null;
  }
};