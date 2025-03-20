console.log('Background script running...');

// Initialize default values when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  
  // Set default values
  chrome.storage.local.set({
    count: 0,
    settings: {
      darkMode: false,
      notifications: true
    }
  });
});

// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.type === 'GET_DATA') {
    // Example of fetching some data
    sendResponse({ success: true, data: { timestamp: Date.now() } });
  }
  
  return true; // Indicates we will respond asynchronously
});