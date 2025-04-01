/**
 * Utility functions for working with Dynamics CRM Opportunities
 */

// Constants for API URLs
const BASE_URL = "https://orga6a657bc.crm.dynamics.com/api/data/v9.2";

/**
 * Fetch current user information
 * @param {string} token - Access token for Dynamics CRM
 * @returns {Promise<string|null>} User ID if found, null otherwise 
 */
export const getCurrentUserId = async (token) => {
  try {
    const response = await fetch(`${BASE_URL}/WhoAmI`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch current user: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data.UserId || null;
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null;
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
      console.log("Found opportunity ID in storage:", storedData.currentOpportunityId);
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

              console.log("Content script response:", response);
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
  console.log(`Attempting to fetch activities for opportunity: ${opportunityId}`);
  const activitiesUrl = `${BASE_URL}/activitypointers?$filter=_regardingobjectid_value eq '${opportunityId}'&$select=activityid,subject,activitytypecode,actualstart,actualend,createdon,scheduledstart`;
  console.log("📡 FETCHING ACTIVITIES FROM:", activitiesUrl);

  try {
    const response = await fetch(activitiesUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      }
    });

    console.log(`Activities API response status: ${response.status}`);
    
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
    console.log(`Received ${data.value?.length || 0} activities`);
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
    
    console.log(`Attempting to fetch opportunity details for ID: ${oppId}`);
    
    // Try with different formats of the opportunity ID
    // Dynamics CRM can be picky about how IDs are formatted in the URL
    const formats = [
      `${BASE_URL}/opportunities(${oppId})`,
      `${BASE_URL}/opportunities(guid'${oppId}')`,
      `${BASE_URL}/opportunities?$filter=opportunityid eq ${oppId}`,
      `${BASE_URL}/opportunities?$filter=opportunityid eq guid'${oppId}'`
    ];
    
    let lastError = null;
    let successResponse = null;
    let authFailed = false;
    
    // Try each format until one works
    for (const url of formats) {
      console.log(`Trying URL format: ${url}`);
      
      try {
        const response = await fetch(url, {
          headers: { 
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
            "Content-Type": "application/json"
          },
        });
        
        console.log(`Response status for ${url}: ${response.status}`);
        
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
        console.log(`Error with format ${url}: ${err.message}`);
        lastError = {
          message: err.message,
          url: url
        };
      }
    }
    
    // Handle authentication failure
    if (authFailed) {
      throw new Error("Authentication failed. Please log in again.");
    }
    
    if (!successResponse) {
      console.error("All URL formats failed:", lastError);
      throw new Error(`Failed to fetch opportunity details: ${lastError.status || 'API Error'}`);
    }
    
    const data = await successResponse.json();
    console.log('Opportunity data received:', data);
    
    // If the response is a collection, take the first item
    if (data.value && Array.isArray(data.value) && data.value.length > 0) {
      setCurrentOpportunity(data.value[0]);
    } else {
      setCurrentOpportunity(data);
    }
    
    // Fetch activities for this opportunity
    const activityData = await fetchActivitiesForOpportunity(token, oppId);
    setActivities(activityData);
    console.log('🐛 Activities data received:', activityData);

    
  } catch (error) {
    console.error("Error fetching opportunity details:", error);
    setError(`Failed to fetch opportunity details: ${error.message}`);
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
    
    // Get current user ID first
    const currentUserId = await getCurrentUserId(token);
    
    if (!currentUserId) {
      throw new Error("Could not determine current user ID");
    }
    
    // Build the URL to fetch open opportunities for current user
    const url = `${BASE_URL}/opportunities?$filter=statecode eq 0 and _ownerid_value eq ${currentUserId}&$select=name,opportunityid,_customerid_value,createdon,statecode,estimatedvalue,estimatedclosedate,actualclosedate&$expand=customerid_account($select=name)`;
    
    console.log("Fetching opportunities list...");
    
    const response = await fetch(url, {
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      },
    });

    console.log(`Response status: ${response.status}`);
    
    if (response.status === 401) {
      console.warn("Authentication token expired or invalid");
      throw new Error("Authentication failed. Please log in again.");
    }
    
    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = JSON.stringify(errorData);
      } catch (e) {
        errorText = await response.text();
      }
      
      console.error(`API Error: ${response.status}`, errorText);
      throw new Error(`Failed to fetch data: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`Received ${data.value?.length || 0} opportunities`);
    
    // Fetch activities for each opportunity
    const opportunitiesWithActivities = await Promise.all(
      (data.value || []).map(async (opportunity, index) => {
        try {
          // Ensure opportunity object always has an activities array
          const opportunityId = opportunity.opportunityid;
          if (!opportunityId) {
            console.warn(`Skipping opportunity at index ${index} without ID`, opportunity);
            return { 
              ...opportunity, 
              opportunities_list_index: index, // Use a more explicit name
              activities: [], 
              lastActivity: null 
            };
          }
          
          // Fetch activities for this opportunity
          // NOTE: Fixed reference to activities by capturing the result of the API call
          const activitiesUrl = `${BASE_URL}/activitypointers?$filter=_regardingobjectid_value eq ${opportunityId}&$select=activityid,subject,activitytypecode,scheduledstart,actualstart,createdon&$orderby=createdon desc`;
          
          const activitiesResponse = await fetch(activitiesUrl, {
            headers: { 
              "Authorization": `Bearer ${token}`,
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
          console.error(`Error processing opportunity at index ${index}:`, error);
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
    console.error("Error fetching opportunities:", error);
    setError(`Failed to fetch opportunities list: ${error.message}`);
    if (setDebugInfo) {
      setDebugInfo({
        errorType: "Opportunities List Error",
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
    
    // First get the current user ID
    const currentUserId = await getCurrentUserId(token);
    
    if (!currentUserId) {
      throw new Error("Could not determine current user ID");
    }
    
    console.log("Fetching opportunities for user ID:", currentUserId);
    
    // Build the URL to fetch open opportunities for current user
    const url = `${BASE_URL}/opportunities?$filter=statecode eq 0 and _ownerid_value eq ${currentUserId}&$select=name,opportunityid,_customerid_value,createdon,statecode,estimatedvalue,estimatedclosedate,actualclosedate&$expand=customerid_account($select=name)`;
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      }
    });
    
    if (response.status === 401) {
      console.warn("Authentication token expired or invalid");
      throw new Error("Authentication failed. Please log in again.");
    }
    
    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = JSON.stringify(errorData);
      } catch (e) {
        errorText = await response.text();
      }
      
      console.error(`API Error: ${response.status}`, errorText);
      throw new Error(`Failed to fetch opportunities: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`Received ${data.value?.length || 0} open opportunities`);
    
    // Set opportunities in state
    setOpportunities(data.value || []);
  } catch (error) {
    console.error("Error fetching opportunities:", error);
    setError(`Failed to fetch opportunities list: ${error.message}`);
  } finally {
    setLoading(false);
  }
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
    
    // Get current user ID first
    const currentUserId = await getCurrentUserId(token);
    
    if (!currentUserId) {
      throw new Error("Could not determine current user ID");
    }
    
    // Build the URL to fetch closed opportunities for current user
    const url = `${BASE_URL}/opportunities?$filter=statecode ne 0 and _ownerid_value eq ${currentUserId}&$select=name,statecode,opportunityid,totalamount,actualclosedate,totaldiscountamount,exchangerate,createdon&$orderby=actualclosedate desc`;
    
    console.log("Fetching closed opportunities...");
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      },
    });
    
    if (response.status === 401) {
      console.warn("Authentication token expired or invalid");
      throw new Error("Authentication failed. Please log in again.");
    }
    
    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = JSON.stringify(errorData);
      } catch (e) {
        errorText = await response.text();
      }
      
      console.error(`API Error: ${response.status}`, errorText);
      throw new Error(`Failed to fetch closed opportunities: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`Received ${data.value?.length || 0} closed opportunities`);
    
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
    console.error("Error fetching closed opportunities:", error);
    if (setError) setError(`Failed to fetch closed opportunities: ${error.message}`);
    return [];
  } finally {
    if (setLoading) setLoading(false);
  }
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
 * Generate a URL to view the opportunity in Dynamics CRM
 * @param {string} opportunityId - ID of the opportunity
 * @returns {string} URL to view the opportunity
 */
export const getOpportunityUrl = (opportunityId) => {
  if (!opportunityId) return '';
  return `https://orga6a657bc.crm.dynamics.com/main.aspx?appid=e82f31a2-d4e4-ef11-9341-6045bd0438e7&pagetype=entityrecord&etn=opportunity&id=${opportunityId}`;
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