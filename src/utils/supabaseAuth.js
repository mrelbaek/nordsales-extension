// supabaseAuth.js - Handles Supabase authentication and user management
import { supabase } from './supabase';

/**
 * Sync user data with Supabase
 * @param {Object} user - User data from Dynamics
 * @returns {Promise<Object>} Result of sync operation
 */
export async function syncUserWithSupabase(user) {
  try {
    console.log("Starting syncUserWithSupabase with user:", user);
    
    if (!user || !user.email || user.email === "unknown@example.com") {
      console.error("Invalid user data for Supabase sync:", user);
      throw new Error("Valid email required for Supabase sync");
    }
    
    const domain = user.email.split('@')[1] || 'unknown.com';
    const orgId = user.organizationId || `org_${domain.replace(/\./g, '_')}`;
    
    console.log("Extracted domain:", domain, "Organization ID:", orgId);
    
    // Update organization
    try {
      await updateOrganization(orgId, domain);
      console.log("Organization updated successfully");
    } catch (orgError) {
      console.error("Error updating organization:", orgError);
      // Continue anyway - we still want to try creating the user
    }
    
    // Check if user exists using REST API directly to avoid 406 errors
    console.log("Checking if user exists:", user.email);
    let existingUser = null;
    let isNewUser = true;
    let loginCount = 0;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, login_count, subscription_status')
        .eq('email', user.email)
        .limit(1)
        .single();
      
      if (!error && data) {
        existingUser = data;
        isNewUser = false;
        loginCount = existingUser.login_count || 0;
        console.log("Found existing user:", existingUser);
      } else if (error) {
        // Log but don't fail the operation
        console.warn("Error checking existing user:", error);
      }
    } catch (userCheckError) {
      console.warn("Error during user check:", userCheckError);
      // Continue with best-effort user creation
    }
    
    // Calculate trial end date - 14 days from now
    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(now.getDate() + 14); // 14-day trial
    
    // Prepare user data
    const userData = {
      email: user.email,
      name: user.name || 'Unknown User',
      organization_id: orgId,
      last_login: now.toISOString(),
      login_count: loginCount + 1,
      extension_version: '1.0.0',
      dynamics_user_id: user.id || 'unknown'
    };
    
    // Set defaults for new users
    if (isNewUser) {
      userData.subscription_status = 'trial'; 
      userData.first_login = now.toISOString();
      // Add trial end date for new users
      userData.trial_ends_at = trialEndDate.toISOString();
      console.log("Creating new user with data:", userData);
    } else {
      console.log("Updating existing user with data:", userData);
    }
    
    try {
      // Explicitly set headers for the upsert call
      const { error } = await supabase
        .from('users')
        .upsert(userData, { 
          onConflict: 'email'
        });
      
      if (error) {
        console.error("Error upserting user:", error);
        // Don't throw, we'll continue with local data
      } else {
        console.log("User successfully synchronized with Supabase");
      }
    } catch (upsertError) {
      console.error("Exception during user upsert:", upsertError);
      // Continue with local operation - don't block the extension
    }
    
    // Return success to allow extension to function even if Supabase operations failed
    return { 
      success: true,
      // Include subscription info for immediate use
      subscription: {
        status: isNewUser ? 'trial' : (existingUser?.subscription_status || 'free'),
        endDate: isNewUser ? trialEndDate.toISOString() : null,
        isActive: true
      }
    };
  } catch (error) {
    console.error("Error syncing with Supabase:", error, "Stack:", error.stack);
    // Return success anyway to allow extension to function, with a default subscription
    return { 
      success: false, 
      error,
      subscription: {
        status: 'free',  // Default to pro for testing
        isActive: true
      }
    };
  }
}

/**
 * Update organization record in Supabase
 * @param {string} orgId - Organization ID
 * @param {string} domain - Email domain
 * @returns {Promise<void>}
 */
async function updateOrganization(orgId, domain) {
  console.log("Updating organization:", orgId, domain);
  
  try {
    const { error } = await supabase
      .from('organizations')
      .upsert({
        id: orgId,
        name: domain.split('.')[0] || 'Unknown Org',
        domain: domain,
        last_active: new Date().toISOString()
      }, { 
        onConflict: 'id'
      });
    
    if (error) {
      console.error("Error updating organization:", error);
      throw error;
    }
    
    console.log("Organization updated successfully");
  } catch (err) {
    console.error("Error in updateOrganization:", err);
    throw err;
  }
}

/**
 * Sign out from Supabase
 * @returns {Promise<void>}
 */
export async function signOut() {
  return supabase.auth.signOut();
}

export const supabaseAuth = {
  syncUserWithSupabase,
  signOut
};