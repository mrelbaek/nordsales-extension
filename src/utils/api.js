import { BASE_URL } from '../constants';

/**
 * Default headers for Dynamics API requests
 * @param {string} token - Access token
 * @returns {Object} Headers object
 */
const getDefaultHeaders = (token) => ({
  "Authorization": `Bearer ${token}`,
  "Accept": "application/json",
  "OData-MaxVersion": "4.0",
  "OData-Version": "4.0",
  "Content-Type": "application/json"
});

/**
 * Fetch details for a specific opportunity
 * @param {string} token - Access token
 * @param {string} oppId - Opportunity ID
 * @returns {Promise<Object>} Opportunity details with activities
 */
export const fetchOpportunityDetails = async (token, oppId) => {
  if (!oppId) {
    throw new Error("No opportunity ID provided");
  }
  
  console.log(`Fetching opportunity details for ID: ${oppId}`);
  
  // First API call - get detailed opportunity information with customer data
  const opportunityUrl = `${BASE_URL}/opportunities?$select=name,opportunityid,_customerid_value,createdon,statecode,estimatedvalue,estimatedclosedate,actualclosedate&$expand=customerid_account($select=name)&$filter=opportunityid eq ${oppId}`;
  
  const opportunityResponse = await fetch(opportunityUrl, {
    headers: getDefaultHeaders(token),
  });
  
  if (!opportunityResponse.ok) {
    const errorText = await opportunityResponse.text();
    throw new Error(`Failed to fetch opportunity details: ${opportunityResponse.status} - ${errorText}`);
  }
  
  const opportunityData = await opportunityResponse.json();
  console.log('Opportunity data received:', opportunityData);
  
  // Check if we got results
  if (!opportunityData.value || opportunityData.value.length === 0) {
    throw new Error("No opportunity found with that ID");
  }
  
  const opportunity = opportunityData.value[0];
  
  // Second API call - get related activities for this opportunity
  const activitiesUrl = `${BASE_URL}/activitypointers?$filter=_regardingobjectid_value eq ${oppId}&$select=activityid,subject,activitytypecode,createdon,scheduledstart,scheduledend,actualstart,actualend&$orderby=createdon desc`;
  const activitiesResponse = await fetch(activitiesUrl, {
    headers: getDefaultHeaders(token),
  });
  
  // Process the activities data if the request was successful
  let activities = [];
  if (activitiesResponse.ok) {
    const activitiesData = await activitiesResponse.json();
    activities = activitiesData.value || [];
  } else {
    console.warn(`Could not fetch activities: ${activitiesResponse.status}`);
  }
  
  // Combine the opportunity and activities data
  return {
    ...opportunity,
    activities: activities
  };
};

/**
 * Fetch list of opportunities with their activities
 * @param {string} token - Access token
 * @param {string} userId - Optional user ID (if not provided, current user is used)
 * @returns {Promise<Array>} Array of opportunities with activities
 */
export const fetchOpportunitiesWithActivities = async (token, userId) => {
  // Get current user ID if not provided
  let currentUserId = userId;
  if (!currentUserId) {
    const userResponse = await fetch(`${BASE_URL}/WhoAmI`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const userData = await userResponse.json();
    currentUserId = userData.UserId;
  }

  console.log("Fetching opportunities list...");
  
  // First get opportunities
  const url = `${BASE_URL}/opportunities?$filter=statecode eq 0 and _ownerid_value eq ${currentUserId}&$select=name,opportunityid,_customerid_value,createdon,statecode,estimatedvalue,estimatedclosedate,actualclosedate&$expand=customerid_account($select=name)`;
  
  const response = await fetch(url, {
    headers: getDefaultHeaders(token),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status}`);
  }

  const data = await response.json();
  const opportunities = data.value || [];
  console.log(`Received ${opportunities.length} opportunities`);
  
  // For each opportunity, fetch ALL activities
  const opportunitiesWithActivities = await Promise.all(
    opportunities.map(async (opp) => {
      try {
        // Get activities for this opportunity (all activities, not just the most recent)
        const activitiesUrl = `${BASE_URL}/activitypointers?$filter=_regardingobjectid_value eq ${opp.opportunityid}&$select=activityid,subject,activitytypecode,createdon&$orderby=createdon desc`;
        
        const activitiesResponse = await fetch(activitiesUrl, {
          headers: getDefaultHeaders(token),
        });
        
        if (activitiesResponse.ok) {
          const activitiesData = await activitiesResponse.json();
          const activities = activitiesData.value || [];
          
          return {
            ...opp,
            activities: activities,
            lastActivity: activities.length > 0 ? activities[0].createdon : null
          };
        } else {
          console.warn(`Could not fetch activities for opportunity ${opp.opportunityid}`);
          return {
            ...opp,
            activities: [],
            lastActivity: null
          };
        }
      } catch (error) {
        console.error(`Error fetching activities for opportunity ${opp.opportunityid}:`, error);
        return {
          ...opp,
          activities: [],
          lastActivity: null
        };
      }
    })
  );
  
  return opportunitiesWithActivities;
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
      console.log("Found opportunity ID in storage:", storedData.currentOpportunityId);
      return storedData.currentOpportunityId;
    }
    
    // If not in storage, try to get it from the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("Tabs found:", tabs.length, "First tab URL:", tabs[0]?.url);
    const activeTab = tabs[0];

    if (tabs.length > 0 && tabs[0].url && tabs[0].url.includes('crm.dynamics.com')) {
      try {
        console.log("Sending message to tab ID:", tabs[0].id);
        
        // Set up a timeout promise to avoid hanging if communication fails
        const messagePromise = chrome.tabs.sendMessage(tabs[0].id, { type: "CHECK_OPPORTUNITY_ID" });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Message timeout after 3 seconds")), 3000)
        );
        
        // Race the message against the timeout
        const response = await Promise.race([messagePromise, timeoutPromise]);
        console.log("Response received:", response);
        
        if (response && response.opportunityId) {
          // Store the ID so we don't have to ask again
          chrome.storage.local.set({ 
            currentOpportunityId: response.opportunityId,
            lastUpdated: Date.now() 
          });
          
          return response.opportunityId;
        }
      } catch (err) {
        console.warn("Could not communicate with content script:", err);
        
        // Instead of just continuing with no ID, check if a URL parameter exists
        // As a fallback, try to parse the URL directly
        if (activeTab.url) {
          console.log("Attempting to extract ID from URL as fallback");
          const urlObj = new URL(activeTab.url);
          const idParam = urlObj.searchParams.get('id');
          
          if (idParam) {
            console.log("Found ID in URL parameters:", idParam);
            // Store the ID
            chrome.storage.local.set({ 
              currentOpportunityId: idParam,
              lastUpdated: Date.now(),
              source: "url_fallback"
            });
            return idParam;
          }
        }
      }
    }

    console.log("No opportunity ID could be found");
    return null;
  } catch (err) {
    console.error("Error getting opportunity ID:", err);
    return null;
  }
};