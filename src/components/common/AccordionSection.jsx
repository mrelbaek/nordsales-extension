import React from 'react';

/**
 * Accordion section with toggle functionality
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Section title
 * @param {boolean} props.isOpen - Whether section is expanded
 * @param {Function} props.onToggle - Function to call when toggling section
 * @param {React.ReactNode} props.children - Section content
 * @returns {JSX.Element} Accordion section component
 */
const AccordionSection = ({ title, isOpen, onToggle, children }) => {
  return (
    <div style={{ marginBottom: "16px", backgroundColor: "white", borderRadius: "8px", overflow: "hidden" }}>
      <div 
        onClick={onToggle} 
        style={{ 
          padding: "12px 16px", 
          cursor: "pointer", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          borderBottom: isOpen ? "1px solid #e0e0e0" : "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ marginRight: "8px" }}>{isOpen ? "▼" : "►"}</span>
          <h3 style={{ margin: "0", fontSize: "16px" }}>{title}</h3>
        </div>
      </div>
      
      {isOpen && (
        <div style={{ padding: "16px" }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default AccordionSection;