import React, { useState } from 'react';
import { PiInfo } from "react-icons/pi";

/**
 * InfoIcon component that displays additional information in a tooltip or modal
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Title for the info tooltip/modal
 * @param {string} props.content - Content explaining the feature
 * @param {string} props.placement - Tooltip placement (top, bottom, left, right)
 * @returns {JSX.Element} Info icon with tooltip functionality
 */
const InfoIcon = ({ title, content, placement = "top" }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div 
      style={{ 
        display: "inline-block", 
        position: "relative",
        marginLeft: "6px",
        marginTop: "4px",
        cursor: "pointer"
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip(!showTooltip)} // Toggle on click for mobile
    >
      <PiInfo size={16} color="#666" />
      
      {showTooltip && (
        <div style={{
          position: "absolute",
          zIndex: 100,
          width: "220px",
          backgroundColor: "white",
          border: "1px solid #e0e0e0",
          borderRadius: "4px",
          padding: "10px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          [placement === "top" ? "bottom" : "top"]: "100%",
          left: placement === "right" ? "100%" : 
                placement === "left" ? "auto" : "50%",
          right: placement === "left" ? "100%" : "auto",
          transform: placement === "top" || placement === "bottom" ? 
                    "translateX(-50%)" : "none",
          marginTop: placement === "bottom" ? "8px" : 0,
          marginBottom: placement === "top" ? "8px" : 0,
          marginLeft: placement === "right" ? "8px" : 0,
          marginRight: placement === "left" ? "8px" : 0,
        }}>
          <h4 style={{ margin: "0 0 6px 0", fontSize: "12x", fontWeight: "400" }}>{title}</h4>
          <p style={{ margin: 0, fontSize: "10px", lineHeight: "1.4", fontWeight: "300", color: "#666" }}>{content}</p>
        </div>
      )}
    </div>
  );
};

export default InfoIcon;