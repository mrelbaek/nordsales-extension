import React, { useState, useEffect, useRef } from 'react';  // Add useRef here
import Header from '../Header';
import OpportunityCard from './OpportunityCard';
import ListAnalytics from './Analytics';
import SalesCycleChart from './SalesCycleChart';
import AccordionSection from '../common/AccordionSection';
import WinRate from './WinRate';
import UserActivityChart from './UserActivityChart';
import WonLostChart from './WonLostChart';
import { PiIntersect, PiSortAscending, PiSortDescending, PiCaretDown } from "react-icons/pi";
import SubscriptionStatus from '../SubscriptionStatus';
import FeatureGate from '../FeatureGate';
import ProPill from '../common/ProPill';
import { sortOpportunities } from '../../utils/activityUtils';


/**
 * Opportunity list component
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
  accessToken,
  subscription
}) => {
  const [accordionState, setAccordionState] = useState({
    analytics: true,
    salesCycle: false,
    opportunities: true,
    activities: false,
    wonLost: false
  });
  
  // Add sort state
  const [sortOption, setSortOption] = useState('lastActivity');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [sortDirection, setSortDirection] = useState('asc');
  const [sortedOpportunities, setSortedOpportunities] = useState([]);
  
  // Create a ref for the dropdown
  const sortDropdownRef = useRef(null);
  
  // Update sorted opportunities when original opportunities or sort option changes
  useEffect(() => {
    setSortedOpportunities(sortOpportunities(opportunities, sortOption, sortDirection));
  }, [opportunities, sortOption, sortDirection]);
  
  // Handle clicks outside dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setShowSortOptions(false);
      }
    }
    
    // Add event listener when dropdown is shown
    if (showSortOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortOptions]);

  const toggleAccordion = (section) => {
    setAccordionState({
      ...accordionState,
      [section]: !accordionState[section]
    });
  };
  
  // Handle sort option change
  const handleSortChange = (option) => {
    setSortOption(option);
    setShowSortOptions(false);
  };

  // Toggle sort direction
  const toggleSortDirection = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };

  // Updated function to get sort direction icon
  const getSortDirectionIcon = () => {
    return sortDirection === 'asc' 
      ? <PiSortAscending size={14} /> 
      : <PiSortDescending size={14} />;
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

  // Get sort option display text
  const getSortOptionText = () => {
    switch (sortOption) {
      case 'value': return 'Value';
      case 'closingDate': return 'Closing Date';
      case 'lastActivity': return 'Last Activity';
      default: return 'Last Activity';
    }
  };

  // Render the dropdown with sort options
  const renderSortDropdown = () => (
    <div 
      ref={sortDropdownRef}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}
      onClick={(e) => e.stopPropagation()}
    >

      {/* Direction toggle button */}
      <button
        onClick={toggleSortDirection}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          width: '24px',
          height: '24px'
        }}
        title={sortDirection === 'asc' 
          ? 'Currently showing oldest first - Click to show newest first' 
          : 'Currently showing newest first - Click to show oldest first'}
      >
        {getSortDirectionIcon()}
      </button>

      {/* Sort option button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowSortOptions(!showSortOptions);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        {getSortOptionText()}
        <PiCaretDown size={12} style={{ marginLeft: '4px' }} />
      </button>
      
      {showSortOptions && (
        <div 
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '4px',
            backgroundColor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: '4px',
            zIndex: 100,
            width: '150px',
            border: '1px solid #eee'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #eee',
              fontSize: '12px',
              cursor: 'pointer',
              backgroundColor: sortOption === 'value' ? '#f0f7ff' : 'white'
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSortChange('value');
            }}
          >
            Value
          </div>
          <div 
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #eee',
              fontSize: '12px',
              cursor: 'pointer',
              backgroundColor: sortOption === 'closingDate' ? '#f0f7ff' : 'white'
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSortChange('closingDate');
            }}
          >
            Closing Date
          </div>
          <div 
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              backgroundColor: sortOption === 'lastActivity' ? '#f0f7ff' : 'white'
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSortChange('lastActivity');
            }}
          >
            Last Activity
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", overflow: "hidden", height: "100%", background: "#ededed" }}>
      {/* Header */}
      <Header
        title="Lens"
        showBackButton={false} 
        onLogout={onLogout}
        isLoggingOut={isLoggingOut}
        onFetchMyOpenOpportunities={onFetchMyOpenOpportunities}
        subscription={subscription}
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
      
      {/* Won/Loss Distribution Section */}
      <div style={{ padding: "12px 16px 0px 16px" }}>
        <AccordionSection
          title="Win/Loss Distribution"
          rightElement={subscription?.status && <ProPill status={subscription.status} />}
          isOpen={accordionState.wonLost}
          onToggle={() => toggleAccordion('wonLost')}
        >
          <FeatureGate
            featureName="winLossCharts"
            fallbackMessage="Win/Loss Chart is not available with your subscription plan."
            teaseComponent={<WonLostChart closedOpportunities={closedOpportunities.slice(0, 3)} />}
            subscription={subscription}
          >
            <WonLostChart closedOpportunities={closedOpportunities} />
          </FeatureGate>
        </AccordionSection>
      </div>

      {/* Sales Cycle Length Section */}
      <div style={{ padding: "12px 16px 0px 16px" }}>
        <AccordionSection
          title="Sales Cycle Length"
          rightElement={subscription?.status && <ProPill status={subscription.status} />}
          isOpen={accordionState.salesCycle}
          onToggle={() => toggleAccordion('salesCycle')}
        >
          <FeatureGate
            featureName="salesCycleAnalytics"
            fallbackMessage="Sales Cycle Length analysis is not available with your subscription plan."
            teaseComponent={<SalesCycleChart closedOpportunities={closedOpportunities.slice(0, 3)} />}
            subscription={subscription}
          >
            <SalesCycleChart closedOpportunities={closedOpportunities} />
          </FeatureGate>
        </AccordionSection>
      </div>

      {/* Activities Chart Section */}
      <div style={{ padding: "12px 16px 0px 16px" }}>
        <AccordionSection
          title="Activity Trends"
          rightElement={subscription?.status && <ProPill status={subscription.status} />}
          isOpen={accordionState.activities}
          onToggle={() => toggleAccordion('activities')}
        >
          <FeatureGate
            featureName="fullActivityTrends"
            fallbackMessage="Full activity insights are not available with your current plan."
            teaseComponent={<UserActivityChart accessToken={accessToken} limited />}
            subscription={subscription}
          >
            <UserActivityChart accessToken={accessToken} />
          </FeatureGate>
        </AccordionSection>
      </div>

      {/* Opportunities List Section */}
      <div style={{ padding: "12px 16px 0px 16px" }}>
        <AccordionSection
          title={`Open Opportunities`}
          isOpen={accordionState.opportunities}
          onToggle={() => toggleAccordion('opportunities')}
          rightElement={renderSortDropdown()}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <p>Loading...</p>
            </div>
          ) : sortedOpportunities.length === 0 ? (
            <p>No opportunities found.</p>
          ) : (
            <div>
              {sortedOpportunities.map((opportunity) => (
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