import React, { useState } from 'react';
import { PiSketchLogo } from "react-icons/pi";

/**
 * Pill badge based on subscription status
 * @param {Object} props
 * @param {string} props.status - 'free', 'pro', etc.
 */
const ProPill = ({ status }) => {
  const [isHovering, setIsHovering] = useState(false);

  if (!status) return null; // Don't render anything until status is known

  const isPro = status === 'pro' || status === 'team';

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
