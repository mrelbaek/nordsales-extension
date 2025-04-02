// Base URL will be determined dynamically at runtime
// This is used as a placeholder and will be replaced with the actual URL
// based on the organization ID detected from Dynamics CRM
export const BASE_URL = null; // Set to null to indicate it needs to be determined dynamically

// Calendar constants
export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Activity color mappings
export const ACTIVITY_COLORS = {
  4201: "#4285F4", // Meeting - blue
  4202: "#0F9D58", // Email - green
  4204: "#F4B400", // Phone Call - yellow
  4210: "#DB4437", // Task - red
  default: "#9E9E9E" // gray
};

// Timeline theme
export const TIMELINE_THEME = {
  borderDotColor: '#ffffff',
  descriptionColor: '#262626',
  dotColor: '#c5c5c5',
  eventColor: '#262626',
  lineColor: '#d0cdc4',
  subtitleColor: '#7c7c7c',
  titleColor: '#405b73',
  yearColor: '#405b73',
};