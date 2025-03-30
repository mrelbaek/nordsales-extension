import React from 'react';
import { calculateDaysSinceLastContact } from '../../utils/activityUtils';
import AccordionSection from '../common/AccordionSection';

/**
 * Analytics component for opportunity metrics
 * 
 * @param {Object} props - Component props
 * @param {Array} props.activities - Activities to analyze
 * @param {boolean} props.isOpen - Whether section is expanded
 * @param {Function} props.onToggle - Function to call when toggling section
 * @returns {JSX.Element} Analytics component
 */
const Analytics = ({ activities = [], isOpen, onToggle }) => {
  return (
    <AccordionSection
      title="Analytics"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {activities && activities.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Days Since Last Contact */}
          <div style={{ 
            backgroundColor: "#f5f5f5", 
            padding: "16px", 
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>Open</div>
            <div style={{ 
              fontSize: "28px", 
              fontWeight: "bold",
              marginBottom: "4px"
            }}>
              {calculateDaysSinceLastContact(activities)?.days || 0}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>days</div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
              {calculateDaysSinceLastContact(activities)?.days > 30 ? 
                "30 avg" : "35 avg"}
            </div>
          </div>
          
          {/* Other analytics tiles can be added here */}
          <div style={{ 
            backgroundColor: "#f5f5f5", 
            padding: "16px", 
            borderRadius: "8px" 
          }}>
            {/* Placeholder for another metric */}
          </div>
          
          <div style={{ 
            backgroundColor: "#f5f5f5", 
            padding: "16px", 
            borderRadius: "8px" 
          }}>
            {/* Placeholder for another metric */}
          </div>
          
          <div style={{ 
            backgroundColor: "#f5f5f5", 
            padding: "16px", 
            borderRadius: "8px" 
          }}>
            {/* Placeholder for another metric */}
          </div>
        </div>
      ) : (
        <p>No activities to analyze.</p>
      )}
    </AccordionSection>
  );
};

export default Analytics;