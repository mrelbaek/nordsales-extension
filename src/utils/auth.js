// Authentication constants for Dynamics CRM
const CLIENT_ID = "f71910da-e7e2-4deb-b99f-cc00eeddb1d0"; // Your registered app's client ID
const REDIRECT_URI = chrome.identity.getRedirectURL();
const COMMON_AUTHORITY = "https://login.microsoftonline.com/common"; // Use common endpoint instead of tenant-specific

const debugLog = (message, ...args) => {
  console.log(`[Auth] ${message}`, ...args);
};

// Log configuration details for debugging (without sensitive info)
debugLog("Auth configuration:", {
  clientIdPrefix: CLIENT_ID.substring(0, 8) + "...",
  redirectUri: REDIRECT_URI
});

debugLog("Exact redirect URI:", REDIRECT_URI);


/**
 * Get the dynamic scope for Dynamics CRM based on the organization ID
 * @param {string} orgId - Organization ID
 * @returns {string} Properly formatted scope
 */
const getDynamicsScope = (orgId) => {
  if (!orgId) {
    throw new Error("Organization ID is required for authentication");
  }
  
  // Include the specific permissions needed
  return `https://${orgId}.crm.dynamics.com/user_impersonation openid profile offline_access`;
};

/**
 * Build the authentication URL with all required parameters
 * @param {string} orgId - Organization ID
 * @returns {string} The full authentication URL
 */
const getAuthUrl = (orgId) => {
  if (!orgId) {
    throw new Error("[Auth][getAuthUrl] Organization ID is required for authentication");
  }
  
  const scope = (
    `https://${orgId}.crm.dynamics.com/.default` // Use .default to get all delegated permissions
  );
  
  const authParams = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'token',
    response_mode: 'fragment',
    redirect_uri: REDIRECT_URI,
    scope: scope,
    prompt: 'consent', // Force consent screen to appear
    state: Date.now().toString(),
    nonce: Math.random().toString(36).substring(2)
  });
  
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${authParams.toString()}`;
  console.log("[Auth] Complete auth URL:", authUrl);
  
  return authUrl;
};
/**
 * Test if the current token is valid by making a simple API call
 * @param {string} token - The access token to test
 * @param {string} orgId - Organization ID
 * @returns {Promise<boolean>} True if token is valid, false otherwise
 */
const testTokenValidity = async (token, orgId) => {
  try {
    if (!token || !orgId) {
      console.warn("Missing token or orgId for validation", { 
        hasToken: !!token, 
        hasOrgId: !!orgId 
      });
      return false;
    }
    
    // Make sure token has exactly one Bearer prefix
    // CRITICAL FIX: You were referencing accessToken which doesn't exist in this scope
    const formattedToken = token.startsWith('Bearer ') 
      ? token  // Use token, not accessToken
      : `Bearer ${token}`; // Use token, not accessToken
    
    // Log the formatted token for debugging
    console.log("Token header:", formattedToken.substring(0, 20) + "...");
    
    const testUrl = `https://${orgId}.crm.dynamics.com/api/data/v9.2/WhoAmI`;
    console.log("Testing token with URL:", testUrl);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        // Use the properly formatted token
        "Authorization": formattedToken,
        "Accept": "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0"
      }
    });
    
    console.log(`Token test response status: ${response.status}`);
    
    // For debugging, log the full token if validation fails
    if (response.status === 401) {
      console.warn("Token validation failed with 401 status", {
        tokenStartsWith: formattedToken.substring(0, 30),
        tokenLength: formattedToken.length,
        hasSpaceAfterBearer: formattedToken.startsWith('Bearer '),
        orgId
      });
    }
    
    if (response.ok) {
      const data = await response.json();
      console.log("Token is valid. User ID:", data.UserId);
      return true;
    }
    
    // Log the error response for debugging
    try {
      const errorText = await response.text();
      console.error("Token test error response:", errorText || "No error text");
    } catch (textError) {
      console.error("Could not extract error text:", textError);
    }
    
    return false;
  } catch (error) {
    console.error("Token test error:", error.message, error.stack);
    return false;
  }
};

/**
 * Launches the authentication process using chrome.identity API.
 * @returns {Promise<string>} The access token
 */
