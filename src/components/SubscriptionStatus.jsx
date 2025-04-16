import React, { useEffect } from 'react';

const SubscriptionStatus = ({ subscription }) => {
  // Log the subscription for debugging
  useEffect(() => {
  }, [subscription]);

  // Stripe customer portal URL
  const stripePortalUrl = 'https://billing.stripe.com/p/login/eVa3ce7YdeM2gYofYY';
  
  // Configure badge based on subscription tier
  let badgeLabel, badgeColors;
  const tier = subscription?.status || 'free';

  // Debug line to check what tier is being processed
  // console.log('Processing subscription tier:', tier);
  
  // Special handling for trial status
  if (tier === 'trial') {
    badgeLabel = 'Trial';
    badgeColors = {
      background: '#e3f2fd', // Light blue background
      text: '#0277bd',       // Blue text
      hover: '#29b6f6'       // Lighter blue on hover
    };
  }
  else if (tier === 'pro' || tier === 'enterprise' || tier === 'team') {
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

  // Determine if we should show trial days remaining
  const showTrialDays = tier === 'trial' && subscription?.trialDaysRemaining;

  return (
    <div>
      {/* Badge for subscription status */}
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
        {showTrialDays && (
          <span style={{ marginLeft: '4px', fontSize: '10px' }}>
            ({subscription.trialDaysRemaining} {subscription.trialDaysRemaining === 1 ? 'day' : 'days'})
          </span>
        )}
      </span>
      
      {/* Show team plan badge if applicable */}
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
      
      {/* Add upgrade link for trial users */}
      {tier === 'trial' && (
        <a
          href="https://buy.stripe.com/8wMg1NaB77DG5wcfYY"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            marginTop: '4px',
            fontSize: '10px',
            color: '#0277bd',
            textDecoration: 'none',
          }}
        >
          Upgrade to Pro
        </a>
      )}
    </div>
  );
};

export default SubscriptionStatus;