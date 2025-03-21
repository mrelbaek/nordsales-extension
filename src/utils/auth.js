const CLIENT_ID = "f71910da-e7e2-4deb-b99f-cc00eeddb1d0";
const TENANT_ID = "3ac5c167-6c44-42f2-a1f2-57990185ae5e";
const REDIRECT_URI = chrome.identity.getRedirectURL(); // Ensure we use Chrome’s redirect URI
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}`;
const SCOPE = `https://orga6a657bc.crm.dynamics.com/.default openid profile offline_access`;

const AUTH_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
    `client_id=${CLIENT_ID}&response_type=token&response_mode=fragment&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPE)}&prompt=select_account`;

/**
 * Launches the authentication popup using chrome.identity API.
 * Retrieves the access token directly from the redirect URL fragment.
 */
export async function login() {
    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
            { url: AUTH_URL, interactive: true },
            async (redirectUrl) => {
                if (chrome.runtime.lastError || !redirectUrl) {
                    console.error("Login failed:", chrome.runtime.lastError);
                    reject(new Error("Failed to authenticate"));
                    return;
                }

                // Extract access token from URL fragment
                const urlParams = new URLSearchParams(new URL(redirectUrl).hash.substring(1));
                const accessToken = urlParams.get("access_token");

                if (!accessToken) {
                    reject(new Error("No access token received"));
                    return;
                }

                console.log("Received access token:", accessToken);

                // Store access token in Chrome storage
                chrome.storage.local.set({ accessToken }, () => {
                    console.log("Access token stored successfully");
                    resolve(accessToken);
                });
            }
        );
    });
}

/**
 * Retrieves the stored access token from Chrome local storage.
 */
export async function getAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["accessToken"], (result) => {
            if (result.accessToken) {
                resolve(result.accessToken);
            } else {
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
        chrome.storage.local.remove(["accessToken"], () => {
            console.log("User logged out");
            resolve();
        });
    });
}