export async function login() {
  try {
    // Get organization ID with fallback options
    const { currentOrgId, organizationId } = await chrome.storage.local.get(['currentOrgId', 'organizationId']);
    
    // Use whichever organization ID is available
    const orgId = currentOrgId || organizationId;
    
    if (!orgId) {
      throw new Error("Please navigate to your Dynamics CRM environment first to use this extension.");
    }
    
    console.log("Using organization ID for authentication:", orgId);
    
    // Get the authentication URL
    const authUrl = getAuthUrl(orgId);
    
    return new Promise((resolve, reject) => {
      console.log("Starting authentication process");
      
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        async (redirectUrl) => {
          try {
            if (chrome.runtime.lastError || !redirectUrl) {
              console.error("Authentication failed:", chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : "Failed to authenticate"));
              return;
            }
            
            // Extract token information from URL fragment
            const hashParams = new URL(redirectUrl).hash.substring(1);
            const urlParams = new URLSearchParams(hashParams);
            
            const accessToken = urlParams.get("access_token");
            const expiresIn = urlParams.get("expires_in");
            const tokenType = urlParams.get("token_type") || "Bearer";
            
            if (!accessToken) {
              reject(new Error("No access token received"));
              return;
            }
            
            // Calculate expiration time
            const expirationTime = Date.now() + (parseInt(expiresIn) * 1000);
            
            // Format the token correctly - ALWAYS include Bearer prefix
            const formattedToken = accessToken.startsWith('Bearer ') 
              ? accessToken 
              : `Bearer ${accessToken}`;
            
            // Store token information
            await chrome.storage.local.set({ 
              accessToken: formattedToken,
              rawAccessToken: accessToken,
              expirationTime,
              tokenType
            });
            
            console.log("Token stored successfully");
            resolve(formattedToken);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  } catch (error) {
    console.error("Authentication error:", error);
    throw error;
  }
}

/**
 * Retrieves the stored access token and validates its expiration.
 * @returns {Promise<string>} Valid access token
 */
export async function getAccessToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["accessToken", "rawAccessToken", "expirationTime", "tokenType", "currentOrgId", "organizationId"], async (result) => {
      try {
        // Use either organization ID
        const orgId = result.currentOrgId || result.organizationId;
        debugLog("Using orgId in getAccessToken:", orgId);
        
        if (!orgId) {
          console.error("Organization ID not found in storage");
          reject(new Error("Organization ID not found. Please navigate to Dynamics CRM."));
          return;
        }
        
        // If we have a formatted token, use it as is
        if (result.accessToken) {
          debugLog("Using stored token with format:", result.accessToken.substring(0, 15) + "...");
          
          const isValid = await testTokenValidity(result.accessToken, orgId);
          if (isValid) {
            resolve(result.accessToken);
            return;
          } else {
            console.warn("Stored token failed API test");
          }
        }
        
        // If we have a raw token, format it and try that
        if (result.rawAccessToken && result.tokenType) {
          const formattedToken = `${result.tokenType} ${result.rawAccessToken}`;
          debugLog("Trying with formatted raw token");
          
          // Test this token too
          const isValid = await testTokenValidity(formattedToken, orgId);
          if (isValid) {
            // Save the formatted token for future use
            chrome.storage.local.set({ accessToken: formattedToken });
            resolve(formattedToken);
            return;
          } else {
            console.warn("Raw token failed API test");
          }
        }
        
        // No valid token found
        reject(new Error("Token not found or invalid"));
      } catch (error) {
        console.error("Error in getAccessToken:", error);
        reject(error);
      }
    });
  });
}

/**
 * Enhanced logout function with cleanup and notification
 * @param {Function} setAccessToken - State setter for access token
 * @param {Function} setOpportunities - State setter for opportunities list
 * @param {Function} setCurrentOpportunity - State setter for current opportunity
 * @param {Function} setActivities - State setter for activities
 * @param {Function} setError - State setter for error message
 * @param {Function} setLoading - State setter for loading state
 * @returns {Promise<Object>} Result of logout operation
 */
export const logout = async (
  setAccessToken = null,
  setOpportunities = null,
  setCurrentOpportunity = null,
  setActivities = null,
  setError = null,
  setLoading = null
) => {
  try {
    // Set loading state if available
    if (setLoading) setLoading(true);
    
    debugLog("Starting logout process...");
    
    // Clear all authentication-related data from storage
    await chrome.storage.local.remove([
      "accessToken", 
      "rawAccessToken", 
      "expirationTime", 
      "tokenType",
      "currentOpportunityId",
      "lastUpdated",
      // Don't remove organization ID as it's tied to the current page
      // "currentOrgId",
      // "organizationId"
    ]);
    
    debugLog("Authentication data cleared from storage");
    
    // Reset all state variables if provided
    if (setAccessToken) setAccessToken(null);
    if (setOpportunities) setOpportunities([]);
    if (setCurrentOpportunity) setCurrentOpportunity(null);
    if (setActivities) setActivities([]);
    
    // Clear any existing errors
    if (setError) setError(null);
    
    debugLog("Logout completed successfully");
    
    // Return success message
    return { success: true, message: "Logged out successfully" };
  } catch (error) {
    console.error("Error during logout:", error);
    
    // Set error message if setter is available
    if (setError) {
      setError(`Logout failed: ${error.message}`);
    }
    
    // Return error information
    return { 
      success: false, 
      message: "Logout encountered an error", 
      error: error.message 
    };
  } finally {
    // Ensure loading state is reset
    if (setLoading) setLoading(false);
  }
};

/**
 * Simple version of logout that only clears storage
 * @returns {Promise<void>}
 */
export const simpleLogout = async () => {
  return new Promise((resolve) => {
    chrome.storage.local.remove([
      "accessToken", 
      "rawAccessToken", 
      "expirationTime", 
      "tokenType",
      "currentOpportunityId",
      "lastUpdated"
    ], () => {
      debugLog("User logged out");
      resolve();
    });
  });
};

/**
 * Check if user is logged in
 * @returns {Promise<boolean>} True if logged in, false otherwise
 */
export const isLoggedIn = async () => {
  try {
    const { accessToken, expirationTime, currentOrgId } = await chrome.storage.local.get([
      "accessToken", 
      "expirationTime",
      "currentOrgId"
    ]);
    
    const hasToken = !!accessToken;
    const tokenNotExpired = expirationTime ? Date.now() < expirationTime : false;
    
    // If we have a non-expired token, also verify it works with the API
    if (hasToken && tokenNotExpired && currentOrgId) {
      return await testTokenValidity(accessToken, currentOrgId);
    }
    
    return false;
  } catch (error) {
    console.error("Error checking login status:", error);
    return false;
  }
};