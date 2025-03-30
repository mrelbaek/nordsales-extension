import React, { useState } from 'react';
import Header from '../Header';
import Statistics from './statistics';
import Calendar from './Calendar';
import Analytics from './Analytics';
import TimelineLog from './TimelineLog';
import BasicInfo from './BasicInfo';

/**
 * Opportunity detail component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.opportunity - Opportunity data
 * @param {Function} props.onBackClick - Function to call when back button is clicked
 * @param {Function} props.toggleAutoOpen - Function to call when auto-open toggle is clicked
 * @param {boolean} props.autoOpen - Whether auto-open is enabled
 * @returns {JSX.Element} Opportunity detail component
 */
const OpportunityDetail = ({ 
  opportunity, 
  onBackClick,
  toggleAutoOpen,
  autoOpen
}) => {
  const [accordionState, setAccordionState] = useState({
    statistics: true,
    entries: true,
    analytics: true,
    timeline: true
  });

  const toggleAccordion = (section) => {
    setAccordionState({
      ...accordionState,
      [section]: !accordionState[section]
    });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", overflow: "auto" }}>
      <Header
        title="Nordsales"
        showBackButton={true}
        onBackClick={onBackClick}
      />

      {/* Opportunity Name */}
      <div>
        <h3 style={{
          padding: "12px 16px 0px 16px",
          display: "flex",
          color: "#1f2223",
          fontSize: "14px",
          marginBottom: "2px"
        }}>{opportunity.name}</h3>
        
        {opportunity.createdon && (
          <div style={{ 
            marginBottom: "8px", 
            padding: "2px 16px",
            display: "flex",
            alignItems: "center",
            fontWeight: "500",
            color: "#5f646a"
          }}>
            <p>Created On:&nbsp;</p> {new Date(opportunity.createdon).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Main Content Area - Scrollable */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px 16px" }}>
        {/* Action Buttons */}
        <div style={{ 
          display: "flex", 
          gap: "10px", 
          margin: "16px 0" 
        }}>
          <button style={{ 
            flex: 1, 
            padding: "10px 0", 
            backgroundColor: "white", 
            border: "1px solid #ccc", 
            borderRadius: "6px", 
            cursor: "pointer" 
          }}>
            Save
          </button>
          <button style={{ 
            flex: 1, 
            padding: "10px 0", 
            backgroundColor: "white", 
            border: "1px solid #ccc", 
            borderRadius: "6px", 
            cursor: "pointer" 
          }}>
            Add to list
          </button>
        </div>

        {/* Statistics Section */}
        <Statistics 
          activities={opportunity.activities} 
          isOpen={accordionState.statistics}
          onToggle={() => toggleAccordion('statistics')}
        />

        {/* Calendar Section */}
        <Calendar 
          activities={opportunity.activities} 
          isOpen={accordionState.entries}
          onToggle={() => toggleAccordion('entries')}
        />

        {/* Analytics Section */}
        <Analytics 
          activities={opportunity.activities} 
          isOpen={accordionState.analytics}
          onToggle={() => toggleAccordion('analytics')}
        />

        {/* Timeline Log Section */}
        <TimelineLog 
          activities={opportunity.activities} 
          isOpen={accordionState.timeline}
          onToggle={() => toggleAccordion('timeline')}
        />

        {/* Basic Info Section */}
        <BasicInfo opportunity={opportunity} />
      </div>

      {/* Auto-open toggle */}
      <div style={{ 
        padding: "12px 16px",
        fontSize: "13px",
        borderTop: "1px solid #e0e0e0",
        backgroundColor: "white"
      }}>
        <label style={{ display: "flex", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={autoOpen}
            onChange={toggleAutoOpen}
            style={{ marginRight: "8px" }}
          />
          Auto-open when visiting Dynamics CRM
        </label>
      </div>
    </div>
  );
};

export default OpportunityDetail;