const DEBUG = false;

// session.js - Handles Supabase session management

import { supabase } from './supabase';

/**
 * Track Supabase session changes
 */
export function trackSupabaseSession() {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      chrome.storage.local.set({ supabaseSession: session });
      console.log("Supabase session updated:", event);
    }
  });
}

/**
 * Restore Supabase session from storage
 * @returns {Promise<boolean>} Success status
 */
export async function restoreSupabaseSession() {
  try {
    const { supabaseSession } = await chrome.storage.local.get(['supabaseSession']);
    
    if (supabaseSession) {
      await supabase.auth.setSession(supabaseSession);
      if (DEBUG) console.log("Supabase session restored");
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error restoring Supabase session:", error);
    return false;
  }
}