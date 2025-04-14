import React, { useState, useEffect } from 'react';
import { hasFeatureAccess, getSubscriptionStatus } from '../utils/subscriptions';
import { PiLockLight, PiCrownLight } from "react-icons/pi";

/**
 * Component to gate features based on subscription status
 * 
 * @param {Object} props
 * @param {string} props.featureName - Name of the feature to check
 * @param {React.ReactNode} props.children - Full content to render if access is granted
 * @param {string} [props.fallbackMessage] - Message to show if locked
 * @param {React.ReactNode} [props.teaseComponent] - Teaser version of content if access is denied
 * @param {Object} [props.subscription] - Optional subscription object (can be passed from parent)
 * @param {string} [props.subscriptionStatus] - Optional override for status check
 * @returns {JSX.Element}
 */
const FeatureGate = ({
  featureName,
  children,
  fallbackMessage,
  teaseComponent,
  subscription: externalSub,
  subscriptionStatus
}) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Log what we're using to check access to help debug
        console.log(`[FeatureGate] Checking access for ${featureName}`, {
          externalSub,
          subscriptionStatus
        });
        
        const sub = externalSub || await getSubscriptionStatus();
        setSubscription(sub);
        
        // Determine which status to use for access check
        const statusToCheck = subscriptionStatus || (sub && sub.status) || 'free';
        console.log(`[FeatureGate] Using status for access check:`, statusToCheck);
        
        const access = hasFeatureAccess(featureName, statusToCheck);
        console.log(`[FeatureGate] Access result:`, access);
        setHasAccess(access);
      } catch (error) {
        console.error(`Error checking access for ${featureName}:`, error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [featureName, externalSub, subscriptionStatus]);

  // Show loading state
  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }
  
  // Add debug info to help diagnose issues
  console.log(`[FeatureGate] Render state for ${featureName}:`, {
    hasAccess,
    subscriptionStatus: subscriptionStatus || (subscription && subscription.status) || 'unknown',
    loading
  });

  // ✅ Full access
  if (hasAccess) {
    return children;
  }

  // 👀 Tease mode
  if (teaseComponent) {
    return (
      <div style={{ position: 'relative' }}>
        {teaseComponent}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(2px)',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '13px',
            fontWeight: '500',
            color: '#333',
            textAlign: 'center',
            padding: '12px'
          }}
        >
          Upgrade to Pro to unlock full insights
        </div>
      </div>
    );
  }

  // ❌ No access and no teaser: fallback display
  const message = fallbackMessage || 'This feature requires a Pro subscription';
  const isTrialing = subscription?.status === 'trialing';

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
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#40916c',
            maxWidth: '300px'
          }}>
            <PiCrownLight style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            You're currently in your Pro trial period
          </p>
        )}
      </div>
    </div>
  );
};

export default FeatureGate;