import React from 'react';
import { summarizeActivities, getPluralLabel } from '../../utils/activityUtils';
import AccordionSection from '../common/AccordionSection';

/**
 * Statistics component displaying activity summaries
 * 
 * @param {Object} props - Component props
 * @param {Array} props.activities - Activities to summarize
 * @param {boolean} props.isOpen - Whether section is expanded
 * @param {Function} props.onToggle - Function to call when toggling section
 * @returns {JSX.Element} Statistics component
 */
const Statistics = ({ activities = [], isOpen, onToggle }) => {
  const activitySummary = summarizeActivities(activities);
  console.log('OpportunityDetail received activities:', activities);

  return (
    <AccordionSection
      title="Statistics"
      isOpen={isOpen}
      onToggle={onToggle}
    >
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
    </AccordionSection>
  );
};

export default Statistics;