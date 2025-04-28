import React from 'react';
import { ACTIVITY_COLORS } from '../constants';
import { 
  PiEnvelope, 
  PiCalendarDots, 
  PiPhoneCall, 
  PiCheckSquare, 
  PiNotePencil 
} from "react-icons/pi";

/**
 * Convert activity type codes to user-friendly labels
 * @param {string} type - Activity type code
 * @returns {string} User-friendly label
 */
export const getActivityLabel = (type) => {
  if (!type) return "Activity";
  
  // Map activity type codes to user-friendly labels
  switch (type.toLowerCase()) {
    case 'appointment': return "Meeting";
    case 'email': return "Email";
    case 'phonecall': return "Phone Call";
    case 'task': return "Task";
    default: return `Activity (${type})`;
  }
};

/**
 * Get pluralized version of activity label when needed
 * @param {string} label - Activity label
 * @param {number} count - Count of activities
 * @returns {string} Pluralized label when applicable
 */
export const getPluralLabel = (label, count) => {
  if (count <= 1) return label;
  
  // Handle specific pluralization rules
  switch (label) {
    case "Meeting": return "Meetings";
    case "Email": return "Emails";
    case "Phone Call": return "Phone Calls";
    case "Task": return "Tasks";
    default: return `${label}s`;
  }
};

/**
 * Get icon component for a given activity type
 * @param {string} type - Activity type
 * @returns {React.Element} Icon component
 */
export const getIconForActivity = (type) => {
  if (!type) return <PiNotePencil size={18} color="#555" />;
  
  switch (type.toLowerCase()) {
    case 'email': return <PiEnvelope size={18} color="#555" />;
    case 'meeting': return <PiCalendarDots size={18} color="#555" />;
    case 'phone call': return <PiPhoneCall size={18} color="#555" />;
    case 'task': return <PiCheckSquare size={18} color="#555" />;
    default: return <PiNotePencil size={18} color="#555" />;
  }
};

/**
 * Get color for an activity based on its type code
 * @param {string|number} typeCode - Activity type code
 * @returns {string} HEX color code
 */
export const getActivityColor = (typeCode) => {
  const code = parseInt(typeCode, 10);
  return ACTIVITY_COLORS[code] || ACTIVITY_COLORS.default;
};

/**
 * Summarize activities by type with counts
 * @param {Array} activities - Array of activity objects
 * @returns {Array} Summary of activities by type
 */
export const summarizeActivities = (activities) => {
  if (!activities || activities.length === 0) return [];
  
  const summary = {};
  
  activities.forEach(activity => {
    if (!activity) return;
    // Get the user-friendly label right away
    const label = getActivityLabel(activity.activitytypecode);
    
    // Use label as the key for grouping
    if (!summary[label]) {
      summary[label] = {
        count: 0,
        label: label
      };
    }
    summary[label].count++;
  });
  
  // Convert to array with all necessary properties
  return Object.values(summary).map(item => ({
    ...item,
    icon: getIconForActivity(item.label)
  }));
};

/**
 * Get the appropriate date to use for an activity
 * @param {Object} activity - Activity object
 * @returns {Date|null} The appropriate date for the activity
 */
export const getActivityDate = (activity) => {
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
  const scheduledEnd = parseDate(activity.scheduledend);
  const actualstart = parseDate(activity.actualstart);
  
  // For appointments, prefer scheduledstart
  if (activity.activitytypecode?.toLowerCase() === 'appointment' || 'meeting') {
    return actualstart || scheduled || created;
  }

    // For appointments, prefer scheduledstart
    if (activity.activitytypecode?.toLowerCase() === 'task') {
      return scheduled || actualstart || created || scheduledEnd;
    }
  
  // Default to createdon for other activity types
  return created;
};

/**
 * Calculate days since last contact based on activities
 * @param {Array} activities - Array of activity objects
 * @returns {Object|null} Information about last contact
 */
export const calculateDaysSinceLastContact = (activities) => {
  if (!activities || activities.length === 0) return null;
  
  // Sort activities by date, most recent first
  const sortedActivities = [...activities]
    .map(a => ({ ...a, _dateUsed: getActivityDate(a) }))
    .filter(a => a._dateUsed)
    .sort((a, b) => b._dateUsed - a._dateUsed);
  
  const lastActivityDate = sortedActivities.length > 0 ? sortedActivities[0]._dateUsed : null;
  
  if (!lastActivityDate) return null;
  
  const today = new Date();
  const diffTime = Math.abs(today - lastActivityDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    days: diffDays,
    date: lastActivityDate,
    activity: sortedActivities[0]
  };
};

/**
 * Get a formatted label for how recent an activity was
 * @param {number} days - Number of days since last activity
 * @returns {Object} Object containing text and color for the label
 */
export const getActivityRecencyLabel = (days) => {
  if (days === null) {
    return { text: "No activity", color: "#9e9e9e" };
  }
  if (days === 0) {
    return { text: "Today", color: "#4caf50" };
  }
  if (days === 1) {
    return { text: "Yesterday", color: "#4caf50" };
  }
  if (days <= 7) {
    return { text: `${days} days ago`, color: "#4caf50" };
  }
  if (days <= 14) {
    return { text: `${days} days ago`, color: "#8bc34a" };
  }
  if (days <= 30) {
    return { text: `${days} days ago`, color: "#ff9800" };
  }
  return { text: `${days} days ago`, color: "#f44336" };
};

/**
 * Get the latest activity date for an opportunity
 * @param {Object} opportunity - Opportunity object with activities array
 * @returns {Date|null} Latest activity date or null if no activities
 */
export const getLatestActivityDate = (opportunity) => {
  if (!opportunity || !Array.isArray(opportunity.activities) || opportunity.activities.length === 0) {
    return null;
  }
  
  try {
    const activities = opportunity.activities;
    const activityDates = activities
      .map(activity => {
        const date = getActivityDate(activity);
        return date ? date.getTime() : 0;
      })
      .filter(timestamp => timestamp > 0);
    
    if (activityDates.length === 0) return null;
    
    const latestTimestamp = Math.max(...activityDates);
    return new Date(latestTimestamp);
  } catch (err) {
    console.warn('Error getting latest activity date:', err);
    return null;
  }
};

/**
 * Sort opportunities based on specified criteria
 * @param {Array} opportunities - Array of opportunity objects
 * @param {string} sortOption - Sort option ('value', 'closingDate', or 'lastActivity')
 * @returns {Array} Sorted opportunities array
 */
export const sortOpportunities = (opportunities, sortOption, sortDirection = 'desc') => {
  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return [];
  }
  
  const opportunitiesToSort = [...opportunities];
  let sortedOpportunities = [];
  
  switch (sortOption) {
    case 'value':
      sortedOpportunities = opportunitiesToSort.sort((a, b) => 
        (b.estimatedvalue || 0) - (a.estimatedvalue || 0)
      );
      break;
      
    case 'closingDate':
      sortedOpportunities = opportunitiesToSort.sort((a, b) => {
        const dateA = a.estimatedclosedate ? new Date(a.estimatedclosedate) : new Date(9999, 11, 31);
        const dateB = b.estimatedclosedate ? new Date(b.estimatedclosedate) : new Date(9999, 11, 31);
        return dateA - dateB;
      });
      break;
      
    case 'lastActivity':
      sortedOpportunities = opportunitiesToSort.sort((a, b) => {
        const dateA = getLatestActivityDate(a);
        const dateB = getLatestActivityDate(b);
        
        // Handle cases where one or both opportunities have no activities
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1; // b comes first (has activity)
        if (!dateB) return -1; // a comes first (has activity)
        
        // Sort by most recent activity first
        return dateB - dateA;
      });
      break;
      
    default:
      sortedOpportunities = opportunitiesToSort;
  }
  
  // If ascending order is requested, reverse the sorted array
  // This handles 'lastActivity' differently - for ascending, items with no activity come first
  if (sortDirection === 'asc') {
    if (sortOption === 'lastActivity') {
      return sortedOpportunities.sort((a, b) => {
        const dateA = getLatestActivityDate(a);
        const dateB = getLatestActivityDate(b);
        
        // Handle cases where one or both opportunities have no activities
        if (!dateA && !dateB) return 0;
        if (!dateA) return -1; // a comes first (no activity)
        if (!dateB) return 1; // b comes first (no activity)
        
        // Sort by oldest activity first
        return dateA - dateB;
      });
    } else {
      return sortedOpportunities.reverse();
    }
  }
  
  return sortedOpportunities;
};