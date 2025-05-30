import React, { useState } from 'react';
import Header from '../Header';
import Statistics from './statistics';
import Calendar from './Calendar';
import Analytics from './Analytics';
import TimelineLog from './TimelineLog';
import BasicInfo from './BasicInfo';
import SubscriptionStatus from '../SubscriptionStatus';
import ProPill from '../common/ProPill';
import FeatureGate from '../FeatureGate';



/**
 * Opportunity detail component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.opportunity - Opportunity data
 * @param {Array} props.activities - Activities data
 * @param {Array} props.closedOpportunities - Closed opportunities data
 * @param {Function} props.onBackClick - Function to call when back button is clicked
 * @param {Function} props.toggleAutoOpen - Function to call when auto-open toggle is clicked
 * @param {boolean} props.autoOpen - Whether auto-open is enabled
 * @returns {JSX.Element} Opportunity detail component
 */
const OpportunityDetail = ({ 
  opportunity, 
  activities,
  closedOpportunities = [],
  onBackClick,
  onLogout,
  isLoggingOut,
  toggleAutoOpen,
  autoOpen,
  subscription
}) => {
  const [accordionState, setAccordionState] = useState({
    statistics: true,
    entries: true,
    analytics: true,
    basicInfo: false,
    timeline: false
  });

  const toggleAccordion = (section) => {
    setAccordionState({
      ...accordionState,
      [section]: !accordionState[section]
    });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", overflow: "auto", backgroundColor: "#ededed" }}>
      {/* Header */}
      <Header
        title="Lens"
        showBackButton={true}
        onBackClick={onBackClick}
        onLogout={onLogout}
        isLoggingOut={isLoggingOut}
        subscription={subscription}
      />

      {/* Opportunity Name */}
      <div>
        <h4 style={{
          padding: "0px 16px 0px 16px",
          display: "flex",
          color: "#1f2223",
          fontSize: "14px",
          marginBottom: "2px"
        }}>{opportunity.name}</h4>
        
        {opportunity.createdon && (
          <div style={{ 
            marginBottom: "8px", 
            padding: "2px 16px",
            display: "flex",
            alignItems: "center",
            fontWeight: "500",
            color: "#5f646a"
          }}>
            <p>Created on:&nbsp;</p> {new Date(opportunity.createdon).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Main Content Area - Scrollable */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px 16px" }}>

        {/* Statistics Section */}
        <Statistics 
          activities={activities} 
          opportunity={opportunity}
          closedOpportunities={closedOpportunities}
          isOpen={accordionState.statistics}
          onToggle={() => toggleAccordion('statistics')}
        />

        {/* Analytics Section */}
        <Analytics 
          activities={activities}
          closedOpportunities={closedOpportunities}
          opportunity={opportunity}
          isOpen={accordionState.analytics}
          onToggle={() => toggleAccordion('analytics')}
        />

        {/* Calendar Section */}
        <Calendar 
          activities={activities} 
          isOpen={accordionState.entries}
          onToggle={() => toggleAccordion('entries')}
        />

        {/* Timeline Log Section */}
        <TimelineLog 
          activities={activities} 
          isOpen={accordionState.timeline}
          onToggle={() => toggleAccordion('timeline')}
        />

        {/* Basic Info Section */}
        <BasicInfo 
          opportunity={opportunity} 
          isOpen={accordionState.basicInfo}
          onToggle={() => toggleAccordion('basicInfo')}
        />
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