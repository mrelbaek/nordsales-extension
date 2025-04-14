import React, { useEffect } from 'react';

const SubscriptionStatus = ({ subscription }) => {
  // Log the subscription for debugging
  useEffect(() => {
    console.log('SubscriptionStatus component received subscription:', subscription);
  }, [subscription]);

  // Stripe customer portal URL
  const stripePortalUrl = 'https://billing.stripe.com/p/login/eVa3ce7YdeM2gYofYY';
  
  // Configure badge based on subscription tier
  let badgeLabel, badgeColors;
  const tier = subscription?.status || 'free';

  // Debug line to check what tier is being processed
  console.log('Processing subscription tier:', tier);

  if (tier === 'pro' || tier === 'enterprise' || tier === 'team') {
    badgeLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    badgeColors = {
      background: '#111111',
      text: '#FFFFFF',
      hover: '#333333'
    };
  } else if (tier === 'basic') {
    badgeLabel = 'Basic';
    badgeColors = {
      background: '#444444',
      text: '#FFFFFF',
      hover: '#555555'
    };
  } else {
    // Free users
    badgeLabel = 'Free';
    badgeColors = {
      background: '#666666',
      text: '#FFFFFF',
      hover: '#777777'
    };
  }

  return (
    <div>
      <span
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '500',
          backgroundColor: badgeColors.background,
          color: badgeColors.text,
          marginRight: '8px'
        }}
      >
        {badgeLabel}
      </span>
      {subscription?.isOrgSubscription && (
        <span
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: '20px',
            fontSize: '10px',
            backgroundColor: '#0078d4',
            color: '#FFFFFF',
          }}
        >
          Team Plan
        </span>
      )}
    </div>
  );
};

export default SubscriptionStatus;