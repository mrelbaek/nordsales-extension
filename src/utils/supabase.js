import { createClient } from '@supabase/supabase-js';

// Chrome extension can't use process.env directly
// Using hardcoded values for the extension
const supabaseUrl = "https://izeyvfbioqdftncourod.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6ZXl2ZmJpb3FkZnRuY291cm9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMjExMDksImV4cCI6MjA1OTc5NzEwOX0.qtPLzjqY-o6pIFcodsv2ZVfUQTkWnDUVjrbTg4pKlfQ";

const options = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, options);

// Helper function to check supabase connection
export async function checkSupabaseConnection() {
    try {
      // Use a simpler query that's less likely to fail
      const { error } = await supabase.from('users').select('id', { count: 'exact', head: true }).limit(1);
      return { connected: !error, error };
    } catch (err) {
      console.error('Supabase connection error:', err);
      return { connected: false, error: err };
    }
  }

// Initialize tables if they don't exist
export async function initializeDatabase() {
  try {
    console.log("Checking if database tables are initialized...");
    
    // This is just a check - in a real app, table creation would be done via migrations
    // but for this extension we'll check if essential tables exist
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.warn("Error checking users table:", error);
      return { initialized: false, error };
    }
    
    return { initialized: true, error: null };
  } catch (err) {
    console.error("Error initializing database:", err);
    return { initialized: false, error: err };
  }
}

// Store telemetry data
export async function logTelemetry(eventType, eventData = {}) {
  try {
    const { error } = await supabase
      .from('telemetry')
      .insert([{
        event_type: eventType,
        event_data: eventData,
        created_at: new Date()
      }]);
    
    if (error) {
      console.warn("Failed to log telemetry:", error);
      return { success: false, error };
    }
    
    return { success: true, error: null };
  } catch (err) {
    console.error("Error logging telemetry:", err);
    return { success: false, error: err };
  }
}

// Store error logs
export async function logError(errorType, errorMessage, stackTrace = null, metadata = {}) {
  try {
    const { error } = await supabase
      .from('error_logs')
      .insert([{
        error_type: errorType,
        error_message: errorMessage,
        stack_trace: stackTrace,
        metadata: metadata,
        created_at: new Date()
      }]);
    
    if (error) {
      console.warn("Failed to log error:", error);
      return { success: false, error };
    }
    
    return { success: true, error: null };
  } catch (err) {
    console.error("Error logging error:", err);
    return { success: false, error: err };
  }
}

// Helper to get database schema info
export async function getSchemaInfo() {
  // In production, you'd use a more sophisticated approach
  // This is a simplified version for development
  const tables = [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', primaryKey: true },
        { name: 'email', type: 'text', unique: true },
        { name: 'name', type: 'text' },
        { name: 'organization_id', type: 'text', foreignKey: true },
        { name: 'extension_version', type: 'text' },
        { name: 'first_login', type: 'timestamp' },
        { name: 'last_login', type: 'timestamp' },
        { name: 'login_count', type: 'integer' },
        { name: 'subscription_status', type: 'text' },
        { name: 'subscription_end_date', type: 'timestamp' },
        { name: 'dynamics_user_id', type: 'text' },
        { name: 'created_at', type: 'timestamp' },
        { name: 'updated_at', type: 'timestamp' }
      ]
    },
    {
      name: 'organizations',
      columns: [
        { name: 'id', type: 'text', primaryKey: true },
        { name: 'name', type: 'text' },
        { name: 'domain', type: 'text' },
        { name: 'subscription_status', type: 'text' },
        { name: 'subscription_end_date', type: 'timestamp' },
        { name: 'subscription_seats', type: 'integer' },
        { name: 'last_active', type: 'timestamp' },
        { name: 'created_at', type: 'timestamp' },
        { name: 'updated_at', type: 'timestamp' }
      ]
    },
    {
      name: 'feature_usage',
      columns: [
        { name: 'id', type: 'uuid', primaryKey: true },
        { name: 'user_id', type: 'uuid', foreignKey: true },
        { name: 'feature', type: 'text' },
        { name: 'used_at', type: 'timestamp' },
        { name: 'metadata', type: 'jsonb' }
      ]
    },
    {
      name: 'telemetry',
      columns: [
        { name: 'id', type: 'uuid', primaryKey: true },
        { name: 'event_type', type: 'text' },
        { name: 'event_data', type: 'jsonb' },
        { name: 'created_at', type: 'timestamp' }
      ]
    },
    {
      name: 'error_logs',
      columns: [
        { name: 'id', type: 'uuid', primaryKey: true },
        { name: 'error_type', type: 'text' },
        { name: 'error_message', type: 'text' },
        { name: 'stack_trace', type: 'text' },
        { name: 'metadata', type: 'jsonb' },
        { name: 'created_at', type: 'timestamp' }
      ]
    },
    {
      name: 'subscription_prices',
      columns: [
        { name: 'id', type: 'text', primaryKey: true },
        { name: 'name', type: 'text' },
        { name: 'price', type: 'numeric' },
        { name: 'billing_cycle', type: 'text' },
        { name: 'features', type: 'jsonb' },
        { name: 'created_at', type: 'timestamp' },
        { name: 'updated_at', type: 'timestamp' }
      ]
    }
  ];
  
  return tables;
}