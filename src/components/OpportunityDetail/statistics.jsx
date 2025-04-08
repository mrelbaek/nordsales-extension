import React from 'react';
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
  onToggle 
}) => {
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
  
  // Calculate win/loss ratio for this account
  const calculateWinLossRatio = () => {
    if (!opportunity.customerid_account || !closedOpportunities.length) {
      return { 
        ratio: 0, 
        wins: 0, 
        total: 0,
        percentChange: 0 
      };
    }
    
    // Filter closed opportunities for this account
    const accountOpportunities = closedOpportunities.filter(
      opp => opp.customerid_account && 
      opp.customerid_account.accountid === opportunity.customerid_account.accountid
    );
    
    // Count wins (statecode 1 = Won)
    const wins = accountOpportunities.filter(opp => opp.statecode === 1).length;
    const total = accountOpportunities.length;
    
    // Calculate win percentage
    const winPercentage = total > 0 ? Math.round((wins / total) * 100) : 0;
    
    // For demo purposes, simulate a change percentage
    const percentChange = 50; // +50% improvement from previous period
    
    return {
      ratio: winPercentage,
      wins,
      total,
      percentChange
    };
  };
  
  const winLossRatio = calculateWinLossRatio();

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

  return (
    <AccordionSection
      title={
        <div style={{ display: "flex", alignItems: "center" }}>
          <span>Statistics</span>
          <div style={{ marginLeft: "auto" }}>
            <InfoIcon 
              title="Opportunity Statistics" 
              content="This section provides key metrics about the opportunity, including timelines, activity tracking, and account performance indicators."
              placement="bottom"
              />
            </div>
        </div>
      }
      isOpen={isOpen}
      onToggle={onToggle}
      theme="primary"
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
        {winLossRatio.percentChange !== 0 && (
          <div style={{ 
            fontSize: "12px", 
            color: winLossRatio.percentChange > 0 ? "#4caf50" : "#f44336",
            display: "flex",
            alignItems: "center",
            marginTop: "2px"
          }}>
            {winLossRatio.percentChange > 0 ? "↑" : "↓"} {Math.abs(winLossRatio.percentChange)}% from previous period
          </div>
        )}
        
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
          fontSize: "14px", 
          fontWeight: "600", 
          marginTop: "0", 
          marginBottom: "16px",
          color: "#333"
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