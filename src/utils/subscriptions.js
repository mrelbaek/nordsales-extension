import { supabase } from './supabase';

/**
 * Get current user's subscription status
 * @param {string} email - User email
 * @returns {Promise<Object>} Subscription details
 */
export async function getSubscriptionStatus(email) {
  try {
    console.log("getSubscriptionStatus called with email:", email);
    
    if (!email) {
      console.error("Email is required to check subscription status");
      console.trace("Stack trace for missing email:"); // This will show where the call is coming from
      throw new Error("Email is required to check subscription status");
    }
    
    console.log("Checking subscription status for:", email);
    
    // Try to get user data first
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_status, subscription_end_date, organization_id')
      .eq('email', email)
      .single();
      
    if (userError) {
      console.error("Error fetching user subscription data:", userError);
      // Return default subscription if user not found
      return {
        status: 'free',
        endDate: null,
        isActive: true,
        isOrgSubscription: false,
        organizationId: null,
        orgSeats: 0
      };
    }
    
    // Try to get organization data
    let orgData = null;
    let orgError = null;
    
    if (userData.organization_id) {
      const orgResult = await supabase
        .from('organizations')
        .select('subscription_status, subscription_end_date, subscription_seats')
        .eq('id', userData.organization_id)
        .single();
        
      orgData = orgResult.data;
      orgError = orgResult.error;
      
      if (orgError) {
        console.warn("Error fetching organization data:", orgError);
      }
    }
    
    // Determine effective subscription status
    // Organization plan overrides individual plan if better
    const plans = ['free', 'basic', 'pro', 'enterprise'];
    const userPlanIndex = plans.indexOf(userData.subscription_status || 'free');
    const orgPlanIndex = orgData ? plans.indexOf(orgData.subscription_status || 'free') : -1;
    
    const effectiveStatus = (orgPlanIndex > userPlanIndex && orgPlanIndex >= 0) 
      ? orgData.subscription_status 
      : userData.subscription_status || 'free';
      
    const effectiveEndDate = (orgPlanIndex > userPlanIndex && orgPlanIndex >= 0)
      ? orgData.subscription_end_date
      : userData.subscription_end_date;
    
    return {
      status: effectiveStatus,
      endDate: effectiveEndDate || null,
      isActive: !effectiveEndDate || new Date(effectiveEndDate) > new Date() || effectiveStatus === 'free',
      isOrgSubscription: orgPlanIndex > userPlanIndex && orgPlanIndex >= 0,
      organizationId: userData.organization_id,
      orgSeats: orgData ? (orgData.subscription_seats || 0) : 0
    };
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    // Return default subscription on error
    return {
      status: 'free',
      endDate: null,
      isActive: true,
      isOrgSubscription: false,
      organizationId: null,
      orgSeats: 0
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
export function hasFeatureAccess(feature, subscriptionStatus = 'free') {
  // Feature access by subscription level
  const featureAccess = {
    'basic-analytics': ['free', 'basic', 'pro', 'enterprise'],
    'advanced-analytics': ['basic', 'pro', 'enterprise'],
    'opportunity-tracking': ['free', 'basic', 'pro', 'enterprise'],
    'activity-monitoring': ['free', 'basic', 'pro', 'enterprise'],
    'timeline-view': ['basic', 'pro', 'enterprise'],
    'export-data': ['pro', 'enterprise'],
    'api-access': ['pro', 'enterprise'],
    'custom-dashboards': ['enterprise'],
    'team-management': ['enterprise']
  };
  
  // Check if feature exists and user's subscription is allowed
  return featureAccess[feature] 
    ? featureAccess[feature].includes(subscriptionStatus)
    : false;
}

/**
 * Track feature usage for analytics
 * @param {string} userId - User ID
 * @param {string} feature - Feature used
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Tracking result
 */
export async function trackFeatureUsage(userId, feature, metadata = {}) {
  try {
    if (!userId || !feature) {
      throw new Error("User ID and feature are required");
    }
    
    const { data, error } = await supabase
      .from('feature_usage')
      .insert([{
        user_id: userId,
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
 * @param {string} email - User email
 * @returns {Promise<Object>} Usage statistics
 */
export async function getUserUsageStats(email) {
  try {
    if (!email) {
      throw new Error("Email is required to fetch usage statistics");
    }
    
    // Get user ID first
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
      
    if (userError) throw userError;
    
    // Then get feature usage
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
 * Initialize subscription purchase process
 * @param {string} email - User email
 * @param {string} plan - Subscription plan
 * @returns {Promise<Object>} Checkout result with URL
 */
export async function initiatePurchase(email, plan) {
  try {
    if (!email || !plan) {
      throw new Error("Email and plan are required");
    }
    
    const response = await fetch('https://izeyvfbioqdftncourod.supabase.co/functions/v1/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        plan
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create checkout: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      checkoutUrl: data.url,
      sessionId: data.sessionId,
      error: null
    };
  } catch (error) {
    console.error("Error initiating purchase:", error);
    return {
      success: false,
      checkoutUrl: null,
      sessionId: null,
      error
    };
  }
}