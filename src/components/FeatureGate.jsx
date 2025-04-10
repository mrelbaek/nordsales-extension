import React, { useState, useEffect } from 'react';
import { hasFeatureAccess, getSubscriptionStatus, openPaymentDialog } from '../utils/subscriptions';
import { PiLockLight, PiCrownLight } from "react-icons/pi";

/**
 * Component to gate features based on subscription status
 * 
 * @param {Object} props - Component props
 * @param {string} props.featureName - Name of the feature to check
 * @param {React.ReactNode} props.children - Content to render if user has access
 * @param {string} props.fallbackMessage - Message to show if user doesn't have access
 * @returns {JSX.Element} Feature gate component
 */
const FeatureGate = ({ featureName, children, fallbackMessage }) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);

  // Check feature access on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const access = await hasFeatureAccess(featureName);
        setHasAccess(access);
        
        // Load subscription data for upgrade prompt
        const status = await getSubscriptionStatus();
        setSubscription(status);
      } catch (error) {
        console.error(`Error checking access for ${featureName}:`, error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [featureName]);

  // Handle upgrade button click
  const handleUpgrade = async () => {
    try {
      await openPaymentDialog();
      
      // Recheck access after upgrade attempt
      const access = await hasFeatureAccess(featureName);
      setHasAccess(access);
      
      // Refresh subscription data
      const status = await getSubscriptionStatus();
      setSubscription(status);
    } catch (error) {
      console.error("Error during upgrade:", error);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  // If user has access, render children
  if (hasAccess) {
    return children;
  }

  // Get appropriate message for upsell
  const message = fallbackMessage || 'This feature requires a Pro subscription';
  const isTrialing = subscription?.subscriptionStatus === 'trialing';
  const upgradeLabel = isTrialing ? 'Upgrade Now' : 'Upgrade to Pro';

  // Render feature locked message with upgrade option
  return (
    <div style={{
      padding: '24px',
      textAlign: 'center',
      backgroundColor: '#f9f9f9',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
    }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <PiLockLight size={24} color="#666" />
        </div>
        
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>
          Pro Feature
        </h3>
        
        <p style={{ margin: 0, fontSize: '14px', color: '#666', maxWidth: '300px' }}>
          {message}
        </p>
        
        {isTrialing && (
          <p style={{ margin: 0, fontSize: '14px', color: '#40916c', maxWidth: '300px' }}>
            <PiCrownLight style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            You're currently in your Pro trial period
          </p>
        )}
        
        <button
          onClick={handleUpgrade}
          style={{
            backgroundColor: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            marginTop: '8px',
          }}
        >
          {upgradeLabel}
        </button>
      </div>
    </div>
  );
};

export default FeatureGate;