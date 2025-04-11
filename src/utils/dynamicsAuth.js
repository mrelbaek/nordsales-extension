// dynamicsAuth.js - Handles Dynamics CRM authentication

// Authentication constants
const CLIENT_ID = "f71910da-e7e2-4deb-b99f-cc00eeddb1d0";
const REDIRECT_URI = chrome.identity.getRedirectURL();

/**
 * Authenticate with Dynamics CRM
 * @returns {Promise<Object>} Authentication result
 */
export async function loginWithDynamicsCrm() {
  try {
    // Get organization ID
    const { currentOrgId, organizationId } = await chrome.storage.local.get(['currentOrgId', 'organizationId']);
    const orgId = currentOrgId || organizationId;
    
    if (!orgId) {
      throw new Error("Please navigate to your Dynamics CRM environment first.");
    }
    
    // Build auth URL
    const authUrl = getDynamicsCrmAuthUrl(orgId);
    
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        async (redirectUrl) => {
          try {
            if (chrome.runtime.lastError || !redirectUrl) {
              reject({ 
                success: false, 
                error: chrome.runtime.lastError?.message || "Authentication failed" 
              });
              return;
            }
            
            // Extract token from redirect URL
            const hashParams = new URL(redirectUrl).hash.substring(1);
            const urlParams = new URLSearchParams(hashParams);
            
            const accessToken = urlParams.get("access_token");
            const expiresIn = urlParams.get("expires_in");
            
            if (!accessToken) {
              reject({ success: false, error: "No access token received" });
              return;
            }
            
            // Format token and calculate expiration
            const expirationTime = Date.now() + (parseInt(expiresIn) * 1000);
            const formattedToken = accessToken.startsWith('Bearer ') 
              ? accessToken 
              : `Bearer ${accessToken}`;
            
            resolve({ 
              success: true, 
              token: formattedToken, 
              expirationTime,
              error: null
            });
          } catch (error) {
            reject({ success: false, error });
          }
        }
      );
    });
  } catch (error) {
    console.error("Dynamics authentication error:", error);
    return { success: false, error };
  }
}

/**
 * Get the Dynamics CRM auth URL
 * @param {string} orgId - Organization ID
 * @returns {string} Auth URL
 */
function getDynamicsCrmAuthUrl(orgId) {
  const scope = `https://${orgId}.crm.dynamics.com/.default`;
  
  const authParams = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'token',
    response_mode: 'fragment',
    redirect_uri: REDIRECT_URI,
    scope: scope,
    prompt: 'consent',
    state: Date.now().toString(),
    nonce: Math.random().toString(36).substring(2)
  });
  
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${authParams.toString()}`;
}

/**
 * Fetch user information from Dynamics CRM
 * @param {string} token - Access token
 * @returns {Promise<Object>} User information
 */
export async function fetchUserInfo(token) {
  try {
    const { currentOrgId, organizationId } = await chrome.storage.local.get(['currentOrgId', 'organizationId']);
    const orgId = currentOrgId || organizationId;
    
    if (!orgId) {
      throw new Error("Organization ID not found");
    }
    
    // Query the WhoAmI endpoint
    const url = `https://${orgId}.crm.dynamics.com/api/data/v9.2/WhoAmI`;
    const response = await fetch(url, {
      headers: {
        "Authorization": token,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Get user details
    const userDetailsUrl = `https://${orgId}.crm.dynamics.com/api/data/v9.2/systemusers(${data.UserId})`;
    const userResponse = await fetch(userDetailsUrl, {
      headers: {
        "Authorization": token,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      }
    });
    
    if (!userResponse.ok) {
      return {
        id: data.UserId,
        email: "unknown@example.com",
        name: "Unknown User",
        organizationId: orgId
      };
    }
    
    const userDetails = await userResponse.json();
    
    return {
      id: data.UserId,
      email: userDetails.internalemailaddress || userDetails.domainname || "unknown@example.com",
      name: `${userDetails.firstname || ''} ${userDetails.lastname || ''}`.trim() || "Unknown User",
      organizationId: orgId
    };
  } catch (error) {
    console.error("Error fetching user info:", error);
    
    // Return placeholder with organization ID
    const orgId = await chrome.storage.local.get(['currentOrgId', 'organizationId'])
      .then(result => result.currentOrgId || result.organizationId || "unknown");
    
    return {
      id: "unknown",
      email: "unknown@example.com",
      name: "Unknown User",
      organizationId: orgId
    };
  }
}

export const dynamicsAuth = {
  loginWithDynamicsCrm,
  fetchUserInfo
};