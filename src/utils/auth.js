const CLIENT_ID = "f71910da-e7e2-4deb-b99f-cc00eeddb1d0";
const TENANT_ID = "3ac5c167-6c44-42f2-a1f2-57990185ae5e";
const REDIRECT_URI = chrome.identity.getRedirectURL(); // Ensure we use Chrome's redirect URI
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}`;

// Update the scope to include user_impersonation which is what Dynamics requires
const SCOPE = `https://orga6a657bc.crm.dynamics.com/user_impersonation openid profile offline_access`;

const AUTH_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
    `client_id=${CLIENT_ID}&response_type=token&response_mode=fragment&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPE)}&prompt=select_account`;

/**
 * Launches the authentication popup using chrome.identity API.
 * Retrieves the access token directly from the redirect URL fragment.
 */
export async function login() {
    return new Promise((resolve, reject) => {
        console.log("Starting login process");
        console.log("Auth URL:", AUTH_URL.split("?")[0] + "?...");
        
        chrome.identity.launchWebAuthFlow(
            { url: AUTH_URL, interactive: true },
            async (redirectUrl) => {
                if (chrome.runtime.lastError || !redirectUrl) {
                    console.error("Login failed:", chrome.runtime.lastError);
                    reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : "Failed to authenticate"));
                    return;
                }

                console.log("Received redirect URL");
                
                // Extract access token from URL fragment
                const urlParams = new URLSearchParams(new URL(redirectUrl).hash.substring(1));
                const accessToken = urlParams.get("access_token");
                const expiresIn = urlParams.get("expires_in");
                const tokenType = urlParams.get("token_type");

                if (!accessToken) {
                    console.error("No access token in redirect URL");
                    reject(new Error("No access token received"));
                    return;
                }

                console.log("Received access token:", accessToken.substring(0, 10) + "...");
                console.log("Token type:", tokenType);
                console.log("Expires in:", expiresIn, "seconds");

                // Store access token in Chrome storage
                const expirationTime = Date.now() + (parseInt(expiresIn) * 1000);
                chrome.storage.local.set({ 
                    accessToken, 
                    expirationTime,
                    tokenType
                }, () => {
                    console.log("Access token stored successfully");
                    resolve(accessToken);
                });
            }
        );
    });
}

/**
 * Retrieves the stored access token from Chrome local storage.
 * Checks if the token is still valid based on expiration time.
 */
export async function getAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["accessToken", "expirationTime"], (result) => {
            if (result.accessToken && result.expirationTime) {
                // Check if token is expired
                if (Date.now() < result.expirationTime) {
                    console.log("Found valid token in storage");
                    resolve(result.accessToken);
                } else {
                    console.log("Token expired, needs refresh");
                    reject(new Error("Token expired"));
                }
            } else {
                console.log("No valid token in storage");
                reject(new Error("No access token found"));
            }
        });
    });
}

/**
 * Logs out the user by clearing the access token from storage.
 */
export async function logout() {
    return new Promise((resolve) => {
        chrome.storage.local.remove(["accessToken", "expirationTime", "tokenType"], () => {
            console.log("User logged out");
            resolve();
        });
    });
}