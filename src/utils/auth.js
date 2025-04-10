import { supabase } from './supabase';

// Dynamics CRM Authentication Constants
const CLIENT_ID = "f71910da-e7e2-4deb-b99f-cc00eeddb1d0";
const REDIRECT_URI = chrome.identity.getRedirectURL();
const COMMON_AUTHORITY = "https://login.microsoftonline.com/common";

/**
 * Log helper function
 */
const debugLog = (message, ...args) => {
  console.log(`[Auth] ${message}`, ...args);
};

debugLog("Auth configuration:", {
  clientIdPrefix: CLIENT_ID.substring(0, 8) + "...",
  redirectUri: REDIRECT_URI
});

/**
 * Register a new user in Supabase
 * @param {Object} userData - User registration details
 * @returns {Promise<Object>} Registration result
 */
export async function registerUser(userData) {
  try {
    // Extract organization from email domain
    const domain = userData.email.split('@')[1];

    // Supabase sign up
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          name: userData.name,
          domain: domain
        }
      }
    });

    if (error) throw error;

    // If user creation is successful, add additional details to users table
    if (data.user) {
      const { error: insertError } = await supabase
        .from('users')
        .upsert({
          id: data.user.id,
          email: userData.email,
          name: userData.name,
          organization_id: `org${Date.now()}`, // Generate org ID
          extension_version: '1.0.0',
          first_login: new Date(),
          last_login: new Date(),
          login_count: 1,
          subscription_status: 'free'
        }, { 
          onConflict: 'id' 
        });

      if (insertError) {
        console.error('Error inserting user details:', insertError);
      }
    }

    return { success: true, data, error: null };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, data: null, error };
  }
}

/**
 * Login user with Supabase
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Login result
 */
export async function loginUserWithSupabase(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Update login statistics
    if (data.user) {
      await supabase
        .from('users')
        .update({
          last_login: new Date(),
          login_count: supabase.sql`login_count + 1`
        })
        .eq('id', data.user.id);
    }

    return { success: true, data, error: null };
  } catch (error) {
    console.error('Supabase login error:', error);
    return { success: false, data: null, error };
  }
}

/**
 * Get the Dynamics CRM auth URL with appropriate parameters
 * @param {string} orgId - Organization ID
 * @returns {string} Auth URL
 */
export function getDynamicsCrmAuthUrl(orgId) {
  if (!orgId) {
    throw new Error("Organization ID is required for authentication");
  }
  
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
 * Authenticate with Dynamics CRM using chrome.identity
 * @returns {Promise<Object>} Authentication result with token
 */
export async function loginWithDynamicsCrm() {
  try {
    // Get organization ID with fallback options
    const { currentOrgId, organizationId } = await chrome.storage.local.get(['currentOrgId', 'organizationId']);
    
    // Use whichever organization ID is available
    const orgId = currentOrgId || organizationId;
    
    if (!orgId) {
      throw new Error("Please navigate to your Dynamics CRM environment first to use this extension.");
    }
    
    debugLog("Using organization ID for authentication:", orgId);
    
    // Get the authentication URL
    const authUrl = getDynamicsCrmAuthUrl(orgId);
    
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        async (redirectUrl) => {
          try {
            if (chrome.runtime.lastError || !redirectUrl) {
              console.error("Authentication failed:", chrome.runtime.lastError);
              reject({ 
                success: false, 
                token: null, 
                error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Failed to authenticate" 
              });
              return;
            }
            
            // Extract token information from URL fragment
            const hashParams = new URL(redirectUrl).hash.substring(1);
            const urlParams = new URLSearchParams(hashParams);
            
            const accessToken = urlParams.get("access_token");
            const expiresIn = urlParams.get("expires_in");
            const tokenType = urlParams.get("token_type") || "Bearer";
            
            if (!accessToken) {
              reject({ 
                success: false, 
                token: null, 
                error: "No access token received" 
              });
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
            
            debugLog("Token stored successfully");
            resolve({ 
              success: true, 
              token: formattedToken, 
              expirationTime,
              error: null
            });
          } catch (error) {
            reject({ 
              success: false, 
              token: null, 
              error 
            });
          }
        }
      );
    });
  } catch (error) {
    console.error("Authentication error:", error);
    return { success: false, token: null, error };
  }
}

/**
 * Main login function that integrates both authentication systems
 * @returns {Promise<Object>} Authentication result
 */
export async function login() {
  try {
    // First, authenticate with Dynamics CRM
    const crmAuthResult = await loginWithDynamicsCrm();
    
    if (!crmAuthResult.success) {
      throw new Error(crmAuthResult.error || "Failed to authenticate with Dynamics CRM");
    }
    
    // After successful CRM auth, get the user info from Dynamics
    let userInfo;
    try {
      userInfo = await fetchUserInfoFromCrm(crmAuthResult.token);
    } catch (userInfoError) {
      console.error("Error fetching user info, continuing with limited data:", userInfoError);
      // Create minimal user info to continue
      userInfo = {
        id: "unknown",
        email: "unknown@example.com",
        name: "Unknown User",
        organizationId: await chrome.storage.local.get(['organizationId'])
          .then(result => result.organizationId || "unknown")
      };
    }
    
    // Only try to sync with Supabase if we have a valid email
    if (userInfo.email && userInfo.email !== "unknown@example.com") {
      try {
        await syncMsalUserWithSupabase(userInfo);
      } catch (syncError) {
        console.error("Error syncing with Supabase, continuing anyway:", syncError);
      }
    }
    
    return { 
      success: true, 
      token: crmAuthResult.token,
      user: userInfo,
      error: null
    };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, token: null, user: null, error };
  }
}

/**
 * Fetch user information from Dynamics CRM
 * @param {string} token - Access token
 * @returns {Promise<Object>} User information
 */
async function fetchUserInfoFromCrm(token) {
  try {
    // Get the organization ID
    const { currentOrgId, organizationId } = await chrome.storage.local.get(['currentOrgId', 'organizationId']);
    const orgId = currentOrgId || organizationId;
    
    if (!orgId) {
      throw new Error("Organization ID not found");
    }
    
    // Build the URL for WhoAmI endpoint
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
    
    // Now get additional user details using the user ID
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
      // Return basic info if detailed fetch fails
      return {
        id: data.UserId,
        email: "unknown@example.com", // Will be updated later if possible
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
    console.error("Error fetching user info from CRM:", error);
    // Return a placeholder object with the organization ID
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

/**
 * Syncs MSAL-authenticated user with Supabase DB
 * @param {Object} user - MSAL user object (email, name, orgId)
 * @returns {Promise<Object>} Sync result
 */
export async function syncMsalUserWithSupabase(user) {
  try {
    // Extract domain from email
    const domain = user.email.split('@')[1] || 'unknown.com';
    
    // Use provided org ID or create one from domain
    const orgId = user.organizationId || `org_${domain.replace(/\./g, '_')}`;

    // 1. Upsert organization
    const { error: orgError } = await supabase
      .from('organizations')
      .upsert({
        id: orgId,
        name: domain.split('.')[0] || 'Unknown Org',
        domain: domain,
        last_active: new Date()
      }, { onConflict: 'id' });

    if (orgError) {
      console.error("Error upserting organization:", orgError);
    }

    // 3. Upsert user data in the users table regardless of auth status
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        email: user.email,
        name: user.name || 'Unknown User',
        organization_id: orgId,
        last_login: new Date(),
        first_login: new Date(), // Will be overwritten if conflict
        login_count: 1, // Remove the supabase.sql reference
        extension_version: '1.0.0',
        subscription_status: 'free',
        dynamics_user_id: user.id || 'unknown'
      }, { 
        onConflict: 'email',
        ignoreDuplicates: false
      });

    if (userError) {
      console.error("Error upserting user:", userError);
      throw userError;
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("Error syncing MSAL user:", err);
    return { success: false, error: err };
  }
}

/**
 * Logout from both Dynamics CRM and Supabase
 * @param {Function} setAccessToken - State setter for access token
 * @param {Function} setOpportunities - State setter for opportunities
 * @param {Function} setCurrentOpportunity - State setter for current opportunity
 * @param {Function} setActivities - State setter for activities
 * @param {Function} setError - State setter for error
 * @param {Function} setLoading - State setter for loading state
 * @param {Function} setUser - State setter for user
 * @returns {Promise<Object>} Logout result
 */
export const logout = async (
  setAccessToken = null,
  setOpportunities = null,
  setCurrentOpportunity = null,
  setActivities = null,
  setError = null,
  setLoading = null,
  setUser = null
) => {
  try {
    if (setLoading) setLoading(true);

    // Logout from Supabase
    await supabase.auth.signOut();

    // Clear Chrome storage
    await chrome.storage.local.remove([
      "accessToken", 
      "rawAccessToken", 
      "expirationTime", 
      "tokenType",
      "currentOpportunityId",
      "lastUpdated",
      "subscriptionStatus",
      "subscriptionEndDate"
    ]);

    // Reset state variables
    if (setAccessToken) setAccessToken(null);
    if (setOpportunities) setOpportunities([]);
    if (setCurrentOpportunity) setCurrentOpportunity(null);
    if (setActivities) setActivities([]);
    if (setUser) setUser(null);
    if (setError) setError(null);

    return { success: true, message: "Logged out successfully" };
  } catch (error) {
    console.error("Logout error:", error);
    
    if (setError) {
      setError(`Logout failed: ${error.message}`);
    }

    return { 
      success: false, 
      message: "Logout encountered an error", 
      error: error.message 
    };
  } finally {
    if (setLoading) setLoading(false);
  }
};

/**
 * Check if user is logged in to both systems
 * @returns {Promise<boolean>} Login status
 */
export const isLoggedIn = async () => {
  try {
    // Check Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    
    // Check Dynamics token
    const { accessToken, expirationTime } = await chrome.storage.local.get([
      "accessToken", 
      "expirationTime"
    ]);

    // For now, we'll prioritize the Dynamics token over the Supabase session
    // as the Supabase integration is still being established
    const hasDynamicsToken = !!accessToken;
    const tokenNotExpired = expirationTime ? Date.now() < expirationTime : false;

    // We'll consider the user logged in if they have a valid Dynamics token
    // Once Supabase integration is fully established, we can require both
    return hasDynamicsToken && tokenNotExpired;
  } catch (error) {
    console.error("Login status check error:", error);
    return false;
  }
};

/**
 * Get current user from Supabase
 * @returns {Promise<Object>} Current user data
 */
export const getCurrentUser = async () => {
  try {
    // First try to get user from Supabase
    const { data: { user: supabaseUser }, error: supabaseError } = await supabase.auth.getUser();
    
    // If we have a Supabase user, get additional data
    if (supabaseUser) {
      // Get additional user data from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', supabaseUser.email)
        .single();
        
      if (userError) {
        console.warn("Failed to get user data from Supabase table:", userError);
      }
      
      if (userData) {
        return { 
          ...supabaseUser, 
          ...userData,
          profileComplete: true 
        };
      }
      
      return { 
        ...supabaseUser,
        profileComplete: false 
      };
    }
    
    // If no Supabase user, try to get user info from Dynamics
    const { accessToken } = await chrome.storage.local.get(["accessToken"]);
    
    if (accessToken) {
      const userInfo = await fetchUserInfoFromCrm(accessToken);
      
      if (userInfo && userInfo.email && userInfo.email !== "unknown@example.com") {
        // Store this user in users table for next time
        await syncMsalUserWithSupabase(userInfo);
        
        return {
          ...userInfo,
          profileComplete: false,
          provider: "dynamics"
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

/**
 * Get access token from storage
 * @returns {Promise<string|null>} Access token or null
 */
export const getAccessToken = async () => {
  try {
    const { accessToken, expirationTime } = await chrome.storage.local.get([
      "accessToken",
      "expirationTime"
    ]);
    
    // Check if token is expired
    const isExpired = expirationTime ? Date.now() > expirationTime : true;
    
    if (!accessToken || isExpired) {
      console.warn("Token is missing or expired");
      return null;
    }
    
    return accessToken;
  } catch (error) {
    console.error("Error getting access token:", error);
    return null;
  }
};