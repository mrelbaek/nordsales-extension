import React, { useState, useEffect, useRef } from 'react';
import { calculateDaysSinceLastContact } from '../../utils/activityUtils';
import { calculateDaysBetween } from '../../utils/dateUtils';
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
 * Analytics component for opportunity metrics
 * 
 * @param {Object} props - Component props
 * @param {Array} props.activities - Activities to analyze
 * @param {Array} props.closedOpportunities - Closed opportunities data
 * @param {Object} props.opportunity - Current opportunity data
 * @param {boolean} props.isOpen - Whether section is expanded
 * @param {Function} props.onToggle - Function to call when toggling section
 * @returns {JSX.Element} Analytics component
 */
const Analytics = ({ activities = [], closedOpportunities = [], opportunity, isOpen, onToggle }) => {
  const [averageClosingTime, setAverageClosingTime] = useState(0);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [currentOpportunityDays, setCurrentOpportunityDays] = useState(0);
  const [tooltipData, setTooltipData] = useState([]);
  const chartRef = useRef(null);

  // Calculate current opportunity days open
  useEffect(() => {
    if (opportunity && opportunity.createdon) {
      const days = calculateDaysBetween(opportunity.createdon, new Date());
      setCurrentOpportunityDays(days);
    }
  }, [opportunity]);

  // Calculate closing times and prepare chart data
  useEffect(() => {
    if (closedOpportunities && closedOpportunities.length > 0) {
      // Take only the last 15 closed opportunities and sort by actualclosedate
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
            name: opp.name || 'Unnamed Opportunity',
            description: opp.description || '',
            value: opp.estimatedvalue || opp.totalamount || 0,
            status: opp.statecode === 0 ? 'Open' : opp.statecode === 1 ? 'Won' : 'Lost',
            daysOpen: Math.floor((new Date(opp.actualclosedate) - new Date(opp.createdon)) / (1000 * 60 * 60 * 24)),
            url: url,
            id: opp.opportunityid
          };
        });
        
        // Wait for all URL generation promises to resolve
        const tooltips = await Promise.all(tooltipsPromises);
        
        // Create labels for the chart - use short names instead of Opp 1, Opp 2, etc.
        const labels = sortedOpportunities.map((opp, index) => 
          opp.name ? (opp.name.length > 10 ? opp.name.substring(0, 10) + '...' : opp.name) : `Opp ${index + 1}`
        );
        
        // Create data array with closed opportunities
        const data = [...times];
        
        // Create background colors array - use conditional colors like in the image (won: green, lost: red)
        const backgroundColors = sortedOpportunities.map(opp => {
          // Use colors similar to the image - green for won, red for lost
          return opp.statecode === 1 ? 'rgba(93, 182, 117, 0.7)' : 'rgba(199, 117, 93, 0.7)';
        });
        
        // Add current opportunity data and tooltip
        let updatedTooltips = [...tooltips];
        
        if (opportunity && opportunity.createdon) {
          // Add current opportunity to the beginning of the arrays
          labels.unshift('Current');
          data.unshift(currentOpportunityDays);
          backgroundColors.unshift('rgba(92, 92, 92, 0.7)'); // Dark gray for current opportunity
          
          // Add current opportunity tooltip
          const currentUrl = await getOpportunityUrl(opportunity.opportunityid);
          
          updatedTooltips.unshift({
            name: opportunity.name || 'Current Opportunity',
            description: opportunity.description || '',
            value: opportunity.estimatedvalue || 0,
            status: 'Open',
            daysOpen: currentOpportunityDays,
            url: currentUrl,
            id: opportunity.opportunityid
          });
        }
        
        setTooltipData(updatedTooltips);
        
        // Calculate average closing time
        const avgTime = Math.round(times.reduce((acc, time) => acc + time, 0) / (times.length || 1));
        
        setAverageClosingTime(avgTime);
        
        // Set chart data
        setChartData({
          labels,
          datasets: [
            {
              label: 'Days',
              data,
              backgroundColor: backgroundColors,
              borderWidth: 0,
              borderRadius: 4,
              borderSkipped: false,
              barThickness: 10,
              maxBarThickness: 25
            }
          ]
        });
      };
      
      generateTooltips();
    }
  }, [closedOpportunities, opportunity, currentOpportunityDays]);

  // Function to handle bar click
  const handleBarClick = (event) => {
    if (!chartRef.current) {
      return;
    }
    
    const chart = chartRef.current;
    
    // Get the activeElements from the chart
    const activePoints = chart.getElementsAtEventForMode(
      event.nativeEvent,
      'nearest',
      { intersect: true },
      false
    );
    
    // If no point was clicked, do nothing
    if (activePoints.length === 0) {
      return;
    }
    
    // Get the clicked bar's data
    const clickedIndex = activePoints[0].index;
    const opportunityData = tooltipData[clickedIndex];
    
    // Navigate to the opportunity using the existing service worker functionality
    if (opportunityData && opportunityData.id) {
      // Use the existing NAVIGATE_TO_OPPORTUNITY message type
      chrome.runtime.sendMessage({
        type: "NAVIGATE_TO_OPPORTUNITY",
        opportunityId: opportunityData.id
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
              `Value: ${tooltipItem.value.toLocaleString()}`,
              `Status: ${tooltipItem.status}`
            ];
            
            lines.push('Click to navigate to opportunity');
            
            return lines;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          font: {
            size: 11,
          },
          padding: 5,
          color: '#666',
        },
        border: {
          display: false,
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 10,
          },
          color: '#666',
          maxRotation: 45,
          minRotation: 45,
        },
        border: {
          display: false,
        }
      },
    },
    animation: {
      duration: 500,
    },
    
    // Make the chart interactive with a cursor pointer
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
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#2196f3'; // Blue line for average like in the image
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  return (
    <AccordionSection
      title="Sales Cycle"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      
      {/* Closing Time Chart */}
      <div style={{ 
        padding: "16px", 
        borderRadius: "8px",
        marginBottom: "16px"
      }}>
        <div style={{ 
          fontSize: "14px", 
          fontWeight: "600", 
          color: "#333", 
          marginBottom: "16px" 
        }}>
          Sales Cycle Length - Last 10 Closed Opportunities
        </div>
        
        <div style={{ height: 280, position: 'relative' }}>
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
        
        {/* Average indicator - styled like in the image */}
        <div style={{ 
          display: "flex",
          alignItems: "center",
          marginTop: "16px",
          paddingTop: "8px",
          paddingBottom: "8px",
          borderTop: "1px solid #e0e0e0"
        }}>
          <div style={{ 
            display: "flex",
            alignItems: "center"
          }}>
            <div style={{ 
              width: "16px", 
              height: "2px", 
              backgroundColor: "#2196f3",
              marginRight: "6px"
            }}></div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              Average: {averageClosingTime} days
            </div>
          </div>
        </div>
      </div>
    </AccordionSection>
  );
};

export default Analytics;