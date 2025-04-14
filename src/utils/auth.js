// auth.js - Main authentication handler

import { dynamicsAuth } from './dynamicsAuth';
import { supabaseAuth } from './supabaseAuth';
import { getSubscriptionStatus } from './subscriptions';
import { supabase } from './supabase';  // Added this import!

/**
 * Main login function - handles both Dynamics and Supabase data sync
 * @returns {Promise<Object>} Authentication result with user info
 */
export async function login() {
  try {
    // Step 1: Authenticate with Dynamics CRM (primary auth)
    const dynamicsResult = await dynamicsAuth.loginWithDynamicsCrm();
    
    if (!dynamicsResult.success) {
      return { success: false, error: dynamicsResult.error };
    }
    
    // Step 2: Get user info from Dynamics
    const userInfo = await dynamicsAuth.fetchUserInfo(dynamicsResult.token);
    
    // Store session data early so user can still use the app even if Supabase sync fails
    await storeSession(dynamicsResult, userInfo, { status: 'free', isActive: true });
    
    // Step 3: Sync with Supabase (for data storage, not auth)
    try {
      await supabaseAuth.syncUserWithSupabase(userInfo);
      
      // Step 4: Check subscription status only after sync is successful
      const subscription = await getSubscriptionStatus();
      
      // Update the session with correct subscription info
      await storeSession(dynamicsResult, userInfo, subscription);
      
      return {
        success: true,
        token: dynamicsResult.token,
        user: userInfo,
        subscription: subscription,
        error: null
      };
    } catch (supabaseError) {
      console.warn("Supabase sync failed, continuing with Dynamics auth only:", supabaseError);
      // Continue with basic functionality and free subscription
      return {
        success: true,
        token: dynamicsResult.token,
        user: userInfo,
        subscription: { status: 'free', isActive: true },
        error: null
      };
    }
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if user is currently logged in
 * @returns {Promise<boolean>} Login status
 */
export async function isLoggedIn() {
  try {
    // Only check Dynamics token since we're not using Supabase Auth
    const { accessToken, expirationTime } = await chrome.storage.local.get([
      "accessToken", "expirationTime"
    ]);
    
    // Consider user logged in if token exists and isn't expired
    const tokenValid = accessToken && expirationTime && Date.now() < expirationTime;
    
    return tokenValid;
  } catch (error) {
    console.error("Login check error:", error);
    return false;
  }
}

/**
 * Get current user information
 * @returns {Promise<Object|null>} User info or null if not logged in
 */
export async function getCurrentUser() {
  try {
    // First check local storage
    const { user } = await chrome.storage.local.get(["user"]);
    
    if (user && user.email) {
      return user;
    }
    
    // If not in storage, try to get from Dynamics
    const accessToken = await getAccessToken();
    if (accessToken) {
      const userInfo = await dynamicsAuth.fetchUserInfo(accessToken);
      
      // Store for future use
      await chrome.storage.local.set({ user: userInfo });
      
      return userInfo;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Log out the user
 * @param {Object} stateFunctions - React state setter functions
 * @returns {Promise<Object>} Logout result
 */
export async function logout(stateFunctions = {}) {
  try {
    // No need to sign out from Supabase Auth since we're not using it
    // Just clear storage
    await chrome.storage.local.remove([
      "accessToken", "rawAccessToken", "expirationTime", 
      "tokenType", "user", "subscription", "currentOpportunityId", 
      "lastUpdated"
    ]);
    
    // Reset React state if functions provided
    for (const key in stateFunctions) {
      if (typeof stateFunctions[key] === 'function') {
        stateFunctions[key](null);
      }
    }
    
    return { success: true, message: "Logged out successfully" };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current access token
 * @returns {Promise<string|null>} Access token or null
 */
export async function getAccessToken() {
  try {
    const { accessToken, expirationTime } = await chrome.storage.local.get([
      "accessToken", "expirationTime"
    ]);
    
    if (!accessToken || Date.now() > expirationTime) {
      return null;
    }
    
    return accessToken;
  } catch (error) {
    console.error("Error getting access token:", error);
    return null;
  }
}

/**
 * Store session data in Chrome storage
 * @param {Object} dynamicsResult - Dynamics auth result
 * @param {Object} userInfo - User information
 * @param {Object} subscription - Subscription status
 */
async function storeSession(dynamicsResult, userInfo, subscription) {
  await chrome.storage.local.set({
    accessToken: dynamicsResult.token,
    expirationTime: dynamicsResult.expirationTime,
    user: userInfo,
    subscription: subscription
  });
}