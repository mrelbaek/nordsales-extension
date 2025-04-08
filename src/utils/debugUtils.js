/**
 * Debug utilities to collect and manage diagnostic information
 */

// Set up a global error logger
const errorLog = [];
const maxErrorLogSize = 50; // Limit the number of errors stored

// Original console methods
const originalConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log
};

/**
 * Initialize the debug logger by overriding console methods
 */
export const initDebugLogger = () => {
  // Override console.error to capture errors
  console.error = function(...args) {
    // Call the original method
    originalConsole.error.apply(console, args);
    
    // Store error for reporting
    const errorInfo = {
      timestamp: new Date().toISOString(),
      type: 'error',
      message: args.map(arg => {
        if (arg instanceof Error) {
          return {
            name: arg.name,
            message: arg.message,
            stack: arg.stack
          };
        } else if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return `[Object: ${typeof arg}]`;
          }
        } else {
          return String(arg);
        }
      })
    };
    
    // Add to log with limit
    errorLog.unshift(errorInfo);
    if (errorLog.length > maxErrorLogSize) {
      errorLog.pop();
    }
  };
  
  // Override console.warn to capture warnings
  console.warn = function(...args) {
    // Call the original method
    originalConsole.warn.apply(console, args);
    
    // Store warning for reporting
    const warnInfo = {
      timestamp: new Date().toISOString(),
      type: 'warning',
      message: args.map(arg => String(arg))
    };
    
    // Add to log with limit
    errorLog.unshift(warnInfo);
    if (errorLog.length > maxErrorLogSize) {
      errorLog.pop();
    }
  };
  
  // Set up global error handler
  window.addEventListener('error', (event) => {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      type: 'uncaught',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error ? event.error.stack : null
    };
    
    errorLog.unshift(errorInfo);
    if (errorLog.length > maxErrorLogSize) {
      errorLog.pop();
    }
  });
  
  // Set up promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      type: 'promise_rejection',
      message: event.reason ? (event.reason.message || String(event.reason)) : 'Unhandled Promise Rejection',
      stack: event.reason && event.reason.stack ? event.reason.stack : null
    };
    
    errorLog.unshift(errorInfo);
    if (errorLog.length > maxErrorLogSize) {
      errorLog.pop();
    }
  });
  
  // Log that debug logger was initialized
  originalConsole.log('Debug logger initialized');
};

/**
 * Collect comprehensive debug information
 * @returns {Promise<Object>} Debug information object
 */
export const collectDebugInfo = async () => {
  try {
    // Get extension state
    const storageData = await chrome.storage.local.get(null);
    
    // Get current tab information
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0] || {};
    
    // Get browser information
    const browserInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      vendor: navigator.vendor,
      cookiesEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      }
    };

    // Get extension information
    let extensionInfo = {};
    try {
      extensionInfo = await chrome.management.getSelf();
    } catch (e) {
      extensionInfo = {
        id: chrome.runtime.id,
        version: chrome.runtime.getManifest().version,
        error: e.message
      };
    }
    
    // Get memory usage if available
    let memoryInfo = null;
    if (window.performance && window.performance.memory) {
      memoryInfo = {
        jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit,
        totalJSHeapSize: window.performance.memory.totalJSHeapSize,
        usedJSHeapSize: window.performance.memory.usedJSHeapSize
      };
    }
    
    // Collect network status information if available
    let networkInfo = null;
    if (navigator.connection) {
      networkInfo = {
        downlink: navigator.connection.downlink,
        effectiveType: navigator.connection.effectiveType,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData
      };
    }
    
    // Sanitize opportunity IDs from storage for privacy
    const sanitizedStorage = { ...storageData };
    if (sanitizedStorage.currentOpportunityId) {
      sanitizedStorage.currentOpportunityId = 'REDACTED';
    }
    
    // Get the state lock status from popup.jsx if available
    let stateLockStatus = 'unknown';
    try {
      if (window.debugState && window.debugState.stateTransitionLock !== undefined) {
        stateLockStatus = window.debugState.stateTransitionLock ? 'locked' : 'unlocked';
      }
    } catch (e) {
      stateLockStatus = `error: ${e.message}`;
    }
    
    // Compile all debug information
    return {
      timestamp: new Date().toISOString(),
      extensionState: sanitizedStorage,
      browserInfo: browserInfo,
      currentTabInfo: {
        id: currentTab.id,
        url: currentTab.url ? currentTab.url.replace(/\/[^/]*$/, '/REDACTED_PATH') : 'unknown', // Redact specific path for privacy
        title: currentTab.title || 'unknown'
      },
      extensionInfo: {
        id: extensionInfo.id,
        version: extensionInfo.version,
        installType: extensionInfo.installType
      },
      memoryInfo: memoryInfo,
      networkInfo: networkInfo,
      stateLock: stateLockStatus,
      errorLog: errorLog,
      buildInfo: {
        buildDate: __BUILD_DATE__ || 'unknown', // This would be injected during build process
        buildEnv: __ENV__ || 'unknown'          // This would be injected during build process
      }
    };
  } catch (error) {
    console.error('Error collecting debug info:', error);
    
    // Return a basic error object if collection fails
    return {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack
      },
      errorLog: errorLog
    };
  }
};

/**
 * Send debug information to your backend for analysis
 * 
 * @param {Object} debugInfo - Debug information object
 * @param {string} userEmail - Optional user email for follow-up
 * @param {string} userComments - User description of the issue
 * @returns {Promise<Object>} Response from the server
 */
export const sendDebugReport = async (debugInfo, userEmail, userComments) => {
  try {
    // In a production environment, you would send this to your backend
    // For now, we'll just log it and return a success message
    
    originalConsole.log('Debug report would be sent to backend:', {
      debugInfo,
      userEmail,
      userComments
    });
    
    // Mock successful response
    return {
      success: true,
      id: `debug-${Date.now()}`,
      message: 'Debug report received. Thank you for helping improve the extension!'
    };
    
    /* Uncomment to implement real backend reporting
    const response = await fetch('https://your-backend.com/api/debug-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        debugInfo,
        userEmail,
        userComments,
        timestamp: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
    */
  } catch (error) {
    console.error('Error sending debug report:', error);
    throw error;
  }
};

/**
 * Clear the error log
 */
export const clearErrorLog = () => {
  errorLog.length = 0;
  originalConsole.log('Error log cleared');
};

/**
 * Expose debug state to window for manual debugging
 */
export const exposeDebugState = () => {
  try {
    window.debugState = window.debugState || {};
    window.debugState.errorLog = errorLog;
    window.debugState.collectDebugInfo = collectDebugInfo;
    window.debugState.clearErrorLog = clearErrorLog;
    originalConsole.log('Debug state exposed to window.debugState');
    return true;
  } catch (e) {
    originalConsole.error('Failed to expose debug state:', e);
    return false;
  }
};