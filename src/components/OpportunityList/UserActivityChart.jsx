import React, { useState, useEffect } from 'react';
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
import { fetchUserActivitiesForLastYear } from '../../utils/api';
import { getActivityDate } from '../../utils/activityUtils';

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
 * Component to display a chart of user activities over the past 12 months
 * 
 * @param {Object} props - Component props
 * @param {string} props.accessToken - Access token for API calls
 * @returns {JSX.Element} User activity chart component
 */
const UserActivityChart = ({ accessToken }) => {
  const [activitiesData, setActivitiesData] = useState({
    labels: [],
    datasets: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActivities = async () => {
      if (!accessToken) {
        setError("No access token available");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch user activities for the last 12 months
        const activities = await fetchUserActivitiesForLastYear(accessToken);
        
        // Process the data for the chart
        const monthLabels = getLastTwelveMonthLabels();
        const processedData = processActivitiesData(activities, monthLabels);
        
        setActivitiesData(processedData);
      } catch (error) {
        console.error("Error fetching user activities:", error);
        setError("Failed to load activity data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [accessToken]);

  /**
   * Generate labels for the last 12 months
   * @returns {Array} Array of month labels (e.g., "Apr 2024")
   */
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

  /**
   * Get the appropriate date for an activity, matching activityUtils.jsx logic
   * @param {Object} activity - Activity object
   * @returns {Date|null} The appropriate date for the activity
   */
  const getAppropriateActivityDate = (activity) => {
    if (!activity) return null;
    
    // Helper to safely parse dates with timezone handling
    const parseDate = (dateString) => {
      if (!dateString) return null;
      
      try {
        // Create date object and verify it's valid
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
      } catch (e) {
        console.warn("Error parsing date:", dateString, e);
        return null;
      }
    };

    // Parse all dates
    const created = parseDate(activity.createdon);
    const scheduled = parseDate(activity.scheduledstart);
    const actualstart = parseDate(activity.actualstart);
    
    // For appointments, prefer actualstart, then scheduledstart, then createdon
    if (activity.activitytypecode?.toLowerCase() === 'appointment' || activity.activitytypecode?.toLowerCase() === 'meeting') {
      return actualstart || scheduled || created;
    }

    // For tasks, prefer scheduledstart, then actualstart, then createdon
    if (activity.activitytypecode?.toLowerCase() === 'task') {
      return scheduled || actualstart || created;
    }
  
    // Default to createdon for other activity types
    return created;
  };

  /**
   * Process activities data into chart format
   * @param {Array} activities - Raw activities from API
   * @param {Array} monthLabels - Month labels (e.g., "Apr 2024")
   * @returns {Object} Formatted chart data
   */
  const processActivitiesData = (activities, monthLabels) => {
    // Define activity types and colors
    const activityTypes = {
      'appointment': { label: 'Meetings', color: 'rgba(66, 133, 244, 0.7)' },
      'email': { label: 'Emails', color: 'rgba(15, 157, 88, 0.7)' },
      'phonecall': { label: 'Calls', color: 'rgba(244, 180, 0, 0.7)' },
      'task': { label: 'Tasks', color: 'rgba(219, 68, 55, 0.7)' }
    };
    
    // Initialize counts for each month and activity type
    const activityCounts = {};
    Object.keys(activityTypes).forEach(type => {
      activityCounts[type] = Array(monthLabels.length).fill(0);
    });
    
    // Count activities by month and type
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    activities.forEach(activity => {
      // Use our consistent date logic instead of just createdon
      const activityDate = getAppropriateActivityDate(activity);
      
      if (!activityDate) return;
      
      const monthYear = `${monthNames[activityDate.getMonth()]} ${activityDate.getFullYear()}`;
      const monthIndex = monthLabels.indexOf(monthYear);
      
      if (monthIndex >= 0) {
        const type = activity.activitytypecode?.toLowerCase();
        if (activityCounts[type]) {
          activityCounts[type][monthIndex]++;
        }
      }
    });
    
    // Create datasets for the chart
    const datasets = Object.keys(activityTypes).map(type => ({
      label: activityTypes[type].label,
      data: activityCounts[type],
      backgroundColor: activityTypes[type].color,
      borderWidth: 1,
      borderRadius: 4
    }));
    
    return {
      labels: monthLabels,
      datasets
    };
  };

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
        text: 'Activity Trends (Last 12 Months)',
        font: {
          size: 14
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 10
          }
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
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

  if (loading) {
    return (
      <div style={{ 
        padding: "20px", 
        textAlign: "center", 
        backgroundColor: "#fff", 
        borderRadius: "8px",
        height: "300px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div>Loading activity data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: "20px", 
        textAlign: "center", 
        backgroundColor: "#fff", 
        color: "#d32f2f",
        borderRadius: "8px",
        border: "1px solid #ffcdd2",
        height: "300px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: "16px", 
      backgroundColor: "#fff", 
      borderRadius: "8px",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
    }}>
      <div style={{ height: "300px" }}>
        <Bar options={options} data={activitiesData} />
      </div>
    </div>
  );
};

export default UserActivityChart;