import React from 'react';
import { PiCaretDownLight, PiCaretRightLight } from "react-icons/pi";

/**
 * Accordion section with toggle functionality
 * 
 * @param {Object} props - Component props
 * @param {string|React.ReactNode} props.title - Section title (string or React element)
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
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          marginRight: "10px"
        }}>
          <span style={{ 
            fontSize: "16px", 
            fontWeight: "bold", 
            paddingTop: "4px"
          }}>
            {isOpen ? <PiCaretDownLight size={20}/> : <PiCaretRightLight size={20}/>}
          </span>
        </div>
        
        {/* Handle different title types */}
        {typeof title === 'string' ? (
          <h3 style={{ 
            margin: "0", 
            fontSize: "14px", 
            flex: 1 
          }}>
            {title}
          </h3>
        ) : (
          <div style={{ 
            flex: 1, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between"
          }}>
            {title}
          </div>
        )}
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