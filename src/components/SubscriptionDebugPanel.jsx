// Add this component to your extension for debugging subscription issues

import React, { useState, useEffect } from 'react';

const SubscriptionDebugPanel = ({ user, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [storedSubscription, setStoredSubscription] = useState(null);
  const [supabaseSubscription, setSupabaseSubscription] = useState(null);
  const [error, setError] = useState(null);

  // Load stored subscription on mount
  useEffect(() => {
    async function loadStoredSubscription() {
      try {
        const { subscription } = await chrome.storage.local.get(['subscription']);
        setStoredSubscription(subscription);
      } catch (err) {
        console.error("Error loading stored subscription:", err);
      }
    }
    
    loadStoredSubscription();
  }, []);

  // Function to check Supabase subscription
  const checkSupabaseSubscription = async () => {
    if (!user?.email) {
      setError("No user email available");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Import the function here to avoid circular dependencies
      const { getSubscriptionStatus } = await import('../../utils/subscriptions.js');
      const subscription = await getSubscriptionStatus(user.email);
      setSupabaseSubscription(subscription);
    } catch (err) {
      console.error("Error checking Supabase subscription:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Function to set subscription status manually
  const setSubscriptionStatus = async (status) => {
    try {
      setLoading(true);
      
      const newSubscription = {
        status: status,
        endDate: status === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        isOrgSubscription: false
      };
      
      // Store in local storage
      await chrome.storage.local.set({ subscription: newSubscription });
      setStoredSubscription(newSubscription);
      
      // Notify parent component
      if (onUpdate) onUpdate(newSubscription);
      
      // Send message to update subscription across extension
      chrome.runtime.sendMessage({
        type: 'SUBSCRIPTION_UPDATED',
        subscription: newSubscription
      });
      
    } catch (err) {
      console.error("Error setting subscription status:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      margin: '10px', 
      padding: '10px', 
      border: '1px solid #ccc', 
      borderRadius: '4px',
      fontSize: '12px'
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>Subscription Debug</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Stored Subscription:</strong> {storedSubscription?.status || 'None'}
        {storedSubscription?.endDate && (
          <span> (until {new Date(storedSubscription.endDate).toLocaleDateString()})</span>
        )}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Supabase Subscription:</strong> {supabaseSubscription?.status || 'Not checked'}
        {supabaseSubscription?.endDate && (
          <span> (until {new Date(supabaseSubscription.endDate).toLocaleDateString()})</span>
        )}
      </div>
      
      {error && (
        <div style={{ color: 'red', marginBottom: '10px' }}>
          Error: {error}
        </div>
      )}
      
      <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
        <button 
          onClick={() => setSubscriptionStatus('free')} 
          disabled={loading}
          style={{ padding: '4px 8px' }}
        >
          Set Free
        </button>
        <button 
          onClick={() => setSubscriptionStatus('basic')} 
          disabled={loading}
          style={{ padding: '4px 8px' }}
        >
          Set Basic
        </button>
        <button 
          onClick={() => setSubscriptionStatus('pro')} 
          disabled={loading}
          style={{ padding: '4px 8px' }}
        >
          Set Pro
        </button>
      </div>
      
      <button 
        onClick={checkSupabaseSubscription} 
        disabled={loading}
        style={{ padding: '4px 8px' }}
      >
        Check Supabase
      </button>
      
      {loading && <div style={{ marginTop: '10px' }}>Loading...</div>}
    </div>
  );
};

export default SubscriptionDebugPanel;