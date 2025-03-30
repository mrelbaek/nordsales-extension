import { getActivityDate } from './activityUtils';

/**
 * Calculate days between two dates
 * @param {Date|string} startDate - Start date
 * @param {Date|string|null} endDate - End date (defaults to current date if null)
 * @returns {number} Number of days between dates
 */
export const calculateDaysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Generate a calendar for the specified month with activity indicators
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @param {Array} activities - Array of activity objects
 * @returns {Array} Calendar grid as a 2D array
 */
export const generateCalendar = (year, month, activities) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // Adjust for Monday as first day of week
  let startingDayOfWeek = firstDay.getDay() - 1;
  if (startingDayOfWeek < 0) startingDayOfWeek = 6; // Sunday becomes last
  
  const calendar = [];
  let week = Array(7).fill(null);
  
  // Fill in empty days at the beginning
  for (let i = 0; i < startingDayOfWeek; i++) {
    week[i] = { day: null, activities: [] };
  }
  
  // Map activities to dates
  const activityMap = {};
  if (activities) {
    activities.forEach(activity => {
      try {
        const activityDate = getActivityDate(activity);
        
        if (!activityDate) {
          return;
        }
        
        const isMatchingMonth = activityDate.getMonth() === month;
        const isMatchingYear = activityDate.getFullYear() === year;
        
        if (isMatchingMonth && isMatchingYear) {
          const day = activityDate.getDate();
          if (!activityMap[day]) activityMap[day] = [];
          activityMap[day].push(activity);
        }
      } catch (error) {
        console.error("Error processing activity for calendar:", error);
      }
    });
  }
  
  // Fill in the days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = (startingDayOfWeek + day - 1) % 7;
    week[dayOfWeek] = { 
      day: day, 
      activities: activityMap[day] || [],
      isToday: new Date().getDate() === day && 
                new Date().getMonth() === month && 
                new Date().getFullYear() === year
    };
    
    if (dayOfWeek === 6 || day === daysInMonth) {
      calendar.push([...week]);
      week = Array(7).fill(null);
    }
  }
  
  return calendar;
};