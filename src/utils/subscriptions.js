import { supabase } from './supabase';

export const featureAccessMap = {
  // Free Tier
  openOpportunitiesTracker: ['free', 'pro', 'team'],
  basicStats: ['free', 'pro', 'team'],
  simpleWinLossCounters: ['free', 'pro', 'team'],
  limitedActivityTrends: ['free'],

  // Pro Tier
  portfolioAnalytics: ['pro', 'team'],
  winLossCharts: ['pro', 'team'],
  salesCycleAnalytics: ['pro', 'team'],
  fullActivityTrends: ['pro', 'team'],
  opportunityStats: ['pro', 'team'],
  activitiesCalendar: ['pro', 'team'],
  fullTimelineLog: ['pro', 'team'],
  salesCycleBenchmarks: ['pro', 'team'],
  allChartsAndVisuals: ['pro', 'team'],

  // Team (coming soon — stubbed for now)
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
    // Get user info from Chrome storage instead of Supabase Auth
    const { user } = await chrome.storage.local.get(["user"]);
    
    if (!user || !user.email) {
      console.error("User not found in local storage");
      return {
        status: 'free',
        isActive: true
      };
    }
    
    console.log("Checking subscription status for email:", user.email);
    
    // Look up user by email (we're not using Auth)
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('subscription_status, subscription_end_date, organization_id, uid')
      .eq('email', user.email)
      .single();
    
    if (fetchError || !userData) {
      console.error("Error fetching user data:", fetchError);
      return {
        status: 'free',
        isActive: true
      };
    }
    
    let mappedStatus = userData.subscription_status || 'free';
    if (mappedStatus === 'active') {
      mappedStatus = 'pro';
    }
    
    // Check if organization has a subscription
    if (userData.organization_id) {
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
            isActive: !orgData.subscription_end_date || new Date(orgData.subscription_end_date) > new Date() || orgData.subscription_status === 'free',
            isOrgSubscription: true
          };
        }
      }
    }
    
    return {
      status: mappedStatus,
      endDate: userData.subscription_end_date || null,
      isActive: !userData.subscription_end_date || new Date(userData.subscription_end_date) > new Date() || mappedStatus === 'free',
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
        { id: 'enterprise', name: 'Enterprise', price: 49.99, billing_cycle: 'monthly', features: ['custom-dashboards', 'team-management'] }
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

// Upgrade to Pro feature
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