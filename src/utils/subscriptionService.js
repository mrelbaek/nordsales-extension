// subscriptionService.js - Handles subscription status checks and management

import { supabase } from './supabase';

/**
 * Get user's subscription status
 * @param {string} email - User email
 * @returns {Promise<Object>} Subscription details
 */
export async function getSubscriptionStatus(email) {
  try {
    console.log("Checking subscription status for:", email);
    
    if (!email) {
      console.error("Email is required for subscription check");
      return getDefaultSubscription();
    }
    
    // Check if email is already stored for manual override
    const { manualSubscription } = await chrome.storage.local.get(['manualSubscription']);
    if (manualSubscription && manualSubscription.email === email) {
      console.log("Using manual subscription override:", manualSubscription.status);
      return manualSubscription;
    }
    
    // Query user record from Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_status, subscription_end_date, organization_id')
      .eq('email', email)
      .single();
    
    if (userError) {
      console.error("Error fetching user subscription data:", userError);
      return getDefaultSubscription();
    }
    
    // Critical - map 'active' to 'pro'
    const mappedStatus = mapSubscriptionStatus(userData.subscription_status);
    
    // Check organization subscription
    const { data: orgData } = await supabase
      .from('organizations')
      .select('subscription_status, subscription_end_date, subscription_seats')
      .eq('id', userData.organization_id)
      .single();
    
    // Determine effective subscription (org plan overrides individual if better)
    const subscriptionData = determineEffectiveSubscription(userData, orgData);
    
    console.log("Effective subscription:", subscriptionData);
    
    return subscriptionData;
  } catch (error) {
    console.error("Error getting subscription status:", error);
    return getDefaultSubscription();
  }
}

/**
 * Map database subscription status to application status
 * @param {string} dbStatus - Status from database
 * @returns {string} Mapped status
 */
function mapSubscriptionStatus(dbStatus) {
  const statusMap = {
    'active': 'pro',
    'cancelled': 'free',
    'trialing': 'pro'
  };
  
  return statusMap[dbStatus] || dbStatus || 'free';
}

/**
 * Determine the effective subscription from user and org data
 * @param {Object} userData - User subscription data
 * @param {Object} orgData - Organization subscription data
 * @returns {Object} Effective subscription
 */
function determineEffectiveSubscription(userData, orgData) {
  // If no org data, use user data
  if (!orgData) {
    return {
      status: mapSubscriptionStatus(userData.subscription_status),
      endDate: userData.subscription_end_date || null,
      isActive: !userData.subscription_end_date || new Date(userData.subscription_end_date) > new Date(),
      isOrgSubscription: false,
      organizationId: userData.organization_id
    };
  }
  
  // Compare user and org subscriptions
  const plans = ['free', 'basic', 'pro', 'enterprise'];
  const userPlanIndex = plans.indexOf(mapSubscriptionStatus(userData.subscription_status));
  const orgPlanIndex = plans.indexOf(mapSubscriptionStatus(orgData.subscription_status));
  
  // Use organization plan if better
  if (orgPlanIndex > userPlanIndex && orgPlanIndex >= 0) {
    return {
      status: mapSubscriptionStatus(orgData.subscription_status),
      endDate: orgData.subscription_end_date || null,
      isActive: !orgData.subscription_end_date || new Date(orgData.subscription_end_date) > new Date(),
      isOrgSubscription: true,
      organizationId: userData.organization_id,
      orgSeats: orgData.subscription_seats || 0
    };
  }
  
  // Otherwise use user plan
  return {
    status: mapSubscriptionStatus(userData.subscription_status),
    endDate: userData.subscription_end_date || null,
    isActive: !userData.subscription_end_date || new Date(userData.subscription_end_date) > new Date(),
    isOrgSubscription: false,
    organizationId: userData.organization_id
  };
}

/**
 * Set a manual subscription override
 * @param {string} email - User email
 * @param {string} status - Subscription status to set
 * @returns {Promise<Object>} Result
 */
export async function setManualSubscription(email, status) {
  try {
    if (!email) {
      throw new Error("Email is required for manual subscription");
    }
    
    if (!['free', 'basic', 'pro', 'enterprise'].includes(status)) {
      throw new Error("Invalid subscription status");
    }
    
    const subscription = {
      email,
      status,
      endDate: status === 'free' ? null : new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(),
      isActive: true,
      isManual: true
    };
    
    await chrome.storage.local.set({ manualSubscription: subscription });
    
    return { success: true, subscription };
  } catch (error) {
    console.error("Error setting manual subscription:", error);
    return { success: false, error };
  }
}

/**
 * Get default subscription (free)
 * @returns {Object} Default subscription
 */
function getDefaultSubscription() {
  return {
    status: 'free',
    endDate: null,
    isActive: true,
    isOrgSubscription: false
  };
}

export const subscriptionService = {
  getSubscriptionStatus,
  setManualSubscription
};