import React from 'react';
import Header from '../Header';
import OpportunityCard from './OpportunityCard';

/**
 * Opportunity list component
 * 
 * @param {Object} props - Component props
 * @param {Array} props.opportunities - List of opportunities
 * @param {boolean} props.loading - Whether data is loading
 * @param {Function} props.onLogout - Function to call when logout button is clicked
 * @param {Function} props.onOpportunitySelect - Function to call when an opportunity is selected
 * @param {Function} props.toggleAutoOpen - Function to call when auto-open toggle is clicked
 * @param {boolean} props.autoOpen - Whether auto-open is enabled
 * @param {Function} props.onFetchMyOpenOpportunities - Function to fetch user's open opportunities
 * @returns {JSX.Element} Opportunity list component
 */
const OpportunityList = ({ 
  opportunities = [], 
  loading, 
  onLogout,
  isLoggingOut, 
  onOpportunitySelect,
  toggleAutoOpen,
  autoOpen,
  onFetchMyOpenOpportunities
}) => {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", overflow: "auto" }}>
      {/* Header */}
      <Header
        title="Nordsales"
        showBackButton={false} 
        onLogout={onLogout}
        isLoggingOut={isLoggingOut}
        onFetchMyOpenOpportunities={onFetchMyOpenOpportunities}
      />
      {/* Content header */}
      <div>
        <h3 style={{
          padding: "12px 16px 0px 16px",
          display: "flex",
          color: "#1f2223",
          fontSize: "14px",
          marginBottom: "2px"
        }}>My Open Opportunities</h3>
      </div>

      {/* Opportunity List */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
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

export default OpportunityList;