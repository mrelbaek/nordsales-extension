import React, { useState, useEffect, useRef } from 'react';
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
 * Sales Cycle Chart component showing closing times for opportunities
 * 
 * @param {Object} props - Component props
 * @param {Array} props.closedOpportunities - Closed opportunities data
 * @returns {JSX.Element} Sales cycle chart component
 */
const SalesCycleChart = ({ closedOpportunities = [] }) => {
  const [averageClosingTime, setAverageClosingTime] = useState(0);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [tooltipData, setTooltipData] = useState([]);
  const chartRef = useRef(null);

  // Calculate closing times and prepare chart data
  useEffect(() => {
    console.log("[SalesCycleChart] closedOpportunities:", closedOpportunities?.length);
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
          opp.name ? (opp.name.length > 10 ? opp.name.substring(0, 10) + '...' : opp.name) : `Opp ${index + 1}`
        );
        
        // Create data array with closed opportunities
        const data = [...times];
        
        // Create background colors array - use different colors based on status
        const backgroundColors = sortedOpportunities.map(opp => {
          // Won = green, Lost = red, Default = gray
          if (opp.statecode === 1) return 'rgba(202, 238, 90, 0.7)'; // Green for won
          if (opp.statecode === 2) return 'rgba(124, 124, 129, 0.7)'; // Red for lost
          return 'rgba(189, 189, 189, 0.7)'; // Grey for others
        });
        
        setTooltipData(tooltips);
        
        // Calculate average
        const avgTime = Math.round(times.reduce((acc, time) => acc + time, 0) / (times.length || 1));
        console.log("Average closing time calculated:", avgTime, "days");
        
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
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#818183';
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  return (
    <div>
      {/* Chart Content */}
      <div style={{ 
        marginBottom: "16px",
        //backgroundColor: "#f9f9f9", //
        borderRadius: "8px",
        padding: "16px"
      }}>
        <div style={{ fontSize: "14px", color: "#333", marginBottom: "16px" }}>
          Sales Cycle Length - Last 10 Closed Opportunities
        </div>
        
        <div style={{ height: 250, position: 'relative' }}>
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
            backgroundColor: "#818183",
            marginRight: "6px"
          }}></div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            Average: {averageClosingTime} days
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesCycleChart;