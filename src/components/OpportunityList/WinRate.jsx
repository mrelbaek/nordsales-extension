// Function to determine the color based on win rate percentage
const getWinRateColor = (percentage) => {
    if (percentage >= 80) return "#4caf50"; // Green for high win rates
    if (percentage >= 50) return "#2196f3"; // Blue for medium win rates
    if (percentage >= 30) return "#ff9800"; // Orange for low win rates
    return "#f44336"; // Red for very low win rates
  };import React, { useMemo } from 'react';

/**
 * Calculates win rates for specified time periods
 * 
 * @param {Object} props - Component props
 * @param {Array} props.closedOpportunities - Array of closed opportunities
 * @returns {JSX.Element} Win rate component
 */
const WinRate = ({ closedOpportunities = [] }) => {
  // Calculate win rates for different time periods
  const { l3mWinRate, l12mWinRate, l3mCount, l12mCount, l3mWonCount, l12mWonCount, l3mTrend, l12mTrend } = useMemo(() => {
    // Add debugging information
    console.log('[WinRate] Number of closed opportunities:', closedOpportunities?.length || 0);
    if (closedOpportunities && closedOpportunities.length > 0) {
      console.log('[WinRate] First opportunity sample:', {
        actualclosedate: closedOpportunities[0].actualclosedate,
        createdon: closedOpportunities[0].createdon,
        statecode: closedOpportunities[0].statecode
      });
    }
    
    if (!closedOpportunities || closedOpportunities.length === 0) {
      console.log('[WinRate] No closed opportunities data available');
      return { 
        l3mWinRate: 0, 
        l12mWinRate: 0,
        l3mCount: 0,
        l12mCount: 0,
        l3mWonCount: 0,
        l12mWonCount: 0
      };
    }

    const now = new Date();
    
    // Last 3 months calculation
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    
    // Last 12 months calculation
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(now.getMonth() - 12);
    
    console.log('[WinRate] Date ranges:', {
      now: now.toISOString(),
      threeMonthsAgo: threeMonthsAgo.toISOString(),
      twelveMonthsAgo: twelveMonthsAgo.toISOString()
    });
    
    // Filter opportunities closed in last 3 months
    const l3mOpportunities = closedOpportunities.filter(opp => {
      if (!opp.actualclosedate) {
        console.log('[WinRate] Opportunity missing actualclosedate:', opp.opportunityid);
        return false;
      }
      
      try {
        const closeDate = new Date(opp.actualclosedate);
        const isInRange = closeDate >= threeMonthsAgo && closeDate <= now;
        return isInRange;
      } catch (err) {
        console.error('[WinRate] Error parsing date:', err);
        return false;
      }
    });
    
    // Filter opportunities closed in last 12 months
    const l12mOpportunities = closedOpportunities.filter(opp => {
      if (!opp.actualclosedate) return false;
      
      try {
        const closeDate = new Date(opp.actualclosedate);
        return closeDate >= twelveMonthsAgo && closeDate <= now;
      } catch (err) {
        console.error('[WinRate] Error parsing date:', err);
        return false;
      }
    });
    
    console.log('[WinRate] Filtered opportunities:', {
      l3mCount: l3mOpportunities.length,
      l12mCount: l12mOpportunities.length
    });
    
    // Calculate win rates
    // Log a sample opportunity to debug the exact structure
    if (l3mOpportunities.length > 0) {
      console.log('[WinRate] Sample L3M opportunity statecode:', 
        l3mOpportunities[0].statecode, 
        'type:', typeof l3mOpportunities[0].statecode
      );
    }
    
    // Count won opportunities - they should have statecode of 1 (numeric)
    const l3mWon = l3mOpportunities.filter(opp => {
      // If statecode exists and is exactly 1 (numeric) or '1' (string)
      return opp.statecode === 1 || opp.statecode === '1';
    }).length;
    
    const l3mWinRate = l3mOpportunities.length > 0 
      ? Math.round((l3mWon / l3mOpportunities.length) * 100) 
      : 0;
      
    // Calculate previous 3-month period (3-6 months ago) for trend
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    
    // Filter opportunities closed in previous 3-month period (3-6 months ago)
    const prevL3mOpportunities = closedOpportunities.filter(opp => {
      if (!opp.actualclosedate) return false;
      
      try {
        const closeDate = new Date(opp.actualclosedate);
        return closeDate >= sixMonthsAgo && closeDate < threeMonthsAgo;
      } catch (err) {
        return false;
      }
    });
    
    // Calculate win rate for previous 3-month period
    const prevL3mWon = prevL3mOpportunities.filter(opp => {
      return opp.statecode === 1 || opp.statecode === '1';
    }).length;
    
    const prevL3mWinRate = prevL3mOpportunities.length > 0
      ? Math.round((prevL3mWon / prevL3mOpportunities.length) * 100)
      : 0;
    
    // Calculate trend (difference between current and previous periods)
    const l3mTrend = l3mWinRate - prevL3mWinRate;
    
    console.log('[WinRate] Trend calculation:', {
      currentPeriod: `${l3mWon}/${l3mOpportunities.length} = ${l3mWinRate}%`,
      previousPeriod: `${prevL3mWon}/${prevL3mOpportunities.length} = ${prevL3mWinRate}%`,
      trend: l3mTrend
    });
      
    // Apply the same fix for 12-month calculation
    const l12mWon = l12mOpportunities.filter(opp => {
      return opp.statecode === 1 || opp.statecode === '1';
    }).length;
    
    const l12mWinRate = l12mOpportunities.length > 0 
      ? Math.round((l12mWon / l12mOpportunities.length) * 100) 
      : 0;
    
    // Calculate previous 12-month period (12-24 months ago) for trend
    const twentyFourMonthsAgo = new Date();
    twentyFourMonthsAgo.setMonth(now.getMonth() - 24);
    
    // Filter opportunities closed in previous 12-month period (12-24 months ago)
    const prevL12mOpportunities = closedOpportunities.filter(opp => {
      if (!opp.actualclosedate) return false;
      
      try {
        const closeDate = new Date(opp.actualclosedate);
        return closeDate >= twentyFourMonthsAgo && closeDate < twelveMonthsAgo;
      } catch (err) {
        return false;
      }
    });
    
    // Calculate win rate for previous 12-month period
    const prevL12mWon = prevL12mOpportunities.filter(opp => {
      return opp.statecode === 1 || opp.statecode === '1';
    }).length;
    
    const prevL12mWinRate = prevL12mOpportunities.length > 0
      ? Math.round((prevL12mWon / prevL12mOpportunities.length) * 100)
      : 0;
    
    // Calculate trend (difference between current and previous periods)
    const l12mTrend = l12mWinRate - prevL12mWinRate;
    
    console.log('[WinRate] L12M Trend calculation:', {
      currentPeriod: `${l12mWon}/${l12mOpportunities.length} = ${l12mWinRate}%`,
      previousPeriod: `${prevL12mWon}/${prevL12mOpportunities.length} = ${prevL12mWinRate}%`,
      trend: l12mTrend
    });
    
    console.log('[WinRate] Calculation results:', {
      l3mWonCount: l3mWon,
      l3mWinRate, 
      l12mWonCount: l12mWon,
      l12mWinRate
    });
    
    return { 
      l3mWinRate, 
      l12mWinRate,
      l3mCount: l3mOpportunities.length,
      l12mCount: l12mOpportunities.length,
      l3mWonCount: l3mWon,
      l12mWonCount: l12mWon,
      l3mTrend,
      l12mTrend
    };
  }, [closedOpportunities]);

  // Function to render trend indicator
  const renderTrendIndicator = (trend) => {
    if (!trend || trend === 0) {
      return (
        <span style={{ fontSize: "10px", marginLeft: "4px", color: "#757575" }}>
          =
        </span>
      );
    }
    
    if (trend > 0) {
      return (
        <span style={{ fontSize: "10px", marginLeft: "4px", color: "#4caf50" }}>
          ↑ {trend}% from previous period
        </span>
      );
    }
    
    return (
      <span style={{ fontSize: "10px", marginLeft: "4px", color: "#f44336" }}>
        ↓ {Math.abs(trend)}% from previous period
      </span>
    );
  };

  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "20px", justifyContent: "space-between" }}>
      {/* L3M Win Rate */}
      <div style={{ 
        flex: 1,
        backgroundColor: "#f5f5f5", 
        borderRadius: "10px",
        padding: "8px 12px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ fontSize: "13px", color: "#666" }}>L3M Win Rate</div>
          <div style={{ fontSize: "16px", fontWeight: "bold" }}>
            {l3mWinRate}%
          </div>
        </div>
        
        {/* Progress bar for L3M win rate */}
        <div style={{ 
          height: "4px", 
          backgroundColor: "#e0e0e0", 
          borderRadius: "2px", 
          overflow: "hidden",
          marginBottom: "4px"
        }}>
          <div style={{ 
            height: "100%", 
            width: `${Math.min(l3mWinRate, 100)}%`, 
            backgroundColor: getWinRateColor(l3mWinRate),
            borderRadius: "2px"
          }}></div>
        </div>
        
        {/* Opportunity count */}
        <div style={{ 
          fontSize: "10px", 
          color: "#666", 
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end"
        }}>
          <div>
            {l3mCount > 0 ? (
              `Won ${l3mWonCount} of ${l3mCount} opportunities`
            ) : (
              "No data in period"
            )}
          </div>
          {l3mCount > 0 && (
            <div style={{ marginTop: "2px" }}>
              {renderTrendIndicator(l3mTrend)}
            </div>
          )}
        </div>
      </div>
      
      {/* L12M Win Rate */}
      <div style={{ 
        flex: 1,
        backgroundColor: "#f5f5f5", 
        borderRadius: "10px",
        padding: "8px 12px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ fontSize: "13px", color: "#666" }}>L12M Win Rate</div>
          <div style={{ fontSize: "16px", fontWeight: "bold", display: "flex", alignItems: "center" }}>
            {l12mWinRate}%
          </div>
        </div>
        
        {/* Progress bar for L12M win rate */}
        <div style={{ 
          height: "4px", 
          backgroundColor: "#e0e0e0", 
          borderRadius: "2px", 
          overflow: "hidden",
          marginBottom: "4px" 
        }}>
          <div style={{ 
            height: "100%", 
            width: `${Math.min(l12mWinRate, 100)}%`, 
            backgroundColor: getWinRateColor(l12mWinRate),
            borderRadius: "2px"
          }}></div>
        </div>
        
        {/* Opportunity count */}
        <div style={{ 
          fontSize: "10px", 
          color: "#666", 
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end"
        }}>
          <div>
            {l12mCount > 0 ? (
              `Won ${l12mWonCount} of ${l12mCount} opportunities`
            ) : (
              "No data in period"
            )}
          </div>
          {l12mCount > 0 && (
            <div style={{ marginTop: "2px" }}>
              {renderTrendIndicator(l12mTrend)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WinRate;