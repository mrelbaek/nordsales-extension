import React from 'react';

/**
 * Login component with Microsoft login button
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onLogin - Function to call when login button is clicked
 * @returns {JSX.Element} Login component
 */
const Login = ({ onLogin }) => {
  return (
    <div style={{ 
      flex: 1, 
      display: "flex", 
      flexDirection: "column", 
      justifyContent: "center", 
      alignItems: "center",
      padding: "20px"
    }}>
      <h2 style={{ marginBottom: "20px" }}>NordSales Extension</h2>
      <button 
        onClick={onLogin} 
        style={{ 
          padding: "10px 16px", 
          backgroundColor: "#0078d4", 
          color: "white", 
          border: "none", 
          borderRadius: "4px",
          cursor: "pointer", 
          width: "100%",
          maxWidth: "300px",
          fontSize: "14px",
          fontWeight: "bold"
        }}
      >
        Sign in with Microsoft
      </button>
    </div>
  );
};

export default Login;