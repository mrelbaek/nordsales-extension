import React from 'react';

const SubscriptionStatus = ({ subscription }) => {
  // Stripe customer portal URL
  const stripePortalUrl = 'https://billing.stripe.com/p/login/eVa3ce7YdeM2gYofYY';
  
  // Configure badge based on subscription tier
  let badgeLabel, badgeColors;
  const tier = subscription?.status || 'free';

  if (tier === 'pro' || tier === 'enterprise') {
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
    </div>
  );
};

export default SubscriptionStatus;