import React from 'react';
import { calculateDaysBetween } from '../../utils/dateUtils';
import { getActivityDate, getActivityRecencyLabel, getLatestActivityDate } from '../../utils/activityUtils';

/**
 * Card component for displaying an opportunity in the list
 * 
 * @param {Object} props - Component props
 * @param {Object} props.opportunity - Opportunity data
 * @param {Function} props.onClick - Function to call when card is clicked
 * @returns {JSX.Element} Opportunity card component
 */
const OpportunityCard = ({ opportunity, onClick }) => {
  // Ensure activities is an array and fallback to empty array
  const activities = Array.isArray(opportunity?.activities) 
    ? opportunity.activities 
    : [];

  // Calculate days open
  const daysOpen = calculateDaysBetween(opportunity.createdon, null);
  
  // Calculate days until close with allowNegative=true to handle past dates
  const daysUntilClose = opportunity.estimatedclosedate ? 
    calculateDaysBetween(new Date(), opportunity.estimatedclosedate, true) : null;
  
  // Is the opportunity past due?
  const isPastDue = daysUntilClose !== null && daysUntilClose < 0;
  
  // Get absolute value for display but keep the sign for visual indicators
  const daysUntilCloseAbs = daysUntilClose !== null ? Math.abs(daysUntilClose) : null;
  
  // Calculate days since last activity
  const latestActivityDate = getLatestActivityDate(opportunity);
  const lastActivityDays = latestActivityDate ? 
    calculateDaysBetween(latestActivityDate, new Date()) : null;
  const activityLabel = getActivityRecencyLabel(lastActivityDays);
  
  // Get the last 8 weeks of activities
  const getActivityBars = () => {
    // Existing implementation
    // ...
    const weeks = 8;
    const weeklyCounts = Array(weeks).fill(0);
    
    // Ensure activities is an array and exists
    const safeActivities = Array.isArray(activities) ? activities : [];
  
    if (safeActivities.length > 0) {
      const now = new Date();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      
      safeActivities.forEach((activity, index) => {
        if (!activity) {
          console.warn(`🚨 Null activity at index ${index}`);
          return;
        }
        
        // Safely get the activity date
        let date = null;
        try {
          date = getActivityDate(activity);
        } catch (err) {
          console.warn(`🚨 Error getting date for activity ${index}:`, err);
          return;
        }
  
        // Ignore if date is missing or invalid
        if (!date || isNaN(date)) {
          console.warn(`🚨 Invalid date for activity ${index}:`, activity);
          return;
        }
        
        const weeksDiff = Math.floor((now - date) / msPerWeek);
        
        if (weeksDiff >= 0 && weeksDiff < weeks) {
          weeklyCounts[weeksDiff]++;
        }
      });
    } else {
      console.warn('🚨 No activities or empty activities array', opportunity);
    }
    
    // Find max for scaling
    const maxCount = Math.max(...weeklyCounts, 1);
    
    // Color function
    const getColor = (count) => {
      if (count === 0) return "#ebedf0";
      
      const level = Math.min(Math.ceil((count / maxCount) * 4), 4);
      switch (level) {
        case 1: return "#c6e48b";
        case 2: return "#7bc96f";
        case 3: return "#239a3b";
        case 4: return "#196127";
        default: return "#ebedf0";
      }
    };
    
    // Render the weekly bars
    return weeklyCounts.map((count, index) => (
      <div 
        key={`week-${index}`}
        title={`${count} ${count === 1 ? 'activity' : 'activities'} ${index === 0 ? 'this week' : `${index} week${index !== 1 ? 's' : ''} ago`}`}
        style={{
          flex: 1,
          height: "24px",
          backgroundColor: getColor(count),
          borderRadius: "2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {count > 0 && (
          <span style={{
            fontSize: "10px",
            fontWeight: "bold",
            color: count > (maxCount / 2) ? "#fff" : "#333"
          }}>
            {count}
          </span>
        )}
      </div>
    )).reverse(); // Reverse to show oldest to newest (left to right)
  };

  return (
    <div 
      style={{ 
        padding: "14px 16px 14px 16px", 
        marginBottom: "12px", 
        border: `1px solidrgb(200, 200, 200)`,
        backgroundColor: "white",
        borderRadius: "8px",
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
        e.currentTarget.style.borderLeft = `1px solidrgba(165, 165, 165, 0.80)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
        e.currentTarget.style.borderLeft = `0px solid #cccccc`;
      }}
      onClick={onClick}
    >
      {/* Opportunity Name */}
      <div style={{ 
        marginBottom: "8px", 
        fontSize: "12px",
        color: "#1f2223",
        fontWeight: "600",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <span>{opportunity.name}</span>
      </div>
      
      {/* Customer and Value Row */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        marginBottom: "12px",
        fontSize: "12px",
        fontWeight: "500",
        color: "#5f646a"
      }}>
        <div>
          {opportunity.customerid_account && (
            <span>{opportunity.customerid_account.name}</span>
          )}
        </div>
        <div style={{ fontWeight: "500" }}>
          {opportunity.estimatedvalue ? 
            `$${opportunity.estimatedvalue.toLocaleString()}` : "No est. value"}
        </div>
      </div>
      
      {/* Timeline Indicators */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "12px", gap: "12px" }}>
        {/* Days Open Indicator */}
        <div style={{ 
          flex: 1,
          backgroundColor: "#f5f5f5", 
          borderRadius: "4px",
          padding: "8px 12px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <div style={{ fontSize: "12px", color: "#555" }}>Open days</div>
            <div style={{ fontSize: "14px", fontWeight: "bold" }}>{daysOpen}</div>
          </div>
          
          {/* Progress bar - shows fill based on days open (capped at 90 days) */}
          <div style={{ 
            height: "4px", 
            backgroundColor: "#e0e0e0", 
            borderRadius: "2px", 
            overflow: "hidden" 
          }}>
            <div style={{ 
              height: "100%", 
              width: `${Math.min(daysOpen / 90 * 100, 100)}%`, 
              backgroundColor: daysOpen > 60 ? "#f44336" : daysOpen > 30 ? "#ff9800" : "#2196f3",
              borderRadius: "2px"
            }}></div>
          </div>
        </div>
        
        {/* Days Until Close Indicator - With special handling for past due */}
        <div style={{ 
          flex: 1,
          backgroundColor: isPastDue ? "#ffebee" : "#f5f5f5", 
          borderRadius: "4px",
          padding: "8px 12px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <div style={{ fontSize: "12px", color: isPastDue ? "#d32f2f" : "#555" }}>
              {isPastDue ? "Days past due" : "Days to close"}
            </div>
            <div style={{ 
              fontSize: "14px", 
              fontWeight: "bold",
              color: isPastDue ? "#d32f2f" : "inherit"
            }}>
              {daysUntilClose !== null ? 
                // Add a minus sign for past due display
                `${isPastDue ? '-' : ''}${daysUntilCloseAbs}` : 
                "—"}
            </div>
          </div>
          
          {/* Progress bar - with special handling for past due */}
          {daysUntilClose !== null && (
            <div style={{ 
              height: "4px", 
              backgroundColor: "#e0e0e0", 
              borderRadius: "2px", 
              overflow: "hidden" 
            }}>
              {isPastDue ? (
                // Past due - Show how far past due (capped at 60 days)
                <div style={{ 
                  height: "100%", 
                  width: `${Math.min(daysUntilCloseAbs / 60 * 100, 100)}%`, 
                  backgroundColor: "#f44336",
                  borderRadius: "2px"
                }}></div>
              ) : (
                // Not past due - Show countdown (inverse fill - less days = more filled)
                <div style={{ 
                  height: "100%", 
                  width: `${Math.max(100 - (daysUntilClose / 30 * 100), 0)}%`, 
                  backgroundColor: daysUntilClose < 7 ? "#f44336" : daysUntilClose < 15 ? "#ff9800" : "#4caf50",
                  borderRadius: "2px"
                }}></div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Weekly Activity Summary */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        marginBottom: "8px",
        gap: "4px"
      }}>
        <div style={{ fontSize: "12px", color: "#555", marginRight: "8px" }}>
          Activity:
        </div>
        
        {/* Simple Weekly Activity Bars */}
        <div style={{ 
          flex: 1, 
          display: "flex", 
          gap: "4px", 
          height: "24px", 
          alignItems: "center"
        }}>
          {getActivityBars()}
        </div>
        
        {/* Activity Recency Label */}
        <div style={{ 
          display: "inline-block",
          backgroundColor: `${activityLabel.color}20`, // Using 20% opacity of the color
          color: activityLabel.color,
          padding: "3px 8px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: "500",
          marginLeft: "8px"
        }}>
          {activityLabel.text}
        </div>
      </div>
    </div>
  );
};

export default OpportunityCard;