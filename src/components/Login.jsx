import React from 'react';
import { PiIntersect } from 'react-icons/pi';

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
      {/* Logo and title in a row */}
      <div style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        marginBottom: "10px"
      }}>
        <PiIntersect size={25} style={{ marginRight: "10px" }} />
        <h2 style={{ 
          fontFamily: "'Parkinsans', sans-serif",
          fontWeight: 600,
          margin: 0, // Remove default margin
          fontSize: "24px"
        }}>Lens</h2>
      </div>
      
      {/* "By NordCFO" in gray */}
      <p style={{ 
        marginBottom: "20px", 
        fontFamily: "Arial, sans-serif",
        color: "#666666" // Medium gray color
      }}>By NordCFO</p>
      
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