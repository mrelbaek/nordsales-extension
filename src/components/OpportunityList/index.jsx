import React, { useState } from 'react';
import Header from '../Header';
import OpportunityCard from './OpportunityCard';
import ListAnalytics from './Analytics'; 
import SalesCycleChart from './SalesCycleChart';
import AccordionSection from '../common/AccordionSection';
import WinRate from './WinRate';
import UserActivityChart from './UserActivityChart';
import WonLostChart from './WonLostChart';

/**
 * Opportunity list component
 * 
 * @param {Object} props - Component props
 * @param {Array} props.opportunities - List of opportunities
 * @param {boolean} props.loading - Whether data is loading
 * @param {Function} props.onLogout - Function to call when logout button is clicked
 * @param {Function} props.onOpportunitySelect - Function to call when an opportunity is selected
 * @param {Array} props.closedOpportunities - Closed opportunities data
 * @param {Function} props.toggleAutoOpen - Function to call when auto-open toggle is clicked
 * @param {boolean} props.autoOpen - Whether auto-open is enabled
 * @param {Function} props.onFetchMyOpenOpportunities - Function to fetch user's open opportunities
 * @param {string} props.accessToken - Access token for API calls
 * @returns {JSX.Element} Opportunity list component
 */
const OpportunityList = ({ 
  opportunities = [], 
  loading, 
  onLogout,
  isLoggingOut, 
  onOpportunitySelect,
  closedOpportunities = [],
  toggleAutoOpen,
  autoOpen,
  onFetchMyOpenOpportunities,
  accessToken
}) => {
  const [accordionState, setAccordionState] = useState({
    analytics: true,
    salesCycle: false,
    opportunities: true,
    activities: false,
    wonLost: false
  });

  const toggleAccordion = (section) => {
    setAccordionState({
      ...accordionState,
      [section]: !accordionState[section]
    });
  };

  // Calculate opportunity statistics
  const opportunityStats = {
    total: opportunities.length,
    closing: opportunities.filter(opp => {
      const estCloseDate = opp.estimatedclosedate ? new Date(opp.estimatedclosedate) : null;
      if (!estCloseDate) return false;
      
      // Closing within next 30 days
      const today = new Date();
      const diffDays = Math.ceil((estCloseDate - today) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    }).length
  };

  // Calculate average closing time
  const averageClosingTime = closedOpportunities && closedOpportunities.length > 0 
    ? Math.round(closedOpportunities.reduce((acc, opp) => {
        const createdDate = new Date(opp.createdon);
        const closedDate = new Date(opp.actualclosedate);
        return acc + Math.floor((closedDate - createdDate) / (1000 * 60 * 60 * 24));
      }, 0) / closedOpportunities.length)
    : 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", overflow: "hidden", height: "100%", background: "#ededed" }}>
      {/* Header */}
      <Header
        title="Lens"
        showBackButton={false} 
        onLogout={onLogout}
        isLoggingOut={isLoggingOut}
        onFetchMyOpenOpportunities={onFetchMyOpenOpportunities}
      />
    
    {/* Scrollable content area */}
    <div style={{
      flex: 1,
      overflowY: "auto", // Allow this container to scroll
      paddingTop: "8px" // Add space after sticky header
    }}>

      {/* Portfolio Analytics Section */}
      <div style={{ padding: "12px 16px 0px 16px" }}>
        <AccordionSection
          title="Portfolio Analytics"
          isOpen={accordionState.analytics}
          onToggle={() => toggleAccordion('analytics')}
        >
          {/* Summary Stats */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px", justifyContent: "space-between" }}>
            {/* Open Opportunities */}
            <div style={{ 
              flex: 1,
              padding: "8px 12px", 
              borderRadius: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "#f5f5f5",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}>
              <div style={{ fontSize: "13px", color: "#666" }}>Open Opportunities</div>
              <div style={{ 
                fontSize: "20px", 
                fontWeight: "bold",
                marginLeft: "10px"
              }}>
                {opportunityStats.total}
              </div>
            </div>
            
            {/* Closing Soon */}
            <div style={{ 
              flex: 1,
              padding: "8px 12px", 
              borderRadius: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "#f5f5f5",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}>
              <div style={{ fontSize: "13px", color: "#666" }}>Closing in 30 Days</div>
              <div style={{ 
                fontSize: "20px", 
                fontWeight: "bold",
                marginLeft: "10px" 
              }}>
                {opportunityStats.closing}
              </div>
            </div>
          </div>

          {/* Win Rate Section */}
          <WinRate closedOpportunities={closedOpportunities} />
        </AccordionSection>
      </div>
      
      {/* Won/Lost Chart Section */}
      <div style={{ padding: "0 16px" }}>
        <AccordionSection
          title="Win/Loss Distribution"
          isOpen={accordionState.wonLost}
          onToggle={() => toggleAccordion('wonLost')}
        >
          <WonLostChart closedOpportunities={closedOpportunities} />
        </AccordionSection>
      </div>

      {/* Sales Cycle Length Section */}
      <div style={{ padding: "0 16px" }}>
        <AccordionSection
          title="Sales Cycle Length"
          isOpen={accordionState.salesCycle}
          onToggle={() => toggleAccordion('salesCycle')}
        >
          <SalesCycleChart closedOpportunities={closedOpportunities} />
        </AccordionSection>
      </div>

      {/* Activities Chart Section */}
      <div style={{ padding: "0 16px" }}>
        <AccordionSection
          title="Activity Trends"
          isOpen={accordionState.activities}
          onToggle={() => toggleAccordion('activities')}
        >
          <UserActivityChart accessToken={accessToken} />
        </AccordionSection>
      </div>      
      
      {/* Opportunities List Section */}
      <div style={{ padding: "0 16px" }}>
        <AccordionSection
          title={`My Open Opportunities (${opportunities.length})`}
          isOpen={accordionState.opportunities}
          onToggle={() => toggleAccordion('opportunities')}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <p>Loading...</p>
            </div>
          ) : opportunities.length === 0 ? (
            <p>No opportunities found.</p>
          ) : (
            <div>
              {opportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.opportunityid}
                  opportunity={opportunity}
                  onClick={() => onOpportunitySelect(opportunity.opportunityid)}
                />
              ))}
            </div>
          )}
        </AccordionSection>
      </div>
    </div>

      {/* Auto-open toggle */}
      <div style={{ 
        padding: "12px 16px",
        fontSize: "13px",
        borderTop: "1px solid #e0e0e0",
        backgroundColor: "white",
        marginTop: "auto" // Pushes it to the bottom
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

export default OpportunityList;