import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Component to display won/lost opportunities over the past 12 months
 * 
 * @param {Object} props - Component props
 * @param {Array} props.closedOpportunities - Array of closed opportunities
 * @returns {JSX.Element} Won/Lost chart component
 */
const WonLostChart = ({ closedOpportunities = [] }) => {
  // Helper to generate labels for the last 12 months
  // Moved up before it's used to avoid the "Cannot access 'n' before initialization" error
  const getLastTwelveMonthLabels = () => {
    const months = [];
    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(now.getMonth() - i);
      months.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
    }
    
    return months;
  };
  
  // Generate chart data from closed opportunities
  const chartData = useMemo(() => {
    console.log('[WonLostChart] Processing closed opportunities:', closedOpportunities?.length || 0);
    
    if (!closedOpportunities || closedOpportunities.length === 0) {
      return {
        labels: getLastTwelveMonthLabels(),
        datasets: [
          {
            label: 'Won',
            data: Array(12).fill(0),
            backgroundColor: 'rgba(93, 182, 117, 0.7)',
            borderRadius: 4,
            stack: 'stack0'
          },
          {
            label: 'Lost',
            data: Array(12).fill(0),
            backgroundColor: 'rgba(199, 117, 93, 0.7)',
            borderRadius: 4,
            stack: 'stack0'
          }
        ]
      };
    }
    
    // Generate labels for the last 12 months
    const monthLabels = getLastTwelveMonthLabels();
    
    // Initialize counts for won and lost opportunities by month
    const wonByMonth = Array(12).fill(0);
    const lostByMonth = Array(12).fill(0);
    
    // Calculate date 12 months ago for filtering
    const now = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(now.getMonth() - 12);
    
    // Filter for opportunities closed in the last 12 months
    const relevantOpportunities = closedOpportunities.filter(opp => {
      if (!opp.actualclosedate) return false;
      
      try {
        const closeDate = new Date(opp.actualclosedate);
        return closeDate >= twelveMonthsAgo && closeDate <= now;
      } catch (err) {
        console.error('[WonLostChart] Error parsing date:', err);
        return false;
      }
    });
    
    console.log('[WonLostChart] Opportunities in last 12 months:', relevantOpportunities.length);
    
    // Count won/lost opportunities by month
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    relevantOpportunities.forEach(opp => {
      try {
        const closeDate = new Date(opp.actualclosedate);
        const monthYear = `${monthNames[closeDate.getMonth()]} ${closeDate.getFullYear()}`;
        const monthIndex = monthLabels.indexOf(monthYear);
        
        if (monthIndex >= 0) {
          // Check if won (statecode 1) or lost (statecode 2)
          if (opp.statecode === 1 || opp.statecode === '1') {
            wonByMonth[monthIndex]++;
          } else if (opp.statecode === 2 || opp.statecode === '2') {
            lostByMonth[monthIndex]++;
          }
        }
      } catch (err) {
        console.error('[WonLostChart] Error processing opportunity:', err);
      }
    });
    
    console.log('[WonLostChart] Data by month:', {
      won: wonByMonth,
      lost: lostByMonth
    });
    
    return {
      labels: monthLabels,
      datasets: [
        {
          label: 'Won',
          data: wonByMonth,
          backgroundColor: 'rgba(93, 182, 117, 0.7)',
          borderRadius: 4
        },
        {
          label: 'Lost',
          data: lostByMonth,
          backgroundColor: 'rgba(199, 117, 93, 0.7)',
          borderRadius: 4
        }
      ]
    };
  }, [closedOpportunities]);
  
  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          font: {
            size: 10
          }
        }
      },
      title: {
        display: true,
        text: 'Won/Lost Opportunities (Last 12 Months)',
        font: {
          size: 14
        }
      },
      tooltip: {
        callbacks: {
          // Add win rate to tooltip
          afterTitle: function(tooltipItems) {
            const dataIndex = tooltipItems[0].dataIndex;
            const won = chartData.datasets[0].data[dataIndex];
            const lost = chartData.datasets[1].data[dataIndex];
            const total = won + lost;
            
            if (total === 0) return 'Win rate: N/A';
            
            const winRate = Math.round((won / total) * 100);
            return `Win rate: ${winRate}%`;
          },
          // Add percentage to tooltip
          label: function(context) {
            let label = context.dataset.label || '';
            
            if (label) {
              label += ': ';
            }
            
            if (context.parsed.y !== null) {
              label += context.parsed.y;
              
              // Add percentage
              const dataIndex = context.dataIndex;
              const won = chartData.datasets[0].data[dataIndex];
              const lost = chartData.datasets[1].data[dataIndex];
              const total = won + lost;
              
              if (total > 0) {
                const percentage = Math.round((context.parsed.y / total) * 100);
                label += ` (${percentage}%)`;
              }
            }
            
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 10
          }
        },
        stacked: true
      },
      y: {
        beginAtZero: true,
        stacked: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          precision: 0,
          font: {
            size: 10
          }
        }
      }
    }
  };

  return (
    <div style={{ 
      padding: "16px", 
      backgroundColor: "#fff", 
      borderRadius: "8px",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
    }}>
      <div style={{ height: "300px" }}>
        <Bar options={options} data={chartData} />
      </div>
    </div>
  );
};

export default WonLostChart;