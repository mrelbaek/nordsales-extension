import React, { useEffect, useState } from "react";
import { summarizeActivities, getPluralLabel, calculateDaysSinceLastContact } from '../../utils/activityUtils';
import { calculateDaysBetween } from '../../utils/dateUtils';
import AccordionSection from '../common/AccordionSection';
import InfoIcon from '../common/InfoIcon';

/**
 * Enhanced Statistics component with pill-style metrics
 * 
 * @param {Object} props - Component props
 * @param {Array} props.activities - Activities to summarize
 * @param {Object} props.opportunity - Current opportunity
 * @param {Array} props.closedOpportunities - Closed opportunities for this account
 * @param {boolean} props.isOpen - Whether section is expanded
 * @param {Function} props.onToggle - Function to call when toggling section
 * @returns {JSX.Element} Statistics component
 */
const Statistics = ({ 
  activities = [], 
  opportunity = {}, 
  closedOpportunities = [],
  isOpen, 
  onToggle,
  subscription
}) => {
  // Initialize state for win/loss ratio
  const [winLossRatio, setWinLossRatio] = useState({
    ratio: 0,
    wins: 0,
    total: 0,
    percentChange: 0
  });

  const activitySummary = summarizeActivities(activities);
  
  // Calculate days open
  const daysOpen = opportunity.createdon ? 
    calculateDaysBetween(opportunity.createdon, new Date()) : 0;
  
  // Calculate days until closing
  const daysUntilClose = opportunity.estimatedclosedate ? 
    calculateDaysBetween(new Date(), opportunity.estimatedclosedate) : null;
  
  // Calculate days since last contact
  const daysSinceLastContact = calculateDaysSinceLastContact(activities)?.days || 0;
  
  // Get opportunity probability (or default to 0)
  const probability = opportunity.closeprobability || 0;
  
  // Calculate win/loss ratio for this account when data changes
  useEffect(() => {
    // Extract the account ID (with a delay if necessary)
    const calculateWinLossRatio = () => {
      const accountId = opportunity?._customerid_value;

      console.log("[statistics] Current opportunity:", opportunity);
      console.log("[statistics] Account ID from opportunity:", accountId);
      console.log("[statistics] Closed opportunities count:", closedOpportunities.length);
      
      // Debug the first few closed opportunities
      if (closedOpportunities.length > 0) {
        console.log("[statistics] First closed opportunity sample:", closedOpportunities[0]);
        // Log all properties of the first opportunity to see structure
        console.log("[statistics] All properties of first closed opportunity:");
        Object.keys(closedOpportunities[0]).forEach(key => {
          console.log(`${key}: ${closedOpportunities[0][key]}`);
        });
      }
      
      if (!accountId || !closedOpportunities.length) {
        console.log("[statistics] Skipping calculation: Missing account ID or closed opportunities");
        return;
      }

      // Check for case sensitivity or trailing/leading spaces issues
      const normalizedAccountId = accountId.trim().toLowerCase();
      console.log("[statistics] Normalized account ID:", normalizedAccountId);
      
      // Try different approaches to match the account ID
      const accountOpportunities = closedOpportunities.filter(opp => {
        // Try multiple possible account ID properties and formats
        const oppAccountId = opp._customerid_value || 
                            opp.customerid_value ||
                            opp.parentaccountid;
        
        // Normalize the opportunity account ID for comparison
        const normalizedOppAccountId = oppAccountId ? oppAccountId.trim().toLowerCase() : '';
        
        // Check for partial matches
        const exactMatch = normalizedOppAccountId === normalizedAccountId;
        const partialMatch = normalizedOppAccountId.includes(normalizedAccountId) || 
                           normalizedAccountId.includes(normalizedOppAccountId);
        
        console.log("[statistics] Comparing account IDs:", {
          "current": normalizedAccountId,
          "closed opp": normalizedOppAccountId,
          "exact match": exactMatch,
          "partial match": partialMatch
        });
        
        // Use either exact match or partial match for debugging
        return exactMatch;
      });
    
      console.log("[statistics] Filtered opportunities for account:", accountOpportunities.length);
      
      if (accountOpportunities.length === 0) {
        console.log("[statistics] No matches found. Trying alternate approach with more flexible matching...");
        
        // For debugging: Print all closed opportunity account IDs to compare
        console.log("[statistics] All closed opportunity account IDs:");
        closedOpportunities.forEach((opp, index) => {
          // First, log all keys in this opportunity
          const allKeys = Object.keys(opp);
          
          // Try to find any keys that might contain "customer" or "account"
          const possibleAccountKeys = allKeys.filter(key => 
            key.toLowerCase().includes('customer') || 
            key.toLowerCase().includes('account')
          );
          
          console.log(`Opp ${index}:`, {
            "ID": opp.opportunityid,
            "Name": opp.name,
            "All Keys": allKeys,
            "Possible Account Keys": possibleAccountKeys,
            "Values of Possible Account Keys": possibleAccountKeys.map(key => `${key}: ${opp[key]}`),
            "State": opp.statecode
          });
        });
      }
      
      // Count wins (statecode 1 = Won)
      const wins = accountOpportunities.filter(opp => {
        console.log("[statistics] Checking win status:", {
          "opp.statecode": opp.statecode,
          "isWon": opp.statecode === 1
        });
        return opp.statecode === 1;
      }).length;
      
      const total = accountOpportunities.length;
      
      // Calculate win percentage
      const winPercentage = total > 0 ? Math.round((wins / total) * 100) : 0;
      
      console.log("[statistics] Win/Loss calculation result:", {
        ratio: winPercentage,
        wins,
        total
      });
      
      // Update state with new calculation
      setWinLossRatio({
        ratio: winPercentage,
        wins,
        total,
        percentChange: 50 // Placeholder for now
      });
    };

    // Initial calculation
    calculateWinLossRatio();
    
    // If data isn't available immediately, try again after a short delay
    const delayedCalculation = setTimeout(() => {
      if (winLossRatio.total === 0 && opportunity?._customerid_value) {
        console.log("[statistics] Retry calculation after delay");
        calculateWinLossRatio();
      }
    }, 1000);
    
    // Clean up timeout on unmount
    return () => clearTimeout(delayedCalculation);
  }, [opportunity, closedOpportunities]);

  // Pill-style metric component
  const MetricPill = ({ label, value, unit = "", progressColor = "#4caf50", progressPercent = 50 }) => (
    <div style={{ 
      backgroundColor: "#f5f5f5", 
      borderRadius: "8px",
      padding: "12px 16px",
      marginBottom: "16px",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "8px"
      }}>
        <div style={{ fontSize: "13px", color: "#666" }}>{label}</div>
        <div style={{ fontSize: "20px", fontWeight: "bold" }}>
          {value}{unit}
        </div>
      </div>
      
      {/* Progress bar */}
      <div style={{ 
        height: "4px", 
        backgroundColor: "#e0e0e0", 
        borderRadius: "2px", 
        overflow: "hidden" 
      }}>
        <div style={{ 
          height: "100%", 
          width: `${Math.min(progressPercent, 100)}%`, 
          backgroundColor: progressColor,
          borderRadius: "2px"
        }}></div>
      </div>
    </div>
  );

  // Component for subscription status pill (if provided)
  const ProPill = ({ status }) => (
    <div style={{
      backgroundColor: status === 'pro' ? "#f0f8ff" : "#f5f5f5",
      color: status === 'pro' ? "#0078d4" : "#666",
      padding: "2px 6px",
      borderRadius: "4px",
      fontSize: "10px",
      fontWeight: "bold",
      textTransform: "uppercase"
    }}>
      {status}
    </div>
  );

  return (
    <AccordionSection
      title="Statistics"
      rightElement={subscription?.status && <ProPill status={subscription.status} />}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {/* Key Metrics Section with Pill Style */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 1fr", 
        gap: "8px",
        marginBottom: "16px" 
      }}>
        {/* Days Open */}
        <MetricPill 
          label="Open days" 
          value={daysOpen}
          progressColor="#2196f3"
          progressPercent={Math.min(daysOpen / 90 * 100, 100)} // Cap at 90 days
        />
        
        {/* Days To Close */}
        <MetricPill 
          label="Days to close" 
          value={daysUntilClose !== null ? daysUntilClose : "—"}
          progressColor="#4caf50"
          progressPercent={daysUntilClose ? Math.max(100 - (daysUntilClose / 30 * 100), 0) : 0} // Inverse for urgency
        />
        
        {/* Days Since Last Contact */}
        <MetricPill 
          label="Days since activity" 
          value={daysSinceLastContact}
          progressColor={daysSinceLastContact > 14 ? "#f44336" : daysSinceLastContact > 7 ? "#ff9800" : "#4caf50"}
          progressPercent={Math.min(daysSinceLastContact / 30 * 100, 100)} // Cap at 30 days
        />
        
        {/* Probability */}
        <MetricPill 
          label="Probability" 
          value={probability}
          unit="%"
          progressColor="#9c27b0"
          progressPercent={probability}
        />
      </div>
      
      {/* Account Win Rate Card */}
      <div style={{ 
        backgroundColor: "#f5f5f5", 
        borderRadius: "8px",
        padding: "12px 16px",
        marginBottom: "24px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between",
          alignItems: "flex-start"
        }}>
          <div style={{ fontSize: "13px", color: "#666" }}>Account Win Rate</div>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>
            {winLossRatio.ratio}%
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
          Won {winLossRatio.wins} of {winLossRatio.total} opportunities
        </div>
        
        {/* Progress bar */}
        <div style={{ 
          height: "4px", 
          backgroundColor: "#e0e0e0", 
          borderRadius: "2px", 
          overflow: "hidden",
          marginTop: "8px" 
        }}>
          <div style={{ 
            height: "100%", 
            width: `${winLossRatio.ratio}%`, 
            backgroundColor: "#ff9800",
            borderRadius: "2px"
          }}></div>
        </div>
      </div>
      
      {/* Activity Summary Section */}
      <div>
        <h4 style={{ 
          fontSize: "13px", 
          fontWeight: "600", 
          marginTop: "0", 
          marginBottom: "16px",
          color: "#32325d"
        }}>
          Activity Summary
        </h4>
        
        {activities && activities.length > 0 ? (
          <div>
            {activitySummary.map((stat, index) => (
              <div 
                key={index} 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  marginBottom: "12px"
                }}
              >
                <div style={{ 
                  width: "24px", 
                  height: "24px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  marginRight: "12px",
                  fontSize: "16px"
                }}>
                  {stat.icon}
                </div>
                <div style={{ flex: 1 }}>
                  {stat.count} {getPluralLabel(stat.label, stat.count)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No activities recorded yet.</p>
        )}
      </div>
    </AccordionSection>
  );
};

export default Statistics;