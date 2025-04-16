import React, { useState, useEffect, useRef } from 'react';
import AccordionSection from '../common/AccordionSection';
import { getOpportunityUrl } from '../../utils/opportunityUtils';
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
 * Analytics component for list view metrics
 * 
 * @param {Object} props - Component props
 * @param {Array} props.opportunities - All opportunities in the list
 * @param {Array} props.closedOpportunities - Closed opportunities data
 * @param {boolean} props.isOpen - Whether section is expanded
 * @param {Function} props.onToggle - Function to call when toggling section
 * @returns {JSX.Element} Analytics component
 */
const ListAnalytics = ({ opportunities = [], closedOpportunities = [], isOpen, onToggle }) => {
  const [averageClosingTime, setAverageClosingTime] = useState(0);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [tooltipData, setTooltipData] = useState([]);
  const chartRef = useRef(null);

  // Calculate closing times and prepare chart data
  useEffect(() => {

    if (closedOpportunities && closedOpportunities.length > 0) {
      // Take only the last 10 closed opportunities and sort by actualclosedate
      const sortedOpportunities = [...closedOpportunities]
        .sort((a, b) => new Date(b.actualclosedate) - new Date(a.actualclosedate))
        .slice(0, 10);
            
      // Calculate closing times (days between creation and close)
      const times = sortedOpportunities.map(opp => {
        const createdDate = new Date(opp.createdon);
        const closedDate = new Date(opp.actualclosedate);

        // Return difference in days
        return Math.floor((closedDate - createdDate) / (1000 * 60 * 60 * 24));
      });
            
      const generateTooltips = async () => {
        // Create tooltip data for closed opportunities
        const tooltipsPromises = sortedOpportunities.map(async (opp, index) => {
          const url = await getOpportunityUrl(opp.opportunityid);
          
          return {
            name: opp.name || `Opportunity ${index + 1}`,
            description: opp.description || '',
            value: opp.estimatedvalue || opp.totalamount || 0,
            status: opp.statecode === 0 ? 'Open' : opp.statecode === 1 ? 'Won' : 'Lost',
            id: opp.opportunityid,
            daysOpen: Math.floor((new Date(opp.actualclosedate) - new Date(opp.createdon)) / (1000 * 60 * 60 * 24)),
            url: url
          };
        });
        
        // Wait for all URL generation promises to resolve
        const tooltips = await Promise.all(tooltipsPromises);
        
        // Create labels for the chart
        const labels = sortedOpportunities.map((opp, index) => 
          opp.name ? (opp.name.length > 8 ? opp.name.substring(0, 8) + '...' : opp.name) : `Opp ${index + 1}`
        );
        
        // Create data array with closed opportunities
        const data = [...times];
        
        // Create background colors array - use different colors based on status
        const backgroundColors = sortedOpportunities.map(opp => {
          // Won = green, Lost = red, Default = gray
          if (opp.statecode === 1) return 'rgba(197, 253, 212, 0.7)'; // Green for won
          if (opp.statecode === 2) return 'rgba(252, 210, 197, 0.7)'; // Red for lost
          return 'rgba(189, 189, 189, 0.7)'; // Grey for others
        });
        
        setTooltipData(tooltips);
        
        // Calculate average
        const avgTime = Math.round(times.reduce((acc, time) => acc + time, 0) / (times.length || 1));
        
        setAverageClosingTime(avgTime);
        
        // Set chart data
        setChartData({
          labels,
          datasets: [
            {
              label: 'Days to Close',
              data,
              backgroundColor: backgroundColors,
              borderRadius: 4,
              borderSkipped: false,
              barThickness: 20, // Smaller bars for more data points
            }
          ]
        });
      };
      
      generateTooltips();
    } else {
      // Reset chart if no data
      setChartData({ labels: [], datasets: [{ data: [] }] });
      setAverageClosingTime(0);
    }
  }, [closedOpportunities]);

  // Function to handle bar click
  const handleBarClick = (event) => {
    if (!chartRef.current) return;
    
    const chart = chartRef.current;
    const activePoints = chart.getElementsAtEventForMode(
      event.nativeEvent,
      'nearest',
      { intersect: true },
      false
    );
    
    if (activePoints.length === 0) return;
    
    const clickedIndex = activePoints[0].index;
    const opportunityData = tooltipData[clickedIndex];
    
    if (opportunityData && opportunityData.url) {
      window.open(opportunityData.url, '_blank');
    } else if (opportunityData && opportunityData.id) {
      getOpportunityUrl(opportunityData.id)
        .then(url => {
          if (url) window.open(url, '_blank');
        })
        .catch(error => {
          console.error("Error generating URL:", error);
        });
    }
  };

  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: function(context) {
            const index = context[0].dataIndex;
            const tooltipItem = tooltipData[index];
            return tooltipItem ? tooltipItem.name : `Opportunity ${index + 1}`;
          },
          label: function(context) {
            const index = context.dataIndex;
            const tooltipItem = tooltipData[index];
            
            if (!tooltipItem) return `${context.raw} days`;
            
            const lines = [
              `Days Open: ${tooltipItem.daysOpen}`,
              `Value: $${tooltipItem.value.toLocaleString()}`,
              `Status: ${tooltipItem.status}`
            ];

            if (tooltipItem.id) {
              lines.push(`ID: ${tooltipItem.id}`);
            }
            
            lines.push('Click to open opportunity');
            
            return lines;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          drawBorder: false,
        },
        ticks: {
          font: {
            size: 12,
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 10,
          },
          maxRotation: 45,
          minRotation: 45
        },
      },
    },
    animation: {
      duration: 500,
    },
    onHover: (event, chartElement) => {
      if (event.native) {
        event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
      }
    }
  };

  // Add the plugin for rendering the average line
  const averageLinePlugin = {
    id: 'averageLine',
    afterDraw: (chart) => {
      const avgValue = averageClosingTime;
      const ctx = chart.ctx;
      const yAxis = chart.scales.y;
      const xAxis = chart.scales.x;
      
      if (yAxis && xAxis) {
        const yPos = yAxis.getPixelForValue(avgValue);
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xAxis.left, yPos);
        ctx.lineTo(xAxis.right, yPos);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#c4e456';
        ctx.stroke();
        ctx.restore();
      }
    }
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
    }).length,
    neverContacted: opportunities.filter(opp => {
      return !opp.activities || opp.activities.length === 0;
    }).length
  };
    
  return (
    <AccordionSection
      title="Portfolio Analytics"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {/* Summary Stats */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", justifyContent: "space-between" }}>
        {/* Open days */}
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
            fontSize: "16px", 
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
            fontSize: "16px", 
            fontWeight: "bold",
            marginLeft: "10px" 
          }}>
            {opportunityStats.closing}
          </div>
        </div>
      </div>
      
      {/* Closing Time Chart */}
      <div style={{ 
        padding: "16px", 
        borderRadius: "8px",
        marginBottom: "16px",
        backgroundColor: "#f9f9f9"
      }}>
        <div style={{ fontSize: "14px", color: "#333", marginBottom: "16px" }}>
          Closing Time - Last 10 Closed Opportunities
        </div>
        
        <div style={{ height: 170, position: 'relative' }}>
          {chartData.datasets && chartData.datasets[0] && chartData.datasets[0].data && chartData.datasets[0].data.length > 0 ? (
            <Bar 
              ref={chartRef}
              data={chartData} 
              options={options} 
              plugins={[averageLinePlugin]}
              onClick={handleBarClick}
            />
          ) : (
            <div style={{ 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#888',
              fontStyle: 'italic'
            }}>
              No closed opportunity data available
            </div>
          )}
        </div>
        
        {/* Average indicator */}
        <div style={{ 
          display: "flex",
          alignItems: "center",
          marginTop: "16px",
          paddingTop: "8px",
          borderTop: "1px solid #e0e0e0"
        }}>
          <div style={{ 
            width: "16px", 
            height: "2px", 
            backgroundColor: "#c4e456",
            marginRight: "6px"
          }}></div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            Average: {averageClosingTime} days
          </div>
        </div>
      </div>
    </AccordionSection>
  );
};

export default ListAnalytics;