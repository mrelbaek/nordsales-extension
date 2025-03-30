import React from 'react';

/**
 * Creates a header element with consistent styling
 * 
 * @param {Object} options - Header options
 * @param {string} options.title - The title to display in the header
 * @param {boolean} options.showBackButton - Whether to show the back button
 * @param {Function} options.onBackClick - Function to call when back button is clicked
 * @param {Function} options.onMenuClick - Function to call when menu button is clicked
 * @param {Function} options.onSettingsClick - Function to call when settings button is clicked
 * @returns {JSX.Element} The header element
 */
const Header = ({
  title = "Nordsales",
  showBackButton = true,
  onBackClick = () => {},
  onMenuClick = () => {},
  onSettingsClick = () => {}
}) => {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", overflow: "auto" }}>
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
            onClick={onMenuClick}
            style={{
              background: "none",
              border: "none",
              fontSize: "18px",
              cursor: "pointer"
            }}
          >
            ☰
          </button>
          <span style={{ fontSize: "16px", fontWeight: "500", letterSpacing: "-0.5px" }}>
            {title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button 
            onClick={onSettingsClick}
            style={{
              background: "none",
              border: "none",
              fontSize: "18px",
              cursor: "pointer"
            }}
          >
            ⚙
          </button>
          {showBackButton && (
            <button 
              onClick={onBackClick} 
              style={{  
                background: "none", 
                border: "none", 
                cursor: "pointer", 
                fontSize: "18px"
              }}
            >
              x
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;