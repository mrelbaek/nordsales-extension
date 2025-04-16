import React, { useState } from 'react';
import { PiSketchLogo } from "react-icons/pi";

/**
 * Pill badge based on subscription status
 * @param {Object} props
 * @param {string} props.status - 'free', 'pro', 'trial', 'team', etc.
 * @param {Object} props.subscription - Full subscription object with trial info
 */
const ProPill = ({ status, subscription }) => {
  const [isHovering, setIsHovering] = useState(false);

  if (!status) return null; // Don't render anything until status is known

  const isPro = status === 'pro' || status === 'team';
  const isTrial = status === 'trial';
  
  // Trial users see pro features but with a trial badge
  if (isTrial) {
    // Calculate days remaining for nice display
    const daysRemaining = subscription?.trialDaysRemaining || 0;
    
    return (
      <span
        style={{
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: '500',
          backgroundColor: '#e3f2fd', // Light blue background for trial
          color: '#0277bd', // Blue text
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap',
          transition: 'background-color 0.2s ease',
          cursor: 'default',
        }}
      >
        <PiSketchLogo size={14} color="#0277bd" />
        Trial
      </span>
    );
  }
  
  // Original logic for pro vs free/upgrade
  return isPro ? (
    <span
      style={{
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: '500',
        backgroundColor: '#fff',
        color: '#111',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        transition: 'background-color 0.2s ease',
        cursor: 'default',
      }}
    >
      <PiSketchLogo size={14} color="#21aef7" />
      Pro
    </span>
  ) : (
    <a
      href="https://buy.stripe.com/8wMg1NaB77DG5wcfYY"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: '500',
        border: '1px solid #bababa',
        color: '#000',
        backgroundColor: isHovering ? '#e3f2fd' : '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        textDecoration: 'none',
        transition: 'background-color 0.2s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <PiSketchLogo size={14} color="#21aef7" />
      Upgrade
    </a>
  );
};

export default ProPill;