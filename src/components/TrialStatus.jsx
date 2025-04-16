import React from 'react';

/**
 * Component to display trial status and remaining days
 */
const TrialStatus = ({ subscription }) => {
  // Don't render anything if not in trial
  if (!subscription?.trialActive) {
    return null;
  }
  
  // Get trial days remaining
  const daysRemaining = subscription.trialDaysRemaining || 0;
  
  // Determine color based on days remaining
  const getStatusColor = () => {
    if (daysRemaining <= 3) return '#ff9800'; // Orange for nearly expired
    return '#4caf50'; // Green for active trial
  };

  return (
    <div 
      className="trial-status-container" 
      style={{
        padding: '8px 12px',
        backgroundColor: getStatusColor(),
        color: 'white',
        borderRadius: '4px',
        margin: '8px 0',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <div>
        <span style={{ fontWeight: 'bold' }}>
          Trial Active: 
        </span>
        {' '}
        {subscription.message || `Expires in ${daysRemaining} days`}
      </div>
      
      <div 
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}
      >
        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
      </div>
    </div>
  );
};

export default TrialStatus;