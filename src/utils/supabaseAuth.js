// supabaseAuth.js - Handles Supabase authentication and user management

import { supabase } from './supabase';

/**
 * Sync user data with Supabase
 * @param {Object} user - User data from Dynamics
 * @returns {Promise<Object>} Result of sync operation
 */
export async function syncUserWithSupabase(user) {
  try {
    if (!user.email || user.email === "unknown@example.com") {
      throw new Error("Valid email required for Supabase sync");
    }
    
    const domain = user.email.split('@')[1] || 'unknown.com';
    const orgId = user.organizationId || `org_${domain.replace(/\./g, '_')}`;
    
    // Update organization
    await updateOrganization(orgId, domain);
    
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, login_count, subscription_status')
      .eq('email', user.email)
      .single();
    
    const isNewUser = !existingUser;
    const loginCount = existingUser?.login_count || 0;
    
    // Prepare user data
    const userData = {
      email: user.email,
      name: user.name || 'Unknown User',
      organization_id: orgId,
      last_login: new Date(),
      login_count: loginCount + 1,
      extension_version: '1.0.0',
      dynamics_user_id: user.id || 'unknown'
    };
    
    // Set defaults for new users
    if (isNewUser) {
      userData.subscription_status = 'free';
      userData.first_login = new Date();
    }
    
    // Update user in database
    const { error } = await supabase
      .from('users')
      .upsert(userData, { onConflict: 'email' });
    
    if (error) throw error;
    
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