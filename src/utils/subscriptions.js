// subscriptions.js - Consolidated subscription management for Lens

import { supabase } from './supabase';

/**
 * Feature access map defining which features are available to which subscription tiers
 */
export const featureAccessMap = {
  // Free Tier
  openOpportunitiesTracker: ['free', 'trial', 'pro', 'team'],
  basicStats: ['free', 'trial', 'pro', 'team'],
  simpleWinLossCounters: ['free', 'trial', 'pro', 'team'],
  limitedActivityTrends: ['free'],

  // Pro Tier
  portfolioAnalytics: ['trial','pro', 'team'],
  winLossCharts: ['trial','pro', 'team'],
  salesCycleAnalytics: ['trial','pro', 'team'],
  fullActivityTrends: ['trial','pro', 'team'],
  opportunityStats: ['trial','pro', 'team'],
  activitiesCalendar: ['trial','pro', 'team'],
  fullTimelineLog: ['trial','pro', 'team'],
  salesCycleBenchmarks: ['trial','pro', 'team'],
  allChartsAndVisuals: ['trial','pro', 'team'],

  // Team Tier
  benchmarkTeamPerformance: ['team'],
  trackOpportunities: ['team'],
  scheduledReports: ['team'],
  commissionEstimator: ['team'],
  customBranding: ['team']
};

/**
 * Get current user's subscription status
 * @returns {Promise<Object>} Subscription details
 */
export async function getSubscriptionStatus() {
  try {
    // Get user info from Chrome storage
    const { user } = await chrome.storage.local.get(["user"]);
    
    if (!user || !user.email) {
      console.error("User not found in local storage");
      return {
        status: 'free',
        isActive: true
      };
    }
    
    console.log("Checking subscription status for email:", user.email);
    
    // Look up user by email with explicit headers
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('subscription_status, subscription_end_date, trial_ends_at, organization_id, uid')
      .eq('email', user.email)
      .single()
    
    if (fetchError) {
      console.error("Error fetching user data:", fetchError);
      return {
        status: 'free',
        isActive: true
      };
    }
    
    // Special handling for trial status
    if (userData.subscription_status === 'trialing' || userData.subscription_status === 'trial' && userData.trial_ends_at) {
      const now = new Date();
      const trialEndDate = new Date(userData.trial_ends_at);
      
      // Calculate days remaining in trial
      const trialDaysRemaining = Math.max(0, Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)));
      
      // Check if trial is still active
      const isTrialActive = trialEndDate > now;
      
      if (isTrialActive) {
        return {
          status: 'trial', // Pro features during trial
          isActive: true,
          trialActive: true,
          trialDaysRemaining,
          trialEndsAt: userData.trial_ends_at,
          message: `You're in your ${trialDaysRemaining}-day trial period`,
          isOrgSubscription: false
        };
      } else {
        // Trial expired, revert to free
        return {
          status: 'free',
          isActive: true,
          trialActive: false,
          trialExpired: true,
          isOrgSubscription: false
        };
      }
    }
    
    // Normal subscription handling for non-trial status
    let mappedStatus = userData.subscription_status || 'free';
    if (mappedStatus === 'active') {
      mappedStatus = 'pro';
    }
    
    // Check for organization subscription if applicable
    if (userData.organization_id) {
      try {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('subscription_status, subscription_end_date, subscription_seats')
          .eq('id', userData.organization_id)
          .single();

        if (!orgError && orgData && orgData.subscription_status) {
          // Compare user vs org subscription, use the higher tier
          const tiers = ['free', 'basic', 'pro', 'team'];
          const userTier = tiers.indexOf(mappedStatus);
          const orgTier = tiers.indexOf(orgData.subscription_status);
          
          if (orgTier > userTier) {
            return {
              status: orgData.subscription_status,
              endDate: orgData.subscription_end_date || null,
              isActive: !orgData.subscription_end_date || new Date(orgData.subscription_end_date) > new Date(),
              isOrgSubscription: true
            };
          }
        }
      } catch (orgError) {
        console.error("Error checking organization subscription:", orgError);
        // Continue with user subscription
      }
    }
    
    return {
      status: mappedStatus,
      endDate: userData.subscription_end_date || null,
      isActive: !userData.subscription_end_date || new Date(userData.subscription_end_date) > new Date(),
      isOrgSubscription: false
    };
  } catch (err) {
    console.error("Error in getSubscriptionStatus:", err);
    return {
      status: 'free',
      isActive: true
    };
  }
}

// function to start trial for a new users
export async function startUserTrial(email) {
  try {
    if (!email) {
      throw new Error("Email is required to start a trial");
    }
    
    // Set trial end date 14 days from now
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    
    const { data, error } = await supabase
      .from('users')
      .update({
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt.toISOString(),
        updated_at: new Date()
      })
      .eq('email', email);
      
    if (error) throw error;
    
    // Update local storage
    const { user } = await chrome.storage.local.get(["user"]);
    if (user && user.email === email) {
      await chrome.storage.local.set({
        subscription: {
          status: 'trial',
          trialEndsAt: trialEndsAt.toISOString(),
          trialDaysRemaining: 14,
          isActive: true
        }
      });
    }
    
    return { 
      success: true, 
      trialEndsAt: trialEndsAt.toISOString(), 
      trialDaysRemaining: 14,
      error: null 
    };
  } catch (error) {
    console.error("Error starting trial:", error);
    return { success: false, error };
  }
}

/**
 * Map database subscription status to application status
 * @param {string} dbStatus - Status from database
 * @returns {string} Mapped status
 */
function mapSubscriptionStatus(dbStatus, trialEndsAt) {
  // Check if user has an active paid subscription first
  if (dbStatus === 'active') {
    return 'pro';  // Active subscriptions should always map to pro
  }
  
  // Then check trial status (only applies if not already on pro)
  if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
    return 'trial';
  }
  
  // Handle other statuses
  const statusMap = {
    'cancelled': 'free',
    'trialing': 'trial',
    'trial': 'trial'
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
      status: userData.status,
      endDate: userData.endDate || null,
      isActive: !userData.endDate || new Date(userData.endDate) > new Date() || userData.status === 'free',
      isOrgSubscription: false,
      organizationId: userData.organizationId
    };
  }
  
  // Compare user and org subscriptions
  const plans = ['free', 'basic', 'pro', 'team'];
  const userPlanIndex = plans.indexOf(userData.status);
  const orgPlanIndex = plans.indexOf(mapSubscriptionStatus(orgData.subscription_status));
  
  // Use organization plan if better
  if (orgPlanIndex > userPlanIndex && orgPlanIndex >= 0) {
    return {
      status: mapSubscriptionStatus(orgData.subscription_status),
      endDate: orgData.subscription_end_date || null,
      isActive: !orgData.subscription_end_date || new Date(orgData.subscription_end_date) > new Date(),
      isOrgSubscription: true,
      organizationId: userData.organizationId,
      orgSeats: orgData.subscription_seats || 0
    };
  }
  
  // Otherwise use user plan
  return {
    status: userData.status,
    endDate: userData.endDate || null,
    isActive: !userData.endDate || new Date(userData.endDate) > new Date() || userData.status === 'free',
    isOrgSubscription: false,
    organizationId: userData.organizationId
  };
}

/**
 * Update user's subscription status
 * @param {string} email - User email
 * @param {string} status - New subscription status
 * @param {Date} endDate - Subscription end date
 * @returns {Promise<Object>} Update result
 */
export async function updateSubscription(email, status, endDate) {
  try {
    if (!email || !status) {
      throw new Error("Email and status are required to update subscription");
    }
    
    const { data, error } = await supabase
      .from('users')
      .update({
        subscription_status: status,
        subscription_end_date: endDate || null,
        updated_at: new Date()
      })
      .eq('email', email);
      
    if (error) throw error;
    
    // After updating subscription in database, update local storage
    const { user } = await chrome.storage.local.get(["user"]);
    if (user && user.email === email) {
      await chrome.storage.local.set({
        subscription: {
          status: status,
          endDate: endDate || null,
          isActive: true
        }
      });
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error("Error updating subscription:", error);
    return { success: false, error };
  }
}

/**
 * Update organization subscription
 * @param {string} orgId - Organization ID
 * @param {string} status - New subscription status
 * @param {Date} endDate - Subscription end date
 * @param {number} seats - Number of seats
 * @returns {Promise<Object>} Update result
 */
export async function updateOrgSubscription(orgId, status, endDate, seats = 5) {
  try {
    if (!orgId || !status) {
      throw new Error("Organization ID and status are required");
    }
    
    const { data, error } = await supabase
      .from('organizations')
      .update({
        subscription_status: status,
        subscription_end_date: endDate || null,
        subscription_seats: seats,
        updated_at: new Date()
      })
      .eq('id', orgId);
      
    if (error) throw error;
    
    return { success: true, error: null };
  } catch (error) {
    console.error("Error updating organization subscription:", error);
    return { success: false, error };
  }
}

/**
 * Check if feature is available for user's subscription level
 * @param {string} feature - Feature name
 * @param {string} subscriptionStatus - User's subscription status
 * @returns {boolean} Whether feature is available
 */
export function hasFeatureAccess(featureName, subscriptionStatus = 'free') {
  // If feature doesn't exist in map, default to no access
  const allowedTiers = featureAccessMap[featureName] || [];
  return allowedTiers.includes(subscriptionStatus);
}

/**
 * Track feature usage for analytics
 * @param {string} feature - Feature used
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Tracking result
 */
export async function trackFeatureUsage(feature, metadata = {}) {
  try {
    if (!feature) {
      throw new Error("Feature name is required");
    }
    
    // Get current user from local storage
    const { user } = await chrome.storage.local.get(["user"]);
    
    if (!user || !user.email) {
      console.warn("Cannot track feature usage: No user in local storage");
      return { success: false, error: "No user found" };
    }
    
    // Find the user ID from the database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();
      
    if (userError || !userData) {
      console.warn("Cannot track feature usage: User not found in database");
      return { success: false, error: userError };
    }
    
    // Insert feature usage
    const { data, error } = await supabase
      .from('feature_usage')
      .insert([{
        user_id: userData.id,
        feature: feature,
        used_at: new Date(),
        metadata: metadata
      }]);
      
    if (error) throw error;
    
    return { success: true, error: null };
  } catch (error) {
    console.error("Error tracking feature usage:", error);
    return { success: false, error };
  }
}

/**
 * Get subscription pricing information
 * @returns {Promise<Object>} Pricing information
 */
export async function getSubscriptionPrices() {
  try {
    const { data, error } = await supabase
      .from('subscription_prices')
      .select('*')
      .order('price', { ascending: true });
      
    if (error) throw error;
    
    return { success: true, prices: data || [], error: null };
  } catch (error) {
    console.error("Error fetching subscription prices:", error);
    
    // Return default pricing if database fetch fails
    return { 
      success: false, 
      prices: [
        { id: 'basic', name: 'Basic', price: 9.99, billing_cycle: 'monthly', features: ['basic-analytics', 'timeline-view'] },
        { id: 'pro', name: 'Professional', price: 19.99, billing_cycle: 'monthly', features: ['advanced-analytics', 'export-data', 'api-access'] },
        { id: 'team', name: 'Team', price: 49.99, billing_cycle: 'monthly', features: ['custom-dashboards', 'team-management'] }
      ],
      error 
    };
  }
}

/**
 * Get usage statistics for a user
 * @returns {Promise<Object>} Usage statistics
 */
export async function getUserUsageStats() {
  try {
    // Get user info from local storage
    const { user } = await chrome.storage.local.get(["user"]);
    
    if (!user || !user.email) {
      throw new Error("No user found in local storage");
    }
    
    // Get user ID from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();
      
    if (userError) throw userError;
    
    // Get feature usage
    const { data: usageData, error: usageError } = await supabase
      .from('feature_usage')
      .select('feature, used_at')
      .eq('user_id', userData.id)
      .order('used_at', { ascending: false })
      .limit(100);
      
    if (usageError) throw usageError;
    
    // Group by feature
    const featureUsage = {};
    usageData.forEach(usage => {
      if (!featureUsage[usage.feature]) {
        featureUsage[usage.feature] = 0;
      }
      featureUsage[usage.feature]++;
    });
    
    // Get last 30 days usage
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUsage = usageData.filter(usage => 
      new Date(usage.used_at) >= thirtyDaysAgo
    ).length;
    
    return { 
      success: true, 
      totalUsage: usageData.length,
      recentUsage,
      featureUsage,
      error: null
    };
  } catch (error) {
    console.error("Error fetching usage statistics:", error);
    return { 
      success: false, 
      totalUsage: 0,
      recentUsage: 0,
      featureUsage: {},
      error
    };
  }
}

/**
 * Set a manual subscription override (useful for testing)
 * @param {string} email - User email
 * @param {string} status - Subscription status to set
 * @returns {Promise<Object>} Result
 */
export async function setManualSubscription(email, status) {
  try {
    if (!email) {
      throw new Error("Email is required for manual subscription");
    }
    
    if (!['free', 'basic', 'pro', 'team'].includes(status)) {
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

/**
 * Open the payment dialog/page for upgrading to Pro
 */
export async function openPaymentDialog() {
  try {
    // Get user from local storage
    const { user } = await chrome.storage.local.get(["user"]);
    
    const stripeCheckoutUrl = 'https://buy.stripe.com/8wMg1NaB77DG5wcfYY';
    
    if (user && user.email) {
      // Track feature usage
      await trackFeatureUsage('clicked_upgrade_cta', {
        context: 'feature_gate',
        plan: 'pro'
      });
    } else {
      console.warn("User not logged in, skipping feature usage tracking.");
    }

    window.open(stripeCheckoutUrl, '_blank');
  } catch (error) {
    console.error("openPaymentDialog error:", error);
  }
}