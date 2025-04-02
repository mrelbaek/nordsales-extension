/**
 * Utility functions for working with Dynamics CRM Opportunities
 */

// Dynamic BASE_URL - will be set after determining organization ID
let BASE_URL = null;


// Token debug helper
const debugToken = (token) => {
  if (!token) return "Token is null or undefined";
  
  const hasBearer = token.startsWith('Bearer ');
  const tokenLength = token.length;
  const tokenStart = token.substring(0, Math.min(30, tokenLength));
  
  return {
    format: hasBearer ? "Has 'Bearer' prefix" : "Missing 'Bearer' prefix",
    length: tokenLength,
    preview: tokenStart + "...",
    isJWT: token.includes('.') && token.split('.').length === 3
  };
};


/**
 * Extract organization ID from Dynamics CRM URL
 * @param {string} url - Dynamics CRM URL
 * @returns {string|null} Organization ID or null if not found
 */
export const extractOrgIdFromUrl = (url) => {
  if (!url) return null;
  
  // Pattern for org ID in CRM URLs (e.g., https://orgXXXXXXX.crm.dynamics.com)
  const orgPattern = /https:\/\/([^.]+)\.crm\.dynamics\.com/;
  const matches = url.match(orgPattern);
  
  if (matches && matches[1]) {
    return matches[1];
  }
  console.warn("Could not extract organization ID from URL:", url);
  return null;
};



/**
 * Get the current organization ID from storage or active tab
 * @returns {Promise<string|null>} Organization ID or null if not found
 */
export const getCurrentOrgId = async () => {
  try {
    // First check storage for any existing org ID
    const { currentOrgId, organizationId } = await chrome.storage.local.get(['currentOrgId', 'organizationId']);
    
    // Use whichever is available
    if (currentOrgId || organizationId) {
      const usedOrgId = currentOrgId || organizationId;
      console.log("[OppUtil] Found organization ID in storage:", usedOrgId);
      return usedOrgId;
    }
    
    // If not in storage, try to get it from the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    
    if (activeTab?.url && activeTab.url.includes('crm.dynamics.com')) {
      try {
        const response = await new Promise((resolve, reject) => {
          try {
            chrome.tabs.sendMessage(
              activeTab.id, 
              { type: "GET_ORGANIZATION_ID" },
              (response) => {
                // Use runtime.lastError to check for errors
                if (chrome.runtime.lastError) {
                  console.warn("Error sending message:", chrome.runtime.lastError);
                  reject(chrome.runtime.lastError);
                  return;
                }
                
                resolve(response);
              }
            );
          } catch (err) {
            reject(err);
          }
        });
        
        if (response?.organizationId) {
          // Store for later use
          chrome.storage.local.set({ 
            currentOrgId: response.organizationId,
            organizationId: response.organizationId,
            lastOrgIdUpdated: Date.now() 
          });
          
          return response.organizationId;
        }
      } catch (error) {
        console.warn("Could not communicate with content script:", error);
        
        // Try to extract from URL directly as fallback
        if (activeTab.url) {
          const match = activeTab.url.match(/https:\/\/([^.]+)\.crm\.dynamics\.com/i);
          if (match && match[1]) {
            const extractedOrgId = match[1];
            
            // Store the ID
            chrome.storage.local.set({ 
              currentOrgId: extractedOrgId,
              organizationId: extractedOrgId,
              lastOrgIdUpdated: Date.now()
            });
            
            return extractedOrgId;
          }
        }
      }
    }
    
    return null;
  } catch (err) {
    console.error("Error getting organization ID:", err);
    return null;
  }
};

/**
 * Get the base URL for Dynamics CRM API calls
 * @returns {Promise<string|null>} Base URL for API calls or null if org ID not found
 */
export const getDynamicsBaseUrl = async () => {
  // Return cached value if available
  if (BASE_URL) return BASE_URL;
  
  const orgId = await getCurrentOrgId();
  
  if (!orgId) {
    console.error("Cannot create base URL: No organization ID available");
    return null;
  }
  
  BASE_URL = `https://${orgId}.crm.dynamics.com/api/data/v9.2`;
  return BASE_URL;
};


/**
 * Fetch current user information with customized response handling
 * @param {string} token - Access token for Dynamics CRM
 * @returns {Promise<string|null>} User ID if found, null otherwise 
 */


export const getCurrentUserId = async (token) => {
  try {
    
    const baseUrl = await getDynamicsBaseUrl();
    
    if (!baseUrl) {
      console.error("[OppUtil][getCurrentUserId] Cannot determine API base URL - organization ID not found");
      return null;
    }

    // Ensure token has the right format (contains 'Bearer' only once)
    let formattedToken = token;
    if (!token.startsWith('Bearer ')) {
      formattedToken = `Bearer ${token}`;
    }

    console.log(`[OppUtil][getCurrentUserId] Fetching current user with WhoAmI endpoint: ${baseUrl}/WhoAmI`);
    console.log(`[OppUtil][getCurrentUserId] Using token format: ${formattedToken.substring(0, 20)}...`);
    console.log("[OppUtil][getCurrentUserId] Token debug info:", debugToken(token));

    const response = await fetch(`${baseUrl}/WhoAmI`, {
      method: 'GET',
      headers: {
        "Authorization": `${token}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "Content-Type": "application/json"
      }
    });
    
    // Log full response status for debugging
    console.log(`[OppUtil][getCurrentUserId] WhoAmI URL used: ${baseUrl}/WhoAmI`);
    console.log(`[OppUtil][getCurrentUserId] WhoAmI response status: ${response.status} token: ${token}`);
    console.log("[OppUtil][getCurrentUserId] Token at WhoAmI call:", token?.substring(0, 30));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OppUtil][getCurrentUserId] Failed to fetch current user: ${response.status} - ${errorText}`);
      
      // If authentication failed, throw a specific error
      if (response.status === 401) {
        throw new Error("[OppUtil][getCurrentUserId] Authentication failed. Please log in again.");
      }
      
      return null;
    }
    
    const data = await response.json();
    
    // Log the full response for debugging
    console.log("[OppUtil][getCurrentUserId] WhoAmI response data:", JSON.stringify(data, null, 2));
    
    // Check for UserId in WhoAmIResponse format
    if (data.UserId) {
      console.log(`[OppUtil][getCurrentUserId] Found UserId: ${data.UserId}`);
      return data.UserId;
    }
    
    // Some Dynamics environments might wrap the response
    if (data.value && data.value.UserId) {
      console.log(`[OppUtil][getCurrentUserId] Found UserId in value property: ${data.value.UserId}`);
      return data.value.UserId;
    }
    
    // Try other common property names
    const possibleUserIdProperties = ['userId', 'userid', 'user_id', 'id'];
    for (const prop of possibleUserIdProperties) {
      if (data[prop]) {
        console.log(`[OppUtil][getCurrentUserId] Found user ID in property ${prop}: ${data[prop]}`);
        return data[prop];
      }
    }
    
    // If no user ID found, log the complete response and throw error
    console.error(`[OppUtil][getCurrentUserId] No user ID found in response: ${JSON.stringify(data)}`);
    throw new Error(`[OppUtil][getCurrentUserId] User ID not found in response. Please check the Dynamics CRM configuration.`);
  } catch (error) {
    console.error("[OppUtil][getCurrentUserId] Error fetching current user:", error);
    throw new Error(`[OppUtil][getCurrentUserId] Error fetching current user: ${error.message}`);
  }
};

/**
 * Get current opportunity ID either from storage or from the active tab
 * @returns {Promise<string|null>} The opportunity ID if found, null otherwise
 */
export const getCurrentOpportunityId = async () => {
  try {
    // First check storage
    const storedData = await chrome.storage.local.get(['currentOpportunityId']);
    
    if (storedData.currentOpportunityId) {
      console.log("[OppUtil] Found opportunity ID in storage:", storedData.currentOpportunityId);
      return storedData.currentOpportunityId;
    }
    
    // If not in storage, try to get from active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    
    if (activeTab?.url && activeTab.url.includes('crm.dynamics.com')) {
      return new Promise((resolve, reject) => {
        try {
          chrome.tabs.sendMessage(
            activeTab.id, 
            { type: "CHECK_OPPORTUNITY_ID" },
            (response) => {
              // Use runtime.lastError to check for errors
              if (chrome.runtime.lastError) {
                console.warn("Error sending message:", chrome.runtime.lastError);
                resolve(null);
                return;
              }

              console.log("[OppUtil] Content script response:", response);
              resolve(response?.opportunityId || null);
            }
          );
        } catch (err) {
          console.error("Message sending error:", err);
          resolve(null);
        }
      });
    }
    
    return null;
  } catch (err) {
    console.error("Error getting opportunity ID:", err);
    return null;
  }
};

/**
 * Fetch activities related to an opportunity
 * @param {string} token - Access token for Dynamics CRM
 * @param {string} opportunityId - ID of the opportunity
 * @returns {Promise<Array>} Array of activity objects
 */
export const fetchActivitiesForOpportunity = async (token, opportunityId) => {
  console.log(`[OppUtil] Attempting to fetch activities for opportunity: ${opportunityId}`);
  
  const baseUrl = await getDynamicsBaseUrl();
  if (!baseUrl) {
    console.error("Cannot fetch activities: Organization ID not found");
    return [];
  }
  
  const activitiesUrl = `${baseUrl}/activitypointers?$filter=_regardingobjectid_value eq '${opportunityId}'&$select=activityid,subject,activitytypecode,actualstart,actualend,createdon,scheduledstart`;
  console.log("[OppUtil] FETCHING ACTIVITIES FROM:", activitiesUrl);

  try {
    const response = await fetch(activitiesUrl, {
      headers: {
        "Authorization": `${token}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      }
    });

    console.log(`[OppUtil] Activities API response status: ${response.status}`);
    
    // Handle authentication error
    if (response.status === 401) {
      console.warn("Authentication token expired or invalid when fetching activities");
      return [];
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch activities: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[OppUtil] Received ${data.value?.length || 0} activities`);
    return data.value || [];
  } catch (error) {
    console.error("Error fetching activities:", error);
    return [];
  }
};

/**
 * Fetch details for a specific opportunity
 * @param {string} token - Access token for Dynamics CRM
 * @param {string} oppId - ID of the opportunity
 * @param {Function} setLoading - State setter for loading indicator
 * @param {Function} setError - State setter for error message
 * @param {Function} setCurrentOpportunity - State setter for opportunity details
 * @param {Function} setActivities - State setter for activities list
 * @returns {Promise<void>}
 */
export const fetchOpportunityDetails = async (
  token, 
  oppId, 
  setLoading, 
  setError, 
  setCurrentOpportunity, 
  setActivities
) => {
  if (!oppId) return;
  
  try {
    setLoading(true);
    setError(null);
    
    console.log(`[OppUtil][fetchOpportunityDetails] Attempting to fetch opportunity details for ID: ${oppId}`);
    
    // Get base URL
    const baseUrl = await getDynamicsBaseUrl();
    if (!baseUrl) {
      throw new Error("Cannot fetch opportunity details: Organization ID not found. Please navigate to Dynamics CRM first.");
    }
    
    // Try with different formats of the opportunity ID
    // Dynamics CRM can be picky about how IDs are formatted in the URL
    const formats = [
      `${baseUrl}/opportunities(${oppId})`, // Make sure parenthesis is properly closed
      `${baseUrl}/opportunities(guid'${oppId}')`, // Make sure both parenthesis and quote are closed
      `${baseUrl}/opportunities?$filter=opportunityid eq ${oppId}`,
      `${baseUrl}/opportunities?$filter=opportunityid eq guid'${oppId}'`
    ];
    
    let lastError = null;
    let successResponse = null;
    let authFailed = false;
    
    // Try each format until one works
    for (const url of formats) {
      console.log(`[OppUtil][fetchOpportunityDetails] Trying URL format: ${url}`);
      
      try {
        const response = await fetch(url, {
          headers: { 
            "Authorization": `${token}`,
            "Accept": "application/json",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
            "Content-Type": "application/json"
          },
        });
        
        console.log(`[OppUtil][fetchOpportunityDetails] Response status for ${url}: ${response.status}`);
        
        // Check for authentication error
        if (response.status === 401) {
          authFailed = true;
          lastError = {
            status: 401,
            url: url,
            text: "Authentication failed"
          };
          // Don't try other formats if auth failed
          break;
        }
        
        if (response.ok) {
          successResponse = response;
          break;
        }
        
        lastError = {
          status: response.status,
          url: url,
          text: await response.text()
        };
      } catch (err) {
        console.log(`[OppUtil][fetchOpportunityDetails] Error with format ${url}: ${err.message}`);
        lastError = {
          message: err.message,
          url: url
        };
      }
    }
    
    // Handle authentication failure
    if (authFailed) {
      throw new Error("[OppUtil][fetchOpportunityDetails] Authentication failed. Please log in again.");
    }
    
    if (!successResponse) {
      console.error("[OppUtil][fetchOpportunityDetails] All URL formats failed:", lastError);
      throw new Error(`[OppUtil][fetchOpportunityDetails] Failed to fetch opportunity details: ${lastError.status || 'API Error'}`);
    }
    
    const data = await successResponse.json();
    console.log('[OppUtil][fetchOpportunityDetails] Opportunity data received:', data);
    
    // If the response is a collection, take the first item
    if (data.value && Array.isArray(data.value) && data.value.length > 0) {
      setCurrentOpportunity(data.value[0]);
    } else {
      setCurrentOpportunity(data);
    }
    
    // Fetch activities for this opportunity
    const activityData = await fetchActivitiesForOpportunity(token, oppId);
    setActivities(activityData);
    console.log('[OppUtil][fetchOpportunityDetails] Activities data received:', activityData);

    
  } catch (error) {
    console.error("[OppUtil][fetchOpportunityDetails] Error fetching opportunity details:", error);
    setError(`[OppUtil][fetchOpportunityDetails] Failed to fetch opportunity details: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

/**
 * Fetch list of opportunities
 * @param {string} token - Access token for Dynamics CRM
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
    setLoading(true);
    setError(null);
    
    // Get base URL
    const baseUrl = await getDynamicsBaseUrl();
    if (!baseUrl) {
      throw new Error("[OppUtil][fetchOpportunitiesWithActivities] Cannot fetch opportunities: Organization ID not found. Please navigate to Dynamics CRM first.");
    }
    
    // Get current user ID first
    const currentUserId = await getCurrentUserId(token);
    
    if (!currentUserId) {
      throw new Error("[OppUtil][fetchOpportunitiesWithActivities] Could not determine current user ID");
    }
    
    // Build the URL to fetch open opportunities for current user
    const url = `${baseUrl}/opportunities?$filter=statecode eq 0 and _ownerid_value eq ${currentUserId}&$select=name,opportunityid,_customerid_value,createdon,statecode,estimatedvalue,estimatedclosedate,actualclosedate&$expand=customerid_account($select=name)`;
    
    console.log(`✅ [OppUtil][fetchOpportunitiesWithActivities] Fetching opportunities list from ${url}`);
    
    const response = await fetch(url, {
      headers: { 
        "Authorization": `${token}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      },
    });

    console.log(`[OppUtil][fetchOpportunitiesWithActivities] Response status: ${response.status}`);
    console.log(`[OppUtil][fetchOpportunitiesWithActivities] Token used: ${token}`);
    
    if (response.status === 401) {
      console.warn("[OppUtil][fetchOpportunitiesWithActivities] Status 401: Authentication token expired or invalid.");
      throw new Error("[OppUtil][fetchOpportunitiesWithActivities] Status 401: Authentication failed. Please log in again.");
    }
    
    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = JSON.stringify(errorData);
      } catch (e) {
        errorText = await response.text();
      }
      
      console.error(`[OppUtil][fetchOpportunitiesWithActivities] API Error: ${response.status}`, errorText);
      throw new Error(`[OppUtil][fetchOpportunitiesWithActivities] Failed to fetch data: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[OppUtil][fetchOpportunitiesWithActivities] Received ${data.value?.length || 0} opportunities`);
    
    // Fetch activities for each opportunity
    const opportunitiesWithActivities = await Promise.all(
      (data.value || []).map(async (opportunity, index) => {
        try {
          // Ensure opportunity object always has an activities array
          const opportunityId = opportunity.opportunityid;
          if (!opportunityId) {
            console.warn(`[OppUtil][fetchOpportunitiesWithActivities] Skipping opportunity at index ${index} without ID`, opportunity);
            return { 
              ...opportunity, 
              opportunities_list_index: index, // Use a more explicit name
              activities: [], 
              lastActivity: null 
            };
          }
          
          // Fetch activities for this opportunity
          const baseUrl = await getDynamicsBaseUrl();
          const activitiesUrl = `${baseUrl}/activitypointers?$filter=_regardingobjectid_value eq ${opportunityId}&$select=activityid,subject,activitytypecode,scheduledstart,actualstart,createdon&$orderby=createdon desc`;
          
          const activitiesResponse = await fetch(activitiesUrl, {
            headers: { 
              "Authorization": `${token}`,
              "Accept": "application/json",
              "OData-MaxVersion": "4.0",
              "OData-Version": "4.0"
            },
          });
          
          let activities = [];
          if (activitiesResponse.ok) {
            const activitiesData = await activitiesResponse.json();
            activities = activitiesData.value || [];
          }
    
          return {
            ...opportunity,
            opportunities_list_index: index,
            activities: activities,
            lastActivity: activities.length > 0 
              ? activities[0].createdon 
              : null
          };
        } catch (error) {
          console.error(`[OppUtil][fetchOpportunitiesWithActivities] Error processing opportunity at index ${index}:`, error);
          return {
            ...opportunity,
            opportunities_list_index: index,
            activities: [],
            lastActivity: null
          };
        }
      })
    );

    // Set opportunities with their activities
    setOpportunities(opportunitiesWithActivities);

  } catch (error) {
    console.error("[OppUtil][fetchOpportunitiesWithActivities] Error fetching opportunities:", error);
    setError(`[OppUtil][fetchOpportunitiesWithActivities] Failed to fetch opportunities list: ${error.message}`);
    if (setDebugInfo) {
      setDebugInfo({
        errorType: "[OppUtil][fetchOpportunitiesWithActivities] Opportunities List Error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  } finally {
    setLoading(false);
  }
};

/**
 * Fetch all open opportunities owned by the current user
 * @param {string} token - Access token for Dynamics CRM
 * @param {Function} setLoading - State setter for loading indicator
 * @param {Function} setError - State setter for error message
 * @param {Function} setOpportunities - State setter for opportunities list
 * @returns {Promise<void>}
 */
export const fetchMyOpenOpportunities = async (
  token,
  setLoading,
  setError,
  setOpportunities
) => {
  try {
    setLoading(true);
    setError(null);
    
    // Get base URL
    const baseUrl = await getDynamicsBaseUrl();
    if (!baseUrl) {
      throw new Error("[OppUtil][fetchMyOpenOpportunities] Cannot fetch opportunities: Organization ID not found. Please navigate to Dynamics CRM first.");
    }
    
    // First get the current user ID
    const currentUserId = await getCurrentUserId(token);
    
    if (!currentUserId) {
      throw new Error("[OppUtil][fetchMyOpenOpportunities] Could not determine current user ID");
    }
    
    console.log("[OppUtil][fetchMyOpenOpportunities] Fetching opportunities for user ID:", currentUserId);
    
    // Build the URL to fetch open opportunities for current user
    const url = `${baseUrl}/opportunities?$filter=statecode eq 0 and _ownerid_value eq ${currentUserId}&$select=name,opportunityid,_customerid_value,createdon,statecode,estimatedvalue,estimatedclosedate,actualclosedate&$expand=customerid_account($select=name)`;
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `${token}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      }
    });
    
    if (response.status === 401) {
      console.warn("[OppUtil][fetchMyOpenOpportunities] Authentication token expired or invalid");
      throw new Error("[OppUtil][fetchMyOpenOpportunities] Authentication failed. Please log in again.");
    }
    
    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = JSON.stringify(errorData);
      } catch (e) {
        errorText = await response.text();
      }
      
      console.error(`[OppUtil][fetchMyOpenOpportunities] API Error: ${response.status}`, errorText);
      throw new Error(`[OppUtil][fetchMyOpenOpportunities] Failed to fetch opportunities: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[OppUtil] Received ${data.value?.length || 0} open opportunities`);
    
    // Set opportunities in state
    setOpportunities(data.value || []);
  } catch (error) {
    console.error("[OppUtil][fetchMyOpenOpportunities] Error fetching opportunities:", error);
    setError(`[OppUtil][fetchMyOpenOpportunities] Failed to fetch opportunities list: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

/**
 * Fetch closed opportunities for the current user
 * @param {string} token - Access token for Dynamics CRM
 * @param {Function} setLoading - State setter for loading indicator
 * @param {Function} setError - State setter for error message
 * @param {Function} setClosedOpportunities - State setter for closed opportunities data
 * @returns {Promise<void>}
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
    
    // Get base URL
    const baseUrl = await getDynamicsBaseUrl();

    if (!baseUrl) {
      throw new Error("[OppUtil][fetchClosedOpportunities] Cannot fetch closed opportunities: Organization ID not found. Please navigate to Dynamics CRM first.");
    }
    
    // Get current user ID first
    const currentUserId = await getCurrentUserId(token);
    
    if (!currentUserId) {
      throw new Error("[OppUtil][fetchClosedOpportunities] Could not determine current user ID");
    }
    
    // Build the URL to fetch closed opportunities for current user
    const url = `${baseUrl}/opportunities?$filter=statecode ne 0 and _ownerid_value eq ${currentUserId}&$select=name,statecode,opportunityid,totalamount,actualclosedate,totaldiscountamount,exchangerate,createdon&$orderby=actualclosedate desc`;
    
    console.log("[OppUtil][fetchClosedOpportunities] Fetching closed opportunities...");
    console.log("[OppUtil][fetchClosedOpportunities] closed opportunity URL:", url);
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `${token}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      },
    });
    
    if (response.status === 401) {
      console.warn("[OppUtil][fetchClosedOpportunities] Authentication token expired or invalid");
      throw new Error("[OppUtil][fetchClosedOpportunities] Authentication failed. Please log in again.");
    }
    
    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = JSON.stringify(errorData);
      } catch (e) {
        errorText = await response.text();
      }
      
      console.error(`[OppUtil][fetchClosedOpportunities] API Error: ${response.status}`, errorText);
      throw new Error(`[OppUtil][fetchClosedOpportunities] Failed to fetch closed opportunities: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[OppUtil][fetchClosedOpportunities] Received ${data.value?.length || 0} closed opportunities`);
    
    // Filter out opportunities without closing date
    const validOpportunities = (data.value || []).filter(opp => 
      opp.actualclosedate && opp.createdon
    );
    
    // Set opportunities in state
    if (setClosedOpportunities) {
      setClosedOpportunities(validOpportunities);
    }
    
    return validOpportunities;
  } catch (error) {
    console.error("[OppUtil][fetchClosedOpportunities] Error fetching closed opportunities:", error);
    if (setError) setError(`[OppUtil][fetchClosedOpportunities] Failed to fetch closed opportunities: ${error.message}`);
    return [];
  } finally {
    if (setLoading) setLoading(false);
  }
};

/**
 * Generate a URL to view the opportunity in Dynamics CRM
 * @param {string} opportunityId - ID of the opportunity
 * @returns {Promise<string>} URL to view the opportunity
 */
export const getOpportunityUrl = async (opportunityId) => {
  if (!opportunityId) return '';
  
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    console.error("[OppUtil][fetchClosedOpportunities] Cannot generate opportunity URL: Organization ID not found");
    return '';
  }
  
  return `https://${orgId}.crm.dynamics.com/main.aspx?appid=e82f31a2-d4e4-ef11-9341-6045bd0438e7&pagetype=entityrecord&etn=opportunity&id=${opportunityId}`;
};

/**
 * Format opportunity data for display
 * @param {Object} opportunity - Raw opportunity data from API
 * @returns {Object} Formatted opportunity data
 */
export const formatOpportunityData = (opportunity) => {
  if (!opportunity) return null;
  
  return {
    id: opportunity.opportunityid,
    name: opportunity.name || 'Unnamed Opportunity',
    customer: opportunity.customerid_account?.name || 'No Customer',
    estimatedValue: opportunity.estimatedvalue || 0,
    status: getStatusLabel(opportunity.statecode),
    createdOn: new Date(opportunity.createdon).toLocaleDateString(),
    estimatedCloseDate: opportunity.estimatedclosedate 
      ? new Date(opportunity.estimatedclosedate).toLocaleDateString() 
      : 'Not set',
    actualCloseDate: opportunity.actualclosedate 
      ? new Date(opportunity.actualclosedate).toLocaleDateString() 
      : null,
  };
};

/**
 * Convert status code to user-friendly label
 * @param {number} statusCode - Dynamics CRM status code
 * @returns {string} User-friendly status label
 */
const getStatusLabel = (statusCode) => {
  switch (statusCode) {
    case 0: return 'Open';
    case 1: return 'Won';
    case 2: return 'Lost';
    default: return `Status ${statusCode}`;
  }
};

/**
 * Calculate statistics about an opportunity's activities
 * @param {Array} activities - Array of activity objects
 * @returns {Object} Statistics about the activities
 */
export const calculateActivityStats = (activities) => {
  if (!activities || activities.length === 0) {
    return {
      total: 0,
      byType: {},
      mostRecent: null,
      oldest: null
    };
  }
  
  const stats = {
    total: activities.length,
    byType: {},
    mostRecent: null,
    oldest: null
  };
  
  // Sort activities by date
  const sortedActivities = [...activities].sort((a, b) => {
    return new Date(b.createdon) - new Date(a.createdon);
  });
  
  // Calculate stats
  activities.forEach(activity => {
    if (!activity.activitytypecode) return;
    
    const type = activity.activitytypecode.toLowerCase();
    
    if (!stats.byType[type]) {
      stats.byType[type] = 0;
    }
    
    stats.byType[type]++;
  });
  
  // Get most recent and oldest activities
  stats.mostRecent = sortedActivities[0];
  stats.oldest = sortedActivities[sortedActivities.length - 1];
  
  return stats;
};