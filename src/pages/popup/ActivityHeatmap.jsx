import React, { useMemo } from 'react';

/**
 * A weekly activity summary component with color-coded intensity
 * 
 * @param {Object} props Component props
 * @param {Array} props.activities Array of activity objects with createdon dates
 * @param {number} props.weeks Number of weeks to display (default: 8)
 * @param {number} props.height Height of the component in pixels (default: 24)
 * @returns {JSX.Element} The rendered component
 */
const WeeklyActivitySummary = ({ 
  activities = [], 
  weeks = 8, 
  height = 24,
  maxColorLevel = 4
}) => {
  // Process activities data to create our weekly summary
  const weeklyData = useMemo(() => {
    if (!activities || activities.length === 0) return [];
    
    // Create an array to store counts per week
    const weeklyCounts = Array(weeks).fill(0);
    
    // Get date range
    const today = new Date();
    const endOfCurrentWeek = new Date(today);
    // Adjust to end of current week (Saturday)
    const day = endOfCurrentWeek.getDay();
    endOfCurrentWeek.setDate(today.getDate() + (day === 0 ? 0 : 6 - day));
    
    // Calculate start date (beginning of first week to show)
    const startDate = new Date(endOfCurrentWeek);
    startDate.setDate(endOfCurrentWeek.getDate() - (7 * (weeks - 1)));
    
    // Process each activity
    activities.forEach(activity => {
      if (!activity.createdon) return;
      
      const activityDate = new Date(activity.createdon);
      // Skip if activity is before our start date
      if (activityDate < startDate) return;
      
      // Calculate which week this activity belongs to
      const diffTime = Math.abs(endOfCurrentWeek - activityDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(diffDays / 7);
      
      // Make sure it's within our range
      if (weekIndex < weeks) {
        // Count is from newest to oldest
        weeklyCounts[weekIndex]++;
      }
    });
    
    // Find maximum count to normalize color intensity
    const maxCount = Math.max(...weeklyCounts, 1);
    
    // Format data for rendering
    return weeklyCounts.map(count => {
      // Calculate color level (0-4)
      let level = 0;
      if (count > 0) {
        // Normalize to colorLevels (1-maxColorLevel)
        level = Math.min(
          Math.ceil((count / maxCount) * maxColorLevel),
          maxColorLevel
        );
      }
      
      return { count, level };
    }).reverse(); // Reverse to show oldest to newest (left to right)
  }, [activities, weeks, maxColorLevel]);
  
  // Get color for activity level
  const getColorForLevel = (level) => {
    // Color scheme similar to the image example
    switch (level) {
      case 0: return "#ebedf0"; // No activities
      case 1: return "#c6e48b"; // Few activities
      case 2: return "#7bc96f"; // Some activities
      case 3: return "#239a3b"; // Many activities
      case 4: return "#196127"; // Lots of activities
      default: return "#ebedf0";
    }
  };
  
  return (
    <div 
      className="weekly-activity-summary"
      style={{ 
        height: `${height}px`,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '4px'
      }}
    >
      {weeklyData.map((week, index) => (
        <div 
          key={`week-${index}`}
          className="week-cell"
          title={`${week.count} ${week.count === 1 ? 'activity' : 'activities'} ${index === 0 ? 'in the earliest week' : index === weeklyData.length - 1 ? 'in the current week' : `${weeklyData.length - 1 - index} weeks ago`}`}
          style={{ 
            flex: 1,
            height: '100%',
            backgroundColor: getColorForLevel(week.level),
            borderRadius: '2px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {week.count > 0 && (
            <span style={{
              fontSize: '10px',
              fontWeight: 'bold',
              color: week.level >= 3 ? '#fff' : '#333'
            }}>
              {week.count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default WeeklyActivitySummary;