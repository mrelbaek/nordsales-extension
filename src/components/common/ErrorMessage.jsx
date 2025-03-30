import React from 'react';

/**
 * Error message component with dismiss button
 * 
 * @param {Object} props - Component props
 * @param {string} props.message - Error message to display
 * @param {Function} props.onDismiss - Function to call when dismiss button is clicked
 * @returns {JSX.Element|null} Error message component or null if no message
 */
const ErrorMessage = ({ message, onDismiss }) => {
  if (!message) return null;
  
  return (
    <div style={{ 
      padding: "8px", 
      backgroundColor: "#f3f2f1", 
      color: "#c62828", 
      borderRadius: "4px", 
      margin: "8px",
      position: "relative"
    }}>
      <button 
        onClick={onDismiss}
        style={{
          position: "absolute",
          top: "2px",
          right: "2px",
          background: "none",
          border: "none",
          fontSize: "16px",
          cursor: "pointer",
          color: "#c62828",
        }}
      >
        ×
      </button>
      <div style={{ marginBottom: "4px" }}>
        <strong>Error:</strong> {message}
      </div>
    </div>
  );
};

export default ErrorMessage;