import React from 'react';

const ProTeaserOverlay = ({ children, message = "Unlock full insights", onUpgrade }) => {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(1px)', opacity: 0.85 }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', 
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(2px)',
        borderRadius: '8px',
        padding: '16px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '10px' }}>
          {message}
        </div>
        <button 
          onClick={onUpgrade}
          style={{
            backgroundColor: '#0078d4',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
};

export default ProTeaserOverlay;
