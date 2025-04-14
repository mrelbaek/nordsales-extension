// supabaseAuth.js - Handles Supabase data synchronization for Dynamics users

import { supabase } from './supabase';

/**
 * Sync Dynamics user data with Supabase database
 * @param {Object} user - User data from Dynamics
 * @returns {Promise<Object>} Result of sync operation
 */
export async function syncUserWithSupabase(user) {
  try {
    if (!user.email || user.email === "unknown@example.com") {
      throw new Error("Valid email required for Supabase sync");
    }
    
    // Generate a consistent UID for this user based on their Dynamics ID or email
    // This ensures we can have a unique identifier for RLS policies
    const uid = user.id ? `dynamics_${user.id}` : `email_${user.email.replace(/[^a-zA-Z0-9]/g, '')}`;
    
    const domain = user.email.split('@')[1] || 'unknown.com';
    const orgId = user.organizationId || `org_${domain.replace(/\./g, '_')}`;
    
    // Update organization
    await updateOrganization(orgId, domain);
    
    // Check if user exists by email
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, login_count, subscription_status, uid')
      .eq('email', user.email)
      .single();
    
    // Prepare user data
    const userData = {
      uid: uid, // Use our generated consistent UID
      email: user.email,
      name: user.name || 'Unknown User',
      organization_id: orgId,
      last_login: new Date(),
      extension_version: '1.0.0',
      dynamics_user_id: user.id || 'unknown'
    };
    
    // Set login count and other fields based on existing data
    if (existingUser) {
      userData.login_count = (existingUser.login_count || 0) + 1;
    } else {
      // Set defaults for new users
      userData.subscription_status = 'free';
      userData.first_login = new Date();
      userData.login_count = 1;
    }
    
    // Update user in database
    const { error } = await supabase
      .from('users')
      .upsert(userData, { onConflict: 'email' });
    
    if (error) {
      console.error("Error upserting user:", error);
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error syncing with Supabase:", error);
    return { success: false, error };
  }
}

/**
 * Update organization data in Supabase
 * @param {string} orgId - Organization ID
 * @param {string} domain - Email domain
 */
async function updateOrganization(orgId, domain) {
  const { error } = await supabase
    .from('organizations')
    .upsert({
      id: orgId,
      name: domain.split('.')[0] || 'Unknown Org',
      domain: domain,
      last_active: new Date()
    }, { onConflict: 'id' });
  
  if (error) {
    console.error("Error updating organization:", error);
  }
}

/**
 * Clear user data - this does NOT sign out of Supabase Auth
 * since we're not using it
 */
export async function signOut() {
  // No Supabase Auth to sign out from, just a stub for compatibility
  return Promise.resolve({ success: true });
}

export const supabaseAuth = {
  syncUserWithSupabase,
  signOut
};