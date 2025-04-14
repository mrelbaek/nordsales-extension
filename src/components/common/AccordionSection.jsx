import React from 'react';
import { PiCaretDownLight, PiCaretRightLight } from "react-icons/pi";

/**
 * Accordion section with toggle functionality - using only inline styles
 * with improved title handling for both string and complex content
 * 
 * @param {Object} props - Component props
 * @param {string|React.ReactNode} props.title - Section title (string or React element)
 * @param {boolean} props.isOpen - Whether section is expanded
 * @param {Function} props.onToggle - Function to call when toggling section
 * @param {React.ReactNode} props.children - Section content
 * @param {React.ReactNode} props.rightElement - Optional element to display on the right side of the header
 * @returns {JSX.Element} Accordion section component
 */
const AccordionSection = ({ title, isOpen, onToggle, children, rightElement }) => {
  return (
    <div style={{ 
      marginBottom: "8px", 
      backgroundColor: "white", 
      borderRadius: "8px", 
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
      border: "1px solid #e0e0e0"
    }}>
      <div 
        onClick={onToggle} 
        style={{ 
          padding: "14px 16px", 
          cursor: "pointer", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          borderBottom: isOpen ? "1px solid #f0f0f0" : "none",
          backgroundColor: isOpen ? "#fafafa" : "white"
        }}
      >
        {/* Left side with title and caret */}
        <div style={{
          display: "flex",
          alignItems: "center",
          flex: 1
        }}>
          {/* Icon indicator */}
          <div style={{ 
            marginRight: "10px",
            color: "#6b7c93"
          }}>
            {isOpen ? <PiCaretDownLight size={16}/> : <PiCaretRightLight size={16}/>}
          </div>
          
          {/* Title section */}
          {typeof title === 'string' ? (
            <h3 style={{ 
              margin: "0", 
              fontSize: "14px",
              fontWeight: "600",
              color: "#32325d"
            }}>
              {title}
            </h3>
          ) : (
            <div>
              {title}
            </div>
          )}
        </div>
        
        {/* Right element (if provided) */}
        {rightElement && (
          <div style={{ marginLeft: "12px" }}>
            {rightElement}
          </div>
        )}
      </div>
      
      {/* Content section */}
      {isOpen && (
        <div style={{ padding: "16px" }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default AccordionSection;