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
  
  // For appointments, prefer scheduledstart
  if (activity.activitytypecode?.toLowerCase() === 'appointment') {
    return scheduled || created;
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
 * Get label describing recency of last activity
 * @param {number|null} days - Days since last activity
 * @returns {Object} Object with text and color for the label
 */
export const getActivityRecencyLabel = (days) => {
  if (days === null) return { text: "No activity", color: "#9e9e9e" };
  if (days <= 3) return { text: "Last 3 days", color: "#4caf50" };
  if (days <= 7) return { text: "Last 7 days", color: "#2196f3" };
  if (days <= 14) return { text: "Last 2 weeks", color: "#ff9800" };
  return { text: `${days} days ago`, color: "#f44336" };
};