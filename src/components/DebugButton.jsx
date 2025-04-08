import React, { useState, useEffect } from 'react';
import { PiBugBeetle } from "react-icons/pi";

/**
 * An enhanced debug button that collects comprehensive diagnostic information
 */
const DebugButton = () => {
  const [showModal, setShowModal] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  
  // Store the last 10 console errors
  const [errorLog, setErrorLog] = useState([]);
  
  // Set up error tracking when component mounts
  useEffect(() => {
    const originalConsoleError = console.error;
    const errorCapture = [];
    
    // Override console.error to capture errors
    console.error = function(...args) {
      // Call original method
      originalConsoleError.apply(console, args);
      
      // Store error for reporting (max 10)
      const errorInfo = {
        timestamp: new Date().toISOString(),
        message: args.map(arg => {
          if (arg instanceof Error) {
            return { name: arg.name, message: arg.message };
          } else if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch (e) {
              return `[Object: ${typeof arg}]`;
            }
          } else {
            return String(arg);
          }
        }).join(' ')
      };
      
      errorCapture.unshift(errorInfo);
      if (errorCapture.length > 10) {
        errorCapture.pop();
      }
      
      setErrorLog([...errorCapture]);
    };
    
    // Clean up when component unmounts
    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  // Collect comprehensive debug information
  const handleDebugClick = async () => {
    try {
      // Get browser information
      const browserInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        vendor: navigator.vendor,
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          colorDepth: window.screen.colorDepth,
          pixelDepth: window.screen.pixelDepth
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
      
      // Get extension info
      let extensionInfo = {};
      try {
        extensionInfo = {
          id: chrome.runtime.id,
          version: chrome.runtime.getManifest().version
        };
      } catch (e) {
        extensionInfo = { error: e.message };
      }
      
      // Get current URL (if possible)
      let currentUrl = 'unknown';
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0] && tabs[0].url) {
          // Sanitize URL for privacy
          const url = new URL(tabs[0].url);
          currentUrl = `${url.protocol}//${url.hostname}${url.pathname.split('/').slice(0, -1).join('/')}/[REDACTED]`;
        }
      } catch (e) {
        currentUrl = `Error getting URL: ${e.message}`;
      }
      
      // Get current state from storage
      let storageData = {};
      try {
        storageData = await chrome.storage.local.get(null);
        
        // Sanitize opportunity IDs for privacy
        if (storageData.currentOpportunityId) {
          storageData.currentOpportunityId = 'REDACTED';
        }
      } catch (e) {
        storageData = { error: e.message };
      }
      
      // Get performance metrics
      let performance = {};
      try {
        if (window.performance) {
          const perfData = window.performance;
          performance = {
            memory: perfData.memory ? {
              jsHeapSizeLimit: perfData.memory.jsHeapSizeLimit,
              totalJSHeapSize: perfData.memory.totalJSHeapSize,
              usedJSHeapSize: perfData.memory.usedJSHeapSize
            } : 'Not available',
            navigation: perfData.navigation ? {
              redirectCount: perfData.navigation.redirectCount,
              type: perfData.navigation.type
            } : 'Not available',
            timing: perfData.timing ? {
              domComplete: perfData.timing.domComplete,
              domContentLoadedEventEnd: perfData.timing.domContentLoadedEventEnd,
              loadEventEnd: perfData.timing.loadEventEnd
            } : 'Not available'
          };
        }
      } catch (e) {
        performance = { error: e.message };
      }
      
      // Compile all debug information
      const debugData = {
        timestamp: new Date().toISOString(),
        browserInfo: browserInfo,
        extensionInfo: extensionInfo,
        currentUrl: currentUrl,
        storageState: storageData,
        errorLog: errorLog,
        performanceMetrics: performance,
        buildInfo: {
          buildDate: window.__BUILD_DATE__ || 'unknown',
          environment: window.__ENV__ || 'unknown'
        }
      };
      
      setDebugInfo(debugData);
      setShowModal(true);
    } catch (error) {
      console.error('Error collecting debug information:', error);
      // Still open modal with error info
      setDebugInfo({
        error: error.message,
        timestamp: new Date().toISOString()
      });
      setShowModal(true);
    }
  };

  // Copy debug info to clipboard
  const copyToClipboard = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  // Send report via email
  const sendReport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
      window.open('https://www.lens.nordcfo.com/debugcontact', '_blank');
    } catch (error) {
      console.error('Error opening debug page or copying log:', error);
      alert('Could not open the debug page. Please visit https://www.lens.nordcfo.com/debugcontact manually.');
    }
  };
  

  return (
    <>
      <button
        onClick={handleDebugClick}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
        title="Debug"
      >
        <PiBugBeetle size={20} />
      </button>

      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              maxWidth: "700px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0" }}>Debug Information</h3>
            
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontSize: "14px", marginBottom: "8px" }}>
                This information helps us diagnose and fix issues with the NordSales extension.
              </p>
              
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <div style={{ 
                  backgroundColor: "#f0f4ff", 
                  padding: "8px", 
                  borderRadius: "4px",
                  fontSize: "12px",
                  flex: "1 0 auto"
                }}>
                  <strong>Extension Version:</strong> {debugInfo?.extensionInfo?.version || 'Unknown'}
                </div>
                <div style={{ 
                  backgroundColor: "#f0f4ff", 
                  padding: "8px", 
                  borderRadius: "4px",
                  fontSize: "12px",
                  flex: "1 0 auto"
                }}>
                  <strong>Browser:</strong> {debugInfo?.browserInfo?.vendor || ''} {debugInfo?.browserInfo?.userAgent?.split(' ').pop() || 'Unknown'}
                </div>
                <div style={{ 
                  backgroundColor: "#f0f4ff", 
                  padding: "8px", 
                  borderRadius: "4px",
                  fontSize: "12px",
                  flex: "1 0 auto"
                }}>
                  <strong>Errors:</strong> {debugInfo?.errorLog?.length || 0}
                </div>
              </div>
            </div>
            
            <pre
              style={{
                backgroundColor: "#f5f5f5",
                padding: "8px",
                borderRadius: "4px",
                overflow: "auto",
                fontSize: "12px",
                maxHeight: "300px"
              }}
            >
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
            
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between" }}>
              <div>
                <button
                  onClick={sendReport}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#0078d4",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "8px"
                  }}
                >
                  Email Report
                </button>
              </div>
              
              <div>
                <button
                  onClick={copyToClipboard}
                  style={{
                    marginRight: "8px",
                    padding: "8px 16px",
                    backgroundColor: copied ? "#4caf50" : "#f1f1f1",
                    color: copied ? "white" : "black",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
                
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#f1f1f1",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DebugButton;