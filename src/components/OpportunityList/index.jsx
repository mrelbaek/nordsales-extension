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
  onOpportunitySelect,
  toggleAutoOpen,
  autoOpen,
  onFetchMyOpenOpportunities
}) => {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <Header title="Nordsales" showBackButton={false} />
      
      <div style={{ 
        padding: "16px", 
        borderBottom: "1px solid #e0e0e0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "white"
      }}>
        <button 
          onClick={onFetchMyOpenOpportunities}
          style={{ 
            padding: "8px 16px", 
            backgroundColor: "#0078d4", 
            color: "white", 
            border: "none", 
            borderRadius: "4px",
            cursor: "pointer", 
            fontSize: "13px"
          }}
        >
          My Open Opportunities
        </button>
        <button 
          onClick={onLogout} 
          style={{ 
            padding: "6px 12px", 
            backgroundColor: "#f0f0f0", 
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer", 
            fontSize: "13px"
          }}
        >
          Logout
        </button>
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