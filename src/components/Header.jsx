import React, { useState, useRef, useEffect } from 'react';
import { PiGear, PiList, PiX, PiArrowsClockwise, PiUser, PiChartBar, PiHouse, PiSignOut } from "react-icons/pi";

/**
 * Creates a header element with consistent styling
 * 
 * @param {Object} options - Header options
 * @param {string} options.title - The title to display in the header
 * @param {boolean} options.showBackButton - Whether to show the back button
 * @param {Function} options.onBackClick - Function to call when back button is clicked
 * @param {Function} options.onMenuClick - Function to call when menu button is clicked
 * @param {Function} options.onSettingsClick - Function to call when settings button is clicked
 * @param {Function} props.onFetchMyOpenOpportunities - Function to fetch user's open opportunities
 * @param {Function} props.onLogout - Function to handle logout
 * @returns {JSX.Element} The header element
 */

const Header = ({
  title = "Nordsales",
  showBackButton = true,
  onBackClick = () => {},
  onMenuClick = () => {},
  onSettingsClick = () => {},
  onFetchMyOpenOpportunities = () => {},
  onLogout = () => {}
}) => {
  const [showSidebar, setShowSidebar] = useState(false);
  
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
    // Call the parent's onMenuClick if needed
    onMenuClick();
  };
  
  const handleMyOpenOpportunities = () => {
    onFetchMyOpenOpportunities();
    setShowSidebar(false); // Close sidebar after clicking
  };
  
  const handleLogout = () => {
    onLogout();
    setShowSidebar(false); // Close sidebar after clicking
  };
  
  return (
    <>
      {/* Header Bar */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        marginBottom: "4px", 
        overflow: "auto",
        position: "relative",
        zIndex: 10
      }}>
        <div style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          borderRadius: "4px",
          boxSizing: "border-box",
          justifyContent: "space-between",
          padding: "10px 12px",
          backgroundColor: "#f3f2f1",
          border: "1px solid #e0e0e0",
          fontFamily: "Segoe UI, sans-serif",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button 
              onClick={toggleSidebar}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <PiList size={20} />
            </button>
            <span style={{ fontSize: "16px", fontWeight: "500", letterSpacing: "-0.5px" }}>
              {title}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button 
              onClick={onFetchMyOpenOpportunities}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex", 
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <PiArrowsClockwise size={20} />
            </button>
            <button 
              onClick={onSettingsClick}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex", 
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <PiGear size={20} />
            </button>
            
            <button 
              onClick={handleLogout}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex", 
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <PiSignOut size={20} />
            </button>

            {showBackButton && (
              <button 
                onClick={onBackClick} 
                style={{  
                  background: "none", 
                  border: "none", 
                  cursor: "pointer",
                  display: "flex", 
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <PiX size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Overlay and Sidebar */}
      {showSidebar && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 100,
            display: "flex"
          }}
          onClick={toggleSidebar}
        >
          {/* Sidebar - stop propagation to prevent closing when clicking inside */}
          <div 
            onClick={e => e.stopPropagation()} 
            style={{
              width: "80%",
              maxWidth: "300px",
              height: "100%",
              backgroundColor: "white",
              boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Sidebar Header */}
            <div style={{ 
              padding: "20px 16px", 
              borderBottom: "1px solid #f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Nordsales</h2>
              <button 
                onClick={toggleSidebar}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex"
                }}
              >
                <PiX size={24} />
              </button>
            </div>
            
            {/* Menu Items */}
            <div style={{ flex: 1, padding: "16px" }}>
              <div 
                style={{ 
                  marginBottom: "12px", 
                  cursor: "pointer",
                  padding: "10px",
                  borderRadius: "4px",
                  backgroundColor: "#f5f5f5",
                  fontWeight: "500" 
                }}
                onClick={handleMyOpenOpportunities}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <PiArrowsClockwise size={16} />
                  My Open Opportunities
                </div>
              </div>
              
              <div 
                style={{ 
                  marginBottom: "12px", 
                  cursor: "pointer",
                  padding: "10px",
                  borderRadius: "4px",
                  fontWeight: "500",
                  transition: "background-color 0.2s",
                  hover: {
                    backgroundColor: "#f5f5f5"
                  } 
                }}
                onClick={() => {setShowSidebar(false);}}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <PiHouse size={16} />
                  Dashboard
                </div>
              </div>
              
              <div 
                style={{ 
                  marginBottom: "12px", 
                  cursor: "pointer",
                  padding: "10px",
                  borderRadius: "4px",
                  fontWeight: "500",
                  transition: "background-color 0.2s",
                  hover: {
                    backgroundColor: "#f5f5f5"
                  } 
                }}
                onClick={() => {setShowSidebar(false);}}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <PiChartBar size={16} />
                  Analytics
                </div>
              </div>
              
              <div 
                style={{ 
                  marginBottom: "12px", 
                  cursor: "pointer",
                  padding: "10px",
                  borderRadius: "4px",
                  fontWeight: "500",
                  transition: "background-color 0.2s",
                  hover: {
                    backgroundColor: "#f5f5f5"
                  } 
                }}
                onClick={() => {setShowSidebar(false);}}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <PiUser size={16} />
                  Profile
                </div>
              </div>
            </div>
            
            {/* Logout Button */}
            <div style={{ padding: "16px", borderTop: "1px solid #f0f0f0" }}>
              <button 
                onClick={handleLogout}
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "white",
                  border: "1px solid #e0e0e0",
                  borderRadius: "4px",
                  cursor: "pointer",
                  textAlign: "center"
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;