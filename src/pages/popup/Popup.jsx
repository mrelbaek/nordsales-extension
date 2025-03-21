import React, { useEffect, useState } from "react";
import { login, getAccessToken, logout } from "@/utils/auth";

// URLs for different API calls
const BASE_URL = "https://orga6a657bc.crm.dynamics.com/api/data/v9.0";
const OPPORTUNITIES_URL = `${BASE_URL}/opportunities?$top=5`;

const Popup = () => {
    const [accessToken, setAccessToken] = useState(null);
    const [opportunities, setOpportunities] = useState([]);
    const [currentOpportunityId, setCurrentOpportunityId] = useState(null);
    const [currentOpportunity, setCurrentOpportunity] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);
    const [autoOpen, setAutoOpen] = useState(true);

    // Fetch list of opportunities
    const fetchOpportunities = async (token) => {
        try {
            setLoading(true);
            setError(null);
            
            console.log("Fetching opportunities list...");
            console.log(`Using token: ${token.substring(0, 15)}...`);
            
            const response = await fetch(OPPORTUNITIES_URL, {
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json",
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0"
                },
            });

            console.log(`Response status: ${response.status}`);
            
            if (!response.ok) {
                // Try to get more information about the error
                let errorText = '';
                try {
                    const errorData = await response.json();
                    errorText = JSON.stringify(errorData);
                } catch (e) {
                    errorText = await response.text();
                }
                
                console.error(`API Error: ${response.status}`, errorText);
                throw new Error(`Failed to fetch data: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log(`Received ${data.value?.length || 0} opportunities`);
            setOpportunities(data.value || []);
        } catch (error) {
            console.error("Error fetching opportunities:", error);
            setError(`Failed to fetch opportunities list: ${error.message}`);
            setDebugInfo({
                errorType: "Opportunities List Error",
                message: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            setLoading(false);
        }
    };

    // Fetch details for a specific opportunity
    const fetchOpportunityDetails = async (token, oppId) => {
        if (!oppId) return;
        
        try {
            setLoading(true);
            setError(null);
            
            console.log(`Attempting to fetch opportunity details for ID: ${oppId}`);
            console.log(`Using token: ${token.substring(0, 15)}...`);
            
            // Try with different formats of the opportunity ID
            // Dynamics CRM can be picky about how IDs are formatted in the URL
            const formats = [
                `${BASE_URL}/opportunities(${oppId})`,
                `${BASE_URL}/opportunities(guid'${oppId}')`,
                `${BASE_URL}/opportunities?$filter=opportunityid eq ${oppId}`,
                `${BASE_URL}/opportunities?$filter=opportunityid eq guid'${oppId}'`
            ];
            
            let lastError = null;
            let successResponse = null;
            
            // Try each format until one works
            for (const url of formats) {
                console.log(`Trying URL format: ${url}`);
                
                try {
                    const response = await fetch(url, {
                        headers: { 
                            "Authorization": `Bearer ${token}`,
                            "Accept": "application/json",
                            "OData-MaxVersion": "4.0",
                            "OData-Version": "4.0",
                            "Content-Type": "application/json"
                        },
                    });
                    
                    console.log(`Response status for ${url}: ${response.status}`);
                    
                    if (response.ok) {
                        successResponse = response;
                        break;
                    }
                    
                    lastError = {
                        status: response.status,
                        url: url,
                        text: await response.text()
                    };
                } catch (err) {
                    console.log(`Error with format ${url}: ${err.message}`);
                    lastError = {
                        message: err.message,
                        url: url
                    };
                }
            }
            
            if (!successResponse) {
                console.error("All URL formats failed:", lastError);
                setDebugInfo({
                    errorType: "Opportunity Details Error",
                    lastError: lastError,
                    opportunityId: oppId,
                    timestamp: new Date().toISOString()
                });
                throw new Error(`Failed to fetch opportunity details: ${lastError.status || 'API Error'}`);
            }
            
            const data = await successResponse.json();
            console.log('Opportunity data received:', data);
            
            // If the response is a collection, take the first item
            if (data.value && Array.isArray(data.value) && data.value.length > 0) {
                setCurrentOpportunity(data.value[0]);
            } else {
                setCurrentOpportunity(data);
            }
        } catch (error) {
            console.error("Error fetching opportunity details:", error);
            setError(`Failed to fetch opportunity details: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Get current opportunity ID either from storage or from the active tab
    const getCurrentOpportunityId = async () => {
        try {
            // First check if it's in storage
            const storedData = await chrome.storage.local.get(['currentOpportunityId']);
            
            if (storedData.currentOpportunityId) {
                console.log("Found opportunity ID in storage:", storedData.currentOpportunityId);
                return storedData.currentOpportunityId;
            }
            
            // If not in storage, try to get it from the active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];
            
            if (activeTab.url && activeTab.url.includes('crm.dynamics.com')) {
                try {
                    console.log("Attempting to get opportunity ID from content script");
                    const response = await chrome.tabs.sendMessage(
                        activeTab.id, 
                        { type: "GET_OPPORTUNITY_ID" }
                    );
                    console.log("Content script response:", response);
                    return response?.opportunityId || null;
                } catch (err) {
                    console.warn("Could not communicate with content script:", err);
                    return null;
                }
            }
            
            return null;
        } catch (err) {
            console.error("Error getting opportunity ID:", err);
            return null;
        }
    };

    useEffect(() => {
        async function initialize() {
            try {
                // Notify service worker that popup is open
                chrome.runtime.sendMessage({ type: "POPUP_OPENED" });
                
                // Get the token
                const token = await getAccessToken();
                console.log("Got access token:", token ? "yes" : "no");
                setAccessToken(token);
                
                if (token) {
                    // Try to get current opportunity ID
                    const oppId = await getCurrentOpportunityId();
                    console.log("Current opportunity ID:", oppId);
                    setCurrentOpportunityId(oppId);
                    
                    // Fetch data
                    if (oppId) {
                        fetchOpportunityDetails(token, oppId);
                    } else {
                        fetchOpportunities(token);
                    }
                }

                // Get the auto-open preference
                chrome.storage.local.get(['autoOpen'], (result) => {
                    setAutoOpen(result.autoOpen !== false);
                });
            } catch (error) {
                console.warn("No stored access token found:", error);
            }
        }
        
        initialize();
        
        // Set up polling for opportunity ID changes
        const storageCheckInterval = setInterval(() => {
            chrome.storage.local.get(['currentOpportunityId', 'lastUpdated'], (result) => {
                if (result.currentOpportunityId && result.lastUpdated) {
                    // If the ID is different from what we have, or we don't have one
                    if (result.currentOpportunityId !== currentOpportunityId) {
                        console.log("Storage poll detected new opportunity ID:", result.currentOpportunityId);
                        setCurrentOpportunityId(result.currentOpportunityId);
                        if (accessToken) {
                            fetchOpportunityDetails(accessToken, result.currentOpportunityId);
                        }
                    }
                } else if (currentOpportunityId && !result.currentOpportunityId) {
                    // If we had an ID but it's now cleared in storage
                    console.log("Opportunity ID cleared in storage");
                    setCurrentOpportunityId(null);
                    if (accessToken) {
                        fetchOpportunities(accessToken);
                    }
                }
            });
        }, 1000); // Check every second
        
        // Listen for opportunity detection from content script
        const handleMessage = (message) => {
            console.log("Popup received message:", message.type);
            
            if (message.type === "OPPORTUNITY_DETECTED") {
                console.log("Received opportunity ID from content script:", message.opportunityId);
                setCurrentOpportunityId(message.opportunityId);
                if (accessToken) {
                    fetchOpportunityDetails(accessToken, message.opportunityId);
                }
            } else if (message.type === "OPPORTUNITY_CLEARED") {
                console.log("Opportunity cleared notification received");
                setCurrentOpportunityId(null);
                setCurrentOpportunity(null);
                if (accessToken) {
                    fetchOpportunities(accessToken);
                }
            }
        };
        
        chrome.runtime.onMessage.addListener(handleMessage);
        
        // Clean up
        return () => {
            chrome.runtime.onMessage.removeListener(handleMessage);
            clearInterval(storageCheckInterval);
        };
    }, []);

    // Watch for changes to the current opportunity ID
    useEffect(() => {
        if (accessToken && currentOpportunityId) {
            fetchOpportunityDetails(accessToken, currentOpportunityId);
        }
    }, [currentOpportunityId, accessToken]);

    const handleLogin = async () => {
        try {
            setError(null);
            const token = await login();
            console.log("Login successful, got token");
            setAccessToken(token);
            
            // Check if we have an opportunity ID
            if (currentOpportunityId) {
                fetchOpportunityDetails(token, currentOpportunityId);
            } else {
                fetchOpportunities(token);
            }
        } catch (error) {
            console.error("Login failed:", error);
            setError(`Login failed: ${error.message}`);
        }
    };

    const handleLogout = async () => {
        await logout();
        setAccessToken(null);
        setOpportunities([]);
        setCurrentOpportunity(null);
        setError(null);
        setDebugInfo(null);
    };

    const handleBackToList = () => {
        setCurrentOpportunity(null);
        fetchOpportunities(accessToken);
    };

    const clearError = () => {
        setError(null);
        setDebugInfo(null);
    };

    const toggleAutoOpen = () => {
        const newValue = !autoOpen;
        setAutoOpen(newValue);
        chrome.runtime.sendMessage({ 
            type: "SET_AUTO_OPEN", 
            enabled: newValue 
        });
    };

    // Add window style for detached popup
    useEffect(() => {
        // Set title
        document.title = "NordSales Extension";
        
        // Apply styles to make it look like a proper window
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('width', '100%');
        rootStyle.setProperty('height', '100%');
        rootStyle.setProperty('overflow', 'hidden');
        
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.height = '100%';
        document.body.style.overflow = 'auto';
        
        const root = document.getElementById('root');
        if (root) {
            root.style.height = '100%';
            root.style.overflow = 'auto';
        }
    }, []);

    return (
        <div style={{ 
            padding: "16px", 
            fontFamily: "Arial, sans-serif",
            height: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column"
        }}>
            <h2 style={{ margin: "0 0 16px 0" }}><b>NordSales Extension</b></h2>

            {/* Error message if any */}
            {error && (
                <div style={{ 
                    padding: "8px", 
                    backgroundColor: "#ffebee", 
                    color: "#c62828", 
                    borderRadius: "4px", 
                    marginBottom: "16px",
                    position: "relative"
                }}>
                    <button 
                        onClick={clearError}
                        style={{
                            position: "absolute",
                            top: "2px",
                            right: "2px",
                            background: "none",
                            border: "none",
                            fontSize: "16px",
                            cursor: "pointer",
                            color: "#c62828",
                        }}
                    >
                        ×
                    </button>
                    <div style={{ marginBottom: "4px" }}><strong>Error:</strong> {error}</div>
                    {debugInfo && (
                        <details style={{ fontSize: "12px", marginTop: "8px" }}>
                            <summary>Debug Info</summary>
                            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
                                {JSON.stringify(debugInfo, null, 2)}
                            </pre>
                        </details>
                    )}
                </div>
            )}

            {/* Show login button if no token */}
            {!accessToken && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                    <button 
                        onClick={handleLogin} 
                        style={{ 
                            padding: "10px 16px", 
                            backgroundColor: "#0078d4", 
                            color: "white", 
                            border: "none", 
                            borderRadius: "4px",
                            cursor: "pointer", 
                            width: "100%",
                            maxWidth: "300px",
                            fontSize: "14px",
                            fontWeight: "bold",
                            marginBottom: "16px" 
                        }}
                    >
                        Sign in with Microsoft
                    </button>
                </div>
            )}

            {/* Show content when logged in */}
            {accessToken && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                        <button 
                            onClick={handleLogout} 
                            style={{ 
                                padding: "8px 16px", 
                                backgroundColor: "#d32f2f", 
                                color: "white", 
                                border: "none", 
                                borderRadius: "4px",
                                cursor: "pointer", 
                                fontSize: "13px"
                            }}
                        >
                            Logout
                        </button>
                        
                        {currentOpportunity && (
                            <button 
                                onClick={handleBackToList} 
                                style={{ 
                                    padding: "8px 16px", 
                                    backgroundColor: "#424242", 
                                    color: "white", 
                                    border: "none", 
                                    borderRadius: "4px",
                                    cursor: "pointer", 
                                    fontSize: "13px"
                                }}
                            >
                                Back to List
                            </button>
                        )}
                    </div>
                    
                    <div style={{ flex: 1, overflow: "auto" }}>
                        {loading ? (
                            <div style={{ textAlign: "center", padding: "20px" }}>
                                <p>Loading...</p>
                            </div>
                        ) : currentOpportunity ? (
                            <div style={{ 
                                backgroundColor: "#f5f5f5", 
                                padding: "16px", 
                                borderRadius: "4px",
                                border: "1px solid #e0e0e0"
                            }}>
                                <h3 style={{ margin: "0 0 16px 0", color: "#0078d4" }}>
                                    {currentOpportunity.name}
                                </h3>
                                
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>ID:</strong> {currentOpportunity.opportunityid}
                                </div>
                                
                                {currentOpportunity.estimatedvalue && (
                                    <div style={{ marginBottom: "8px" }}>
                                        <strong>Estimated Value:</strong> ${currentOpportunity.estimatedvalue.toLocaleString()}
                                    </div>
                                )}
                                
                                {currentOpportunity.statuscode && (
                                    <div style={{ marginBottom: "8px" }}>
                                        <strong>Status:</strong> {currentOpportunity.statuscode}
                                    </div>
                                )}
                                
                                {currentOpportunity.createdon && (
                                    <div style={{ marginBottom: "8px" }}>
                                        <strong>Created On:</strong> {new Date(currentOpportunity.createdon).toLocaleDateString()}
                                    </div>
                                )}
                                
                                <div style={{ marginTop: "16px" }}>
                                    <a 
                                        href={`https://orga6a657bc.crm.dynamics.com/main.aspx?appid=e82f31a2-d4e4-ef11-9341-6045bd0438e7&pagetype=entityrecord&etn=opportunity&id=${currentOpportunity.opportunityid}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: "#0078d4", textDecoration: "none" }}
                                    >
                                        Open in Dynamics →
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h3 style={{ margin: "0 0 16px 0" }}>Recent Opportunities</h3>
                                {opportunities.length === 0 ? (
                                    <p>No opportunities found.</p>
                                ) : (
                                    <ul style={{ 
                                        listStyle: "none", 
                                        padding: 0, 
                                        margin: 0,
                                        maxHeight: "400px",
                                        overflowY: "auto"
                                    }}>
                                        {opportunities.map((opp) => (
                                            <li 
                                                key={opp.opportunityid}
                                                style={{ 
                                                    padding: "10px", 
                                                    marginBottom: "8px", 
                                                    backgroundColor: "#f5f5f5",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    borderLeft: "4px solid #0078d4"
                                                }}
                                                onClick={() => fetchOpportunityDetails(accessToken, opp.opportunityid)}
                                            >
                                                <div style={{ fontWeight: "bold" }}>{opp.name}</div>
                                                {opp.estimatedvalue && (
                                                    <div style={{ fontSize: "12px", marginTop: "4px" }}>
                                                        Value: ${opp.estimatedvalue.toLocaleString()}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Auto-open toggle */}
                    <div style={{ 
                        marginTop: "16px", 
                        fontSize: "13px",
                        padding: "12px",
                        backgroundColor: "#f5f5f5",
                        borderRadius: "4px",
                        borderTop: "1px solid #e0e0e0"
                    }}>
                        <label style={{ display: "flex", alignItems: "center" }}>
                            <input
                                type="checkbox"
                                checked={autoOpen}
                                onChange={toggleAutoOpen}
                                style={{ marginRight: "8px" }}
                            />
                            Auto-open when visiting Dynamics CRM
                        </label>
                    </div>
                </div>
            )}
            
            {/* Debug button for development */}
            <div style={{ marginTop: "12px", fontSize: "10px", color: "#999" }}>
                <details>
                    <summary>Debug Information</summary>
                    <div>Token exists: {accessToken ? 'Yes' : 'No'}</div>
                    <div>Current opportunity ID: {currentOpportunityId || 'None'}</div>
                    <div>Opportunities loaded: {opportunities.length}</div>
                    <div>Auto-open enabled: {autoOpen ? 'Yes' : 'No'}</div>
                </details>
            </div>
        </div>
    );
};

export default Popup;