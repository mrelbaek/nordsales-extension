import React, { useEffect, useState } from "react";
import { login, getAccessToken, logout } from "@/utils/auth";
import { PiEnvelope, PiCalendarDots, PiPhoneCall, PiCheckSquare, PiNotePencil } from "react-icons/pi";


// Base URL for API calls - replace with your actual org ID
const BASE_URL = "https://orga6a657bc.crm.dynamics.com/api/data/v9.0";

// Calendar constants
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const Popup = () => {
    const [accessToken, setAccessToken] = useState(null);
    const [opportunities, setOpportunities] = useState([]);
    const [currentOpportunityId, setCurrentOpportunityId] = useState(null);
    const [currentOpportunity, setCurrentOpportunity] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);
    const [autoOpen, setAutoOpen] = useState(true);
    const [accordionState, setAccordionState] = useState({
        statistics: true,
        entries: true,
        analytics: true,
        timeline: true
    });
    const [selectedDate, setSelectedDate] = useState(null);
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

    // 1. Convert activity type codes to labels right away
    const getActivityLabel = (type) => {
        // Map activity type codes to user-friendly labels
        switch (type.toLowerCase()) {
        case 'appointment': return "Meeting";
        case 'email': return "Email";
        case 'phonecall': return "Phone Call";
        case 'task': return "Task";
        default: return `Activity (${type})`;
        }
    };

    // 2. Get pluralized version when needed
    const getPluralLabel = (label, count) => {
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
    
    // 3. Simple icon mapping function as you suggested
    const getIconForActivity = (type) => {
        if (!type) return <PiNotePencil size={18} color="#555" />;
        
        switch (type.toLowerCase()) {
        case 'email': return <PiEnvelope size={18} color="#555" />;
        case 'meeting': return <PiCalendarDots size={18} color="#555" />;
        case 'phone call': return <PiPhoneCall size={18} color="#555" />;
        case 'task': return <PiCheckSquare size={18} color="#555" />;
        default: return <PiNotePencil size={18} color="#555" />;
        }
    };


    // 4. Simplified activity summarization function
    const summarizeActivities = (activities) => {
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

    // 8. Color function remains the same but we could simplify it too if needed
    const getActivityColor = (typeCode) => {
        switch (parseInt(typeCode, 10)) {
        case 4201: return "#4285F4"; // Meeting - blue
        case 4202: return "#0F9D58"; // Email - green
        case 4204: return "#F4B400"; // Phone Call - yellow
        case 4210: return "#DB4437"; // Task - red
        default: return "#9E9E9E"; // gray
        }
    };
    
    // Calculate days between two dates
    const calculateDaysBetween = (startDate, endDate) => {
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : new Date();
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Get activity recency label
    const getActivityRecencyLabel = (days) => {
        if (days === null) return { text: "No activity", color: "#9e9e9e" };
        if (days <= 3) return { text: "Recent", color: "#4caf50" };
        if (days <= 7) return { text: "This week", color: "#2196f3" };
        if (days <= 14) return { text: "Last 2 weeks", color: "#ff9800" };
        return { text: `${days} days ago`, color: "#f44336" };
    };

    /**
     * Creates a header element with consistent styling
     * 
     * @param {Object} options - Header options
     * @param {string} options.title - The title to display in the header
     * @param {boolean} options.showBackButton - Whether to show the back button
     * @param {Function} options.onBackClick - Function to call when back button is clicked
     * @param {Function} options.onMenuClick - Function to call when menu button is clicked
     * @param {Function} options.onSettingsClick - Function to call when settings button is clicked
     * @returns {JSX.Element} The header element
     */
    function createHeader(options = {}) {
        const {
        title = "Nordsales",
        showBackButton = true,
        onBackClick = () => {},
        onMenuClick = () => {},
        onSettingsClick = () => {}
        } = options;
        
        return (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", overflow: "auto" }}>
            <div style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            borderRadius: "4px",
            boxSizing: "border-box",
            justifyContent: "space-between",
            padding: "10px 12px",
            backgroundColor: "#f3f2f1",
            border: "1px solid #e0e0e0",
            fontFamily: "Segoe UI, sans-serif",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button 
                onClick={onMenuClick}
                style={{
                    background: "none",
                    border: "none",
                    fontSize: "18px",
                    cursor: "pointer"
                }}
                >
                ☰
                </button>
                <span style={{ fontSize: "16px", fontWeight: "500", letterSpacing: "-0.5px" }}>
                {title}
                </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button 
                onClick={onSettingsClick}
                style={{
                    background: "none",
                    border: "none",
                    fontSize: "18px",
                    cursor: "pointer"
                }}
                >
                ⚙
                </button>
                {showBackButton && (
                <button 
                    onClick={onBackClick} 
                    style={{  
                    background: "none", 
                    border: "none", 
                    cursor: "pointer", 
                    fontSize: "18px"
                    }}
                >
                    x
                </button>
                )}
            </div>
            </div>
        </div>
        );
    }
  
    const fetchOpportunitiesWithActivities = async (token, userId) => {
        try {
            setLoading(true);
            setError(null);
            
            // Get current user ID if not provided
            let currentUserId = userId;
            if (!currentUserId) {
                const userResponse = await fetch(`${BASE_URL}/WhoAmI`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                    },
                });
    
                const userData = await userResponse.json();
                currentUserId = userData.UserId;
            }
    
            console.log("Fetching opportunities list...");
            
            // First get opportunities
            const url = `${BASE_URL}/opportunities?$filter=statecode eq 0 and _ownerid_value eq ${currentUserId}&$select=name,opportunityid,_customerid_value,createdon,statecode,estimatedvalue,estimatedclosedate,actualclosedate&$expand=customerid_account($select=name)`;
            
            const response = await fetch(url, {
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json",
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0",
                    "Content-Type": "application/json"
                },
            });
            
            if (!response.ok) {
                // Error handling code - keep what you have
                throw new Error(`Failed to fetch data: ${response.status}`);
            }
    
            const data = await response.json();
            const opportunities = data.value || [];
            console.log(`Received ${opportunities.length} opportunities`);
            
            // For each opportunity, fetch the most recent activity
            const opportunitiesWithActivities = await Promise.all(
                opportunities.map(async (opp) => {
                    try {
                        // Get activities for this opportunity
                        const activitiesUrl = `${BASE_URL}/activitypointers?$filter=_regardingobjectid_value eq ${opp.opportunityid}&$select=activityid,createdon&$orderby=createdon desc&$top=1`;
                        
                        const activitiesResponse = await fetch(activitiesUrl, {
                            headers: { 
                                "Authorization": `Bearer ${token}`,
                                "Accept": "application/json",
                                "OData-MaxVersion": "4.0",
                                "OData-Version": "4.0",
                                "Content-Type": "application/json"
                            },
                        });
                        
                        if (activitiesResponse.ok) {
                            const activitiesData = await activitiesResponse.json();
                            const activities = activitiesData.value || [];
                            
                            // Add lastActivity property to opportunity
                            return {
                                ...opp,
                                lastActivity: activities.length > 0 ? activities[0].createdon : null
                            };
                        } else {
                            console.warn(`Could not fetch activities for opportunity ${opp.opportunityid}`);
                            return {
                                ...opp,
                                lastActivity: null
                            };
                        }
                    } catch (error) {
                        console.error(`Error fetching activities for opportunity ${opp.opportunityid}:`, error);
                        return {
                            ...opp,
                            lastActivity: null
                        };
                    }
                })
            );
            
            setOpportunities(opportunitiesWithActivities);
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


    // Helper function to calculate days since last contact
    const calculateDaysSinceLastContact = (activities) => {
        if (!activities || activities.length === 0) return null;
        
        // Sort activities by date, most recent first
        const sortedActivities = [...activities].sort((a, b) => 
            new Date(b.createdon) - new Date(a.createdon)
        );
        
        const lastActivityDate = new Date(sortedActivities[0].createdon);
        const today = new Date();
        const diffTime = Math.abs(today - lastActivityDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
            days: diffDays,
            date: lastActivityDate,
            activity: sortedActivities[0]
        };
    };

    // Timeline Log color stuff
    const timelineTheme = {
        borderDotColor: '#ffffff',
        descriptionColor: '#262626',
        dotColor: '#c5c5c5',
        eventColor: '#262626',
        lineColor: '#d0cdc4',
        subtitleColor: '#7c7c7c',
        titleColor: '#405b73',
        yearColor: '#405b73',
      };

    // Generate calendar for current month
    const generateCalendar = (year, month, activities) => {
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
                const date = new Date(activity.createdon);
                if (date.getMonth() === month && date.getFullYear() === year) {
                    const day = date.getDate();
                    if (!activityMap[day]) activityMap[day] = [];
                    activityMap[day].push(activity);
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

    // Fetch details for a specific opportunity
    const fetchOpportunityDetails = async (token, oppId) => {
        if (!oppId) return;
        
        try {
            setLoading(true);
            setError(null);
            
            console.log(`Fetching opportunity details for ID: ${oppId}`);
            
            // First API call - get detailed opportunity information with customer data
            const opportunityUrl = `${BASE_URL}/opportunities?$select=name,opportunityid,_customerid_value,createdon,statecode,estimatedvalue,estimatedclosedate,actualclosedate&$expand=customerid_account($select=name)&$filter=opportunityid eq ${oppId}`;
            
            const opportunityResponse = await fetch(opportunityUrl, {
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json",
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0",
                    "Content-Type": "application/json"
                },
            });
            
            if (!opportunityResponse.ok) {
                const errorText = await opportunityResponse.text();
                throw new Error(`Failed to fetch opportunity details: ${opportunityResponse.status} - ${errorText}`);
            }
            
            const opportunityData = await opportunityResponse.json();
            console.log('Opportunity data received:', opportunityData);
            
            // Check if we got results
            if (!opportunityData.value || opportunityData.value.length === 0) {
                throw new Error("No opportunity found with that ID");
            }
            
            const opportunity = opportunityData.value[0];
            
            // Second API call - get related activities for this opportunity
            const activitiesUrl = `${BASE_URL}/activitypointers?$filter=_regardingobjectid_value eq ${oppId}&$select=activityid,subject,activitytypecode,actualstart,actualend,createdon&$orderby=createdon desc`;
            
            const activitiesResponse = await fetch(activitiesUrl, {
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json",
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0",
                    "Content-Type": "application/json"
                },
            });
            
            // Process the activities data if the request was successful
            let activities = [];
            if (activitiesResponse.ok) {
                const activitiesData = await activitiesResponse.json();
                activities = activitiesData.value || [];
                console.log('Activities data received:', activities);

                // Debug activity types
                if (activities.length > 0) {
                    console.log('Activity type examples:');
                    activities.slice(0, 3).forEach(activity => {
                        console.log(`Type code: ${activity.activitytypecode}, Label: ${getActivityLabel(activity.activitytypecode)}`);
                    });
                }

            } else {
                console.warn(`Could not fetch activities: ${activitiesResponse.status}`);
            }
            
            // Combine the opportunity and activities data
            setCurrentOpportunity({
                ...opportunity,
                activities: activities
            });
            
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
            console.log("Tabs found:", tabs.length, "First tab URL:", tabs[0]?.url);
            const activeTab = tabs[0];

            if (tabs.length > 0 && tabs[0].url && tabs[0].url.includes('crm.dynamics.com')) {
                try {
                    console.log("Sending message to tab ID:", tabs[0].id);
                    
                    // Set up a timeout promise to avoid hanging if communication fails
                    const messagePromise = chrome.tabs.sendMessage(tabs[0].id, { type: "CHECK_OPPORTUNITY_ID" });
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("Message timeout after 3 seconds")), 3000)
                    );
                    
                    // Race the message against the timeout
                    const response = await Promise.race([messagePromise, timeoutPromise]);
                    console.log("Response received:", response);
                    
                    if (response && response.opportunityId) {
                        // Store the ID so we don't have to ask again
                        chrome.storage.local.set({ 
                            currentOpportunityId: response.opportunityId,
                            lastUpdated: Date.now() 
                        });
                        
                        return response.opportunityId;
                    }
                } catch (err) {
                    console.warn("Could not communicate with content script:", err);
                    
                    // Instead of just continuing with no ID, check if a URL parameter exists
                    // As a fallback, try to parse the URL directly
                    if (activeTab.url) {
                        console.log("Attempting to extract ID from URL as fallback");
                        const urlObj = new URL(activeTab.url);
                        const idParam = urlObj.searchParams.get('id');
                        
                        if (idParam) {
                            console.log("Found ID in URL parameters:", idParam);
                            // Store the ID
                            chrome.storage.local.set({ 
                                currentOpportunityId: idParam,
                                lastUpdated: Date.now(),
                                source: "url_fallback"
                            });
                            return idParam;
                        }
                    }
                }
            }

            // Log when no opportunity ID was found
            console.log("No opportunity ID could be found");
            return null;
            
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
                        fetchOpportunitiesWithActivities(token);
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
                        fetchOpportunitiesWithActivities(accessToken);
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
                    fetchOpportunitiesWithActivities(accessToken);
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
                fetchOpportunitiesWithActivities(token);
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
        fetchOpportunitiesWithActivities(accessToken);
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

    const toggleAccordion = (section) => {
        setAccordionState({
            ...accordionState,
            [section]: !accordionState[section]
        });
    };

    const navigateCalendar = (direction) => {
        let newMonth = calendarMonth;
        let newYear = calendarYear;
        
        if (direction === 'next') {
            newMonth++;
            if (newMonth > 11) {
                newMonth = 0;
                newYear++;
            }
        } else {
            newMonth--;
            if (newMonth < 0) {
                newMonth = 11;
                newYear--;
            }
        }
        
        setCalendarMonth(newMonth);
        setCalendarYear(newYear);
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
            padding: "0", 
            fontFamily: "Arial, sans-serif",
            height: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f3f2f1"
        }}>
            {/* Error message if any */}
            {error && (
                <div style={{ 
                    padding: "8px", 
                    backgroundColor: "#f3f2f1", 
                    color: "#c62828", 
                    borderRadius: "4px", 
                    margin: "8px",
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
                </div>
            )}

            {/* Show login button if no token */}
            {!accessToken && (
                <div style={{ 
                    flex: 1, 
                    display: "flex", 
                    flexDirection: "column", 
                    justifyContent: "center", 
                    alignItems: "center",
                    padding: "20px"
                }}>
                    <h2 style={{ marginBottom: "20px" }}>NordSales Extension</h2>
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
                            fontWeight: "bold"
                        }}
                    >
                        Sign in with Microsoft
                    </button>
                </div>
            )}

            {/* Show content when logged in */}
            {accessToken && currentOpportunity && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%", overflow: "auto" }}>
                    {createHeader({
                    title: "Nordsales",
                    showBackButton: true,
                    onBackClick: handleBackToList
                    })}

                    {/* Opportunity Name */}
                    <div>
                        <h3 style={{
                            padding: "12px 16px 0px 16px",
                            display: "flex",
                            color: "#1f2223",
                            fontSize: "14px",
                            marginBottom: "2px"
                        }}>{currentOpportunity.name}</h3>
                        
                        {currentOpportunity.createdon && (
                        <div style={{ 
                            marginBottom: "8px", 
                            padding: "2px 16px",
                            display: "flex",
                            alignItems: "center",
                            fontWeight: "500",
                            color: "#5f646a"
                        }}>
                        <p>Created On:&nbsp;</p> {new Date(currentOpportunity.createdon).toLocaleDateString()}
                        </div>
                        )}
                    </div>

                    {/* Main Content Area - Scrollable */}
                    <div style={{ flex: 1, overflow: "auto", padding: "0 16px 16px 16px" }}>
                        {/* Action Buttons */}
                        <div style={{ 
                            display: "flex", 
                            gap: "10px", 
                            margin: "16px 0" 
                        }}>
                            <button style={{ 
                                flex: 1, 
                                padding: "10px 0", 
                                backgroundColor: "white", 
                                border: "1px solid #ccc", 
                                borderRadius: "6px", 
                                cursor: "pointer" 
                            }}>
                                Save
                            </button>
                            <button style={{ 
                                flex: 1, 
                                padding: "10px 0", 
                                backgroundColor: "white", 
                                border: "1px solid #ccc", 
                                borderRadius: "6px", 
                                cursor: "pointer" 
                            }}>
                                Add to list
                            </button>
                        </div>

                        {/* Statistics Section */}
                        <div style={{ marginBottom: "16px", backgroundColor: "white", borderRadius: "8px", overflow: "hidden" }}>
                            <div 
                                onClick={() => toggleAccordion('statistics')} 
                                style={{ 
                                    padding: "12px 16px", 
                                    cursor: "pointer", 
                                    display: "flex", 
                                    justifyContent: "space-between", 
                                    alignItems: "center",
                                    borderBottom: accordionState.statistics ? "1px solid #e0e0e0" : "none"
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center" }}>
                                    <span style={{ marginRight: "8px" }}>{accordionState.statistics ? "▼" : "►"}</span>
                                    <h3 style={{ margin: "0", fontSize: "16px" }}>Statistics</h3>
                                </div>
                            </div>
                            
                            {accordionState.statistics && (
                                <div style={{ padding: "16px" }}>
                                    {currentOpportunity.activities && currentOpportunity.activities.length > 0 ? (
                                        <div>
                                            {summarizeActivities(currentOpportunity.activities).map((stat, index) => (
                                            <div 
                                                key={index} 
                                                style={{ 
                                                display: "flex", 
                                                alignItems: "center", 
                                                marginBottom: "12px"
                                                }}
                                            >
                                                <div style={{ 
                                                width: "24px", 
                                                height: "24px", 
                                                display: "flex", 
                                                alignItems: "center", 
                                                justifyContent: "center", 
                                                marginRight: "12px",
                                                fontSize: "16px"
                                                }}>
                                                {stat.icon}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                {stat.count} {getPluralLabel(stat.label, stat.count)}
                                                </div>
                                            </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p>No activities recorded yet.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Calendar Entries Section */}
                        <div style={{ marginBottom: "16px", backgroundColor: "white", borderRadius: "8px", overflow: "hidden" }}>
                            <div 
                                onClick={() => toggleAccordion('entries')} 
                                style={{ 
                                    padding: "12px 16px", 
                                    cursor: "pointer", 
                                    display: "flex", 
                                    justifyContent: "space-between", 
                                    alignItems: "center",
                                    borderBottom: accordionState.entries ? "1px solid #e0e0e0" : "none"
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center" }}>
                                    <span style={{ marginRight: "8px" }}>{accordionState.entries ? "▼" : "►"}</span>
                                    <h3 style={{ margin: "0", fontSize: "16px" }}>Entries</h3>
                                </div>
                            </div>
                            
                            {accordionState.entries && (
                                <div style={{ padding: "16px" }}>
                                    {/* Calendar Header */}
                                    <div style={{ 
                                        display: "flex", 
                                        justifyContent: "space-between", 
                                        marginBottom: "16px",
                                        alignItems: "center"
                                    }}>
                                        <button 
                                            onClick={() => navigateCalendar('prev')}
                                            style={{
                                                border: "none",
                                                background: "none",
                                                cursor: "pointer",
                                                fontSize: "16px"
                                            }}
                                        >
                                            ◀
                                        </button>
                                        <h4 style={{ margin: "0" }}>{MONTHS[calendarMonth]} {calendarYear}</h4>
                                        <button 
                                            onClick={() => navigateCalendar('next')}
                                            style={{
                                                border: "none",
                                                background: "none",
                                                cursor: "pointer",
                                                fontSize: "16px"
                                            }}
                                        >
                                            ▶
                                        </button>
                                    </div>
                                    
                                    {/* Calendar Grid */}
                                    <div>
                                        {/* Day headers */}
                                        <div style={{ 
                                            display: "grid", 
                                            gridTemplateColumns: "repeat(7, 1fr)",
                                            textAlign: "center",
                                            // fontWeight: "bold", //
                                            fontSize: "12px",
                                            color: "#666",
                                            marginBottom: "8px"
                                        }}>
                                            {DAYS_OF_WEEK.map(day => (
                                                <div key={day}>{day}</div>
                                            ))}
                                        </div>
                                        
                                        {/* Calendar days */}
                                        {generateCalendar(calendarYear, calendarMonth, currentOpportunity.activities).map((week, weekIndex) => (
                                            <div key={weekIndex} style={{ 
                                                display: "grid", 
                                                gridTemplateColumns: "repeat(7, 1fr)",
                                                gap: "4px",
                                                marginBottom: "4px"
                                            }}>
                                                {week.map((day, dayIndex) => (
                                                    <div key={dayIndex} style={{ 
                                                        height: "30px",
                                                        textAlign: "center",
                                                        position: "relative",
                                                        display: "flex",
                                                        justifyContent: "center",
                                                        alignItems: "center",
                                                        fontSize: "14px",
                                                        //borderRadius: "50%",//
                                                        backgroundColor: day?.isToday ? "#e0ff82" : "transparent",
                                                        color: day?.isToday ? "#1f2223" : day?.day ? "black" : "#ccc",
                                                        cursor: day?.activities.length > 0 ? "pointer" : "default"
                                                        // border: day?.activities.length > 0 ? "2px solid #4285F4" : "none"//
                                                    }}
                                                    onClick={() => day?.activities.length > 0 && setSelectedDate(new Date(calendarYear, calendarMonth, day.day))}
                                                    >
                                                        {day?.day}
                                                        {day?.activities.length > 0 && (
                                                            <span style={{ 
                                                                position: "absolute", 
                                                                bottom: "-2px", 
                                                                // right: "-2px", //
                                                                width: "6px", 
                                                                height: "6px", 
                                                                borderRadius: "50%", 
                                                                backgroundColor: "#1f2223" 
                                                            }}></span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Selected Date Activities */}
                                    {selectedDate && (
                                        <div style={{ marginTop: "16px" }}>
                                            <h4 style={{ margin: "0 0 12px 0" }}>
                                                Activities on {selectedDate.toLocaleDateString()}:
                                            </h4>
                                            {currentOpportunity.activities
                                                .filter(activity => {
                                                    const activityDate = new Date(activity.createdon);
                                                    return activityDate.getDate() === selectedDate.getDate() &&
                                                           activityDate.getMonth() === selectedDate.getMonth() &&
                                                           activityDate.getFullYear() === selectedDate.getFullYear();
                                                })
                                                .map(activity => (
                                                    <div 
                                                        key={activity.activityid}
                                                        style={{
                                                            padding: "8px",
                                                            borderLeft: `4px solid ${getActivityColor(activity.activitytypecode)}`,
                                                            backgroundColor: "#f5f5f5",
                                                            marginBottom: "8px",
                                                            borderRadius: "4px"
                                                        }}
                                                    >
                                                        <div style={{ fontWeight: "bold" }}>{activity.subject}</div>
                                                        <div style={{ fontSize: "12px", verticalAlign: "middle" }}>
                                                            {getIconForActivity(getActivityLabel(activity.activitytypecode))} {getActivityLabel(activity.activitytypecode)}
                                                        </div>
                                                        <div style={{ fontSize: "12px", color: "#666" }}>
                                                            {new Date(activity.createdon).toLocaleTimeString()}
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                            <button
                                                onClick={() => setSelectedDate(null)}
                                                style={{
                                                    border: "none",
                                                    background: "none",
                                                    color: "#0078d4",
                                                    cursor: "pointer",
                                                    padding: "4px 0",
                                                    textDecoration: "underline",
                                                    fontSize: "13px"
                                                }}
                                            >
                                                Clear selection
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Analytics Section */}
                        <div style={{ marginBottom: "16px", backgroundColor: "white", borderRadius: "8px", overflow: "hidden" }}>
                            <div 
                                onClick={() => toggleAccordion('analytics')} 
                                style={{ 
                                    padding: "12px 16px", 
                                    cursor: "pointer", 
                                    display: "flex", 
                                    justifyContent: "space-between", 
                                    alignItems: "center",
                                    borderBottom: accordionState.analytics ? "1px solid #e0e0e0" : "none"
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center" }}>
                                    <span style={{ marginRight: "8px" }}>{accordionState.analytics ? "▼" : "►"}</span>
                                    <h3 style={{ margin: "0", fontSize: "16px" }}>Analytics</h3>
                                </div>
                            </div>
                            
                            {accordionState.analytics && (
                                <div style={{ padding: "16px" }}>
                                    {currentOpportunity.activities && currentOpportunity.activities.length > 0 ? (
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                            {/* Days Since Last Contact */}
                                            <div style={{ 
                                                backgroundColor: "#f5f5f5", 
                                                padding: "16px", 
                                                borderRadius: "8px",
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center"
                                            }}>
                                                <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>Open</div>
                                                <div style={{ 
                                                    fontSize: "28px", 
                                                    fontWeight: "bold",
                                                    marginBottom: "4px"
                                                }}>
                                                    {calculateDaysSinceLastContact(currentOpportunity.activities)?.days || 0}
                                                </div>
                                                <div style={{ fontSize: "12px", color: "#666" }}>days</div>
                                                <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                                                    {calculateDaysSinceLastContact(currentOpportunity.activities)?.days > 30 ? 
                                                        "30 avg" : "35 avg"}
                                                </div>
                                            </div>
                                            
                                            {/* Other analytics tiles can be added here */}
                                            <div style={{ 
                                                backgroundColor: "#f5f5f5", 
                                                padding: "16px", 
                                                borderRadius: "8px" 
                                            }}>
                                                {/* Placeholder for another metric */}
                                            </div>
                                            
                                            <div style={{ 
                                                backgroundColor: "#f5f5f5", 
                                                padding: "16px", 
                                                borderRadius: "8px" 
                                            }}>
                                                {/* Placeholder for another metric */}
                                            </div>
                                            
                                            <div style={{ 
                                                backgroundColor: "#f5f5f5", 
                                                padding: "16px", 
                                                borderRadius: "8px" 
                                            }}>
                                                {/* Placeholder for another metric */}
                                            </div>
                                        </div>
                                    ) : (
                                        <p>No activities to analyze.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Timeline Log Section */}
                        <div style={{ marginBottom: "16px", backgroundColor: "white", borderRadius: "8px", overflow: "hidden" }}>
                            <div 
                                onClick={() => toggleAccordion('timeline')} 
                                style={{ 
                                    padding: "12px 16px", 
                                    cursor: "pointer", 
                                    display: "flex", 
                                    justifyContent: "space-between", 
                                    alignItems: "center",
                                    borderBottom: accordionState.timeline ? "1px solid #e0e0e0" : "none"
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center" }}>
                                    <span style={{ marginRight: "8px" }}>{accordionState.timeline ? "▼" : "►"}</span>
                                    <h3 style={{ margin: "0", fontSize: "16px" }}>Timeline Log</h3>
                                </div>
                            </div>
                            
                            {accordionState.timeline && (
                                <div style={{ padding: "16px" }}>
                                    {currentOpportunity.activities && currentOpportunity.activities.length > 0 ? (
                                        <div className="enhanced-timeline">
                                            {/* Group activities by date */}
                                            {(() => {
                                                const groupedActivities = {};
                                                
                                                // Group activities by date
                                                currentOpportunity.activities.forEach(activity => {
                                                    const date = new Date(activity.createdon);
                                                    const dateKey = date.toLocaleDateString();
                                                    
                                                    if (!groupedActivities[dateKey]) {
                                                        groupedActivities[dateKey] = [];
                                                    }
                                                    
                                                    groupedActivities[dateKey].push(activity);
                                                });
                                                
                                                // Sort dates in descending order (newest first)
                                                const sortedDates = Object.keys(groupedActivities).sort((a, b) => {
                                                    return new Date(b) - new Date(a);
                                                });
                                                
                                                return sortedDates.map((dateKey, dateIndex) => {
                                                    const activities = groupedActivities[dateKey];
                                                    
                                                    return (
                                                        <div key={dateKey} className="timeline-date-group">
                                                            {/* Date header */}
                                                            <div 
                                                                style={{
                                                                    padding: "8px 12px",
                                                                    marginBottom: "12px",
                                                                    backgroundColor: "#f5f5f5",
                                                                    borderRadius: "4px",
                                                                    fontWeight: "bold",
                                                                    display: "inline-block"
                                                                }}
                                                            >
                                                                {dateKey} ({activities.length} {activities.length === 1 ? 'activity' : 'activities'})
                                                            </div>
                                                            
                                                            {/* Activities for this date */}
                                                            <div style={{ position: "relative" }}>
                                                                {/* Vertical line */}
                                                                <div style={{
                                                                    position: "absolute",
                                                                    left: "7px",
                                                                    top: "8px",
                                                                    bottom: dateIndex === sortedDates.length - 1 ? "8px" : "0",
                                                                    width: "2px",
                                                                    backgroundColor: "#e0e0e0",
                                                                    zIndex: 1
                                                                }} />
                                                                
                                                                {activities.map((activity, index) => {
                                                                    const activityLabel = getActivityLabel(activity.activitytypecode);
                                                                    const activityColor = getActivityColor(activity.activitytypecode);
                                                                    
                                                                    return (
                                                                        <div 
                                                                            key={activity.activityid}
                                                                            style={{
                                                                                position: "relative",
                                                                                marginBottom: "16px",
                                                                                paddingLeft: "32px",
                                                                                zIndex: 2
                                                                            }}
                                                                        >
                                                                            {/* Activity dot */}
                                                                            <div style={{
                                                                                position: "absolute",
                                                                                left: "0",
                                                                                top: "8px",
                                                                                width: "8px",
                                                                                height: "8px",
                                                                                borderRadius: "50%",
                                                                                backgroundColor: activityColor,
                                                                                border: "1px solid white",
                                                                                boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                                                                                zIndex: 3
                                                                            }} />
                                                                            
                                                                            {/* Activity content */}
                                                                            <div style={{
                                                                                backgroundColor: "#f9f9f9",
                                                                                borderLeft: `4px solid ${activityColor}`,
                                                                                borderRadius: "4px",
                                                                                padding: "12px",
                                                                                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                                                                                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                                                                                cursor: "pointer"
                                                                            }}
                                                                            onMouseEnter={(e) => {
                                                                                e.currentTarget.style.transform = "translateY(-2px)";
                                                                                e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
                                                                                e.currentTarget.style.borderLeft = "4px solid #d4ff58";
                                                                            }}
                                                                            onMouseLeave={(e) => {
                                                                                e.currentTarget.style.transform = "translateY(0)";
                                                                                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
                                                                                e.currentTarget.style.borderLeft = `4px solid ${activityColor}`;
                                                                            }}
                                                                            >
                                                                                <div style={{ 
                                                                                    display: "flex", 
                                                                                    justifyContent: "space-between",
                                                                                    alignItems: "flex-start"
                                                                                }}>
                                                                                    <div>
                                                                                        <div style={{ 
                                                                                            fontWeight: "400",
                                                                                            marginBottom: "4px",
                                                                                            fontSize: "12px"
                                                                                        }}>
                                                                                            {activity.subject || activityLabel}
                                                                                        </div>
                                                                                        
                                                                                        <div style={{ 
                                                                                            display: "flex",
                                                                                            alignItems: "center",
                                                                                            color: "#666",
                                                                                            fontSize: "12px",
                                                                                            marginBottom: "8px"
                                                                                        }}>
                                                                                            {getIconForActivity(activityLabel)}
                                                                                            <span style={{ marginLeft: "6px" }}>
                                                                                                {activityLabel}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    
                                                                                    <div style={{ 
                                                                                        color: "#888", 
                                                                                        fontSize: "10px",
                                                                                        whiteSpace: "nowrap"
                                                                                    }}>
                                                                                        {new Date(activity.createdon).toLocaleTimeString([], { 
                                                                                            hour: '2-digit', 
                                                                                            minute: '2-digit' 
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                                
                                                                                {activity.description && (
                                                                                    <div style={{ 
                                                                                        marginTop: "8px",
                                                                                        fontSize: "14px",
                                                                                        color: "#444",
                                                                                        borderTop: "1px solid #eee",
                                                                                        paddingTop: "8px"
                                                                                    }}>
                                                                                        {activity.description}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    ) : (
                                        <p>No activities in the timeline.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Basic Info Section */}
                        <div style={{ marginBottom: "16px", backgroundColor: "white", borderRadius: "8px", overflow: "hidden", padding: "16px" }}>
                            <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>Opportunity Details</h3>
                            
                            <div style={{ marginBottom: "8px" }}>
                                <strong>ID:</strong> {currentOpportunity.opportunityid}
                            </div>
                            
                            {currentOpportunity.customerid_account && (
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Customer:</strong> {currentOpportunity.customerid_account.name}
                                </div>
                            )}
                            
                            {currentOpportunity.estimatedvalue && (
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Estimated Value:</strong> ${currentOpportunity.estimatedvalue.toLocaleString()}
                                </div>
                            )}
                            
                            {currentOpportunity.statecode !== undefined && (
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Status:</strong> {currentOpportunity.statecode === 0 ? "Open" : "Closed"}
                                </div>
                            )}
                            
                            {currentOpportunity.createdon && (
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Created On:</strong> {new Date(currentOpportunity.createdon).toLocaleDateString()}
                                </div>
                            )}
                            
                            {currentOpportunity.estimatedclosedate && (
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Est. Close Date:</strong> {new Date(currentOpportunity.estimatedclosedate).toLocaleDateString()}
                                </div>
                            )}
                            
                            {currentOpportunity.actualclosedate && (
                                <div style={{ marginBottom: "8px" }}>
                                    <strong>Actual Close Date:</strong> {new Date(currentOpportunity.actualclosedate).toLocaleDateString()}
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
                    </div>

                    {/* Auto-open toggle */}
                    <div style={{ 
                        padding: "12px 16px",
                        fontSize: "13px",
                        borderTop: "1px solid #e0e0e0",
                        backgroundColor: "white"
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

            {/* Show opportunity list when logged in but no opportunity selected */}
            {accessToken && !currentOpportunity && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {/* Header */}
                    {createHeader({
                        title: "Nordsales",
                        showBackButton: true,
                        onBackClick: handleBackToList
                        })}
                    <div style={{ 
                        padding: "16px", 
                        borderBottom: "1px solid #e0e0e0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: "white"
                    }}>
                        <h2 style={{ margin: "0", fontSize: "18px" }}>Recent Opportunities</h2>
                        <button 
                            onClick={handleLogout} 
                            style={{ 
                                padding: "6px 12px", 
                                backgroundColor: "#f0f0f0", 
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                cursor: "pointer", 
                                fontSize: "13px"
                            }}
                        >
                            Logout
                        </button>
                    </div>

                    {/* Opportunity List */}
                    <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
                        {loading ? (
                            <div style={{ textAlign: "center", padding: "20px" }}>
                                <p>Loading...</p>
                            </div>
                        ) : opportunities.length === 0 ? (
                            <p>No opportunities found.</p>
                        ) : (
                            <div>
                                {opportunities.map((opp) => {
                                    // Calculate days open
                                    const daysOpen = calculateDaysBetween(opp.createdon, null);
                                    
                                    // Calculate days until close
                                    const daysUntilClose = opp.estimatedclosedate ? 
                                        calculateDaysBetween(new Date(), opp.estimatedclosedate) : null;
                                    
                                    // Calculate days since last activity
                                    const lastActivityDays = opp.lastActivity ? 
                                        calculateDaysBetween(opp.lastActivity, new Date()) : null;
                                    const activityLabel = getActivityRecencyLabel(lastActivityDays);
                                    
                                    return (
                                        <div 
                                            key={opp.opportunityid}
                                            style={{ 
                                                padding: "14px 16px 14px 16px", 
                                                marginBottom: "12px", 
                                                backgroundColor: "white",
                                                borderRadius: "8px",
                                                cursor: "pointer",
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                                            }}
                                            onClick={() => fetchOpportunityDetails(accessToken, opp.opportunityid)}
                                        >
                                            {/* Opportunity Name */}
                                            <div style={{ 
                                                // fontWeight: "bold", //
                                                marginBottom: "8px", 
                                                fontSize: "12px",
                                                color: "#1f2223",
                                                fontWeight: "600"
                                            }}>
                                                {opp.name}
                                            </div>
                                            
                                            {/* Customer and Value Row */}
                                            <div style={{ 
                                                display: "flex", 
                                                justifyContent: "space-between", 
                                                marginBottom: "12px",
                                                fontSize: "12px",
                                                fontWeight: "500",
                                                color: "#5f646a"
                                            }}>
                                                <div>
                                                    {opp.customerid_account && (
                                                        <span>{opp.customerid_account.name}</span>
                                                    )}
                                                </div>
                                                <div style={{ fontWeight: "500" }}>
                                                    {opp.estimatedvalue ? 
                                                        `$${opp.estimatedvalue.toLocaleString()}` : "No est. value"}
                                                </div>
                                            </div>
                                            
                                            {/* Timeline Indicators */}
                                            <div style={{ display: "flex", alignItems: "center", marginBottom: "12px", gap: "12px" }}>
                                                {/* Days Open Indicator */}
                                                <div style={{ 
                                                    flex: 1,
                                                    backgroundColor: "#f5f5f5", 
                                                    borderRadius: "4px",
                                                    padding: "8px 12px",
                                                }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                                        <div style={{ fontSize: "12px", color: "#555" }}>Open days</div>
                                                        <div style={{ fontSize: "14px", fontWeight: "bold" }}>{daysOpen}</div>
                                                    </div>
                                                    
                                                    {/* Progress bar - shows fill based on days open (capped at 90 days) */}
                                                    <div style={{ 
                                                        height: "4px", 
                                                        backgroundColor: "#e0e0e0", 
                                                        borderRadius: "2px", 
                                                        overflow: "hidden" 
                                                    }}>
                                                        <div style={{ 
                                                            height: "100%", 
                                                            width: `${Math.min(daysOpen / 90 * 100, 100)}%`, 
                                                            backgroundColor: daysOpen > 60 ? "#f44336" : daysOpen > 30 ? "#ff9800" : "#2196f3",
                                                            borderRadius: "2px"
                                                        }}></div>
                                                    </div>
                                                </div>
                                                
                                                {/* Days Until Close Indicator */}
                                                <div style={{ 
                                                    flex: 1,
                                                    backgroundColor: "#f5f5f5", 
                                                    borderRadius: "4px",
                                                    padding: "8px 12px",
                                                }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                                        <div style={{ fontSize: "12px", color: "#555" }}>Days to close</div>
                                                        <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                                                            {daysUntilClose !== null ? daysUntilClose : "—"}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Progress bar - inverse fill for days remaining (less days = more filled) */}
                                                    {daysUntilClose !== null && (
                                                        <div style={{ 
                                                            height: "4px", 
                                                            backgroundColor: "#e0e0e0", 
                                                            borderRadius: "2px", 
                                                            overflow: "hidden" 
                                                        }}>
                                                            <div style={{ 
                                                                height: "100%", 
                                                                width: `${Math.max(100 - (daysUntilClose / 30 * 100), 0)}%`, 
                                                                backgroundColor: daysUntilClose < 7 ? "#f44336" : daysUntilClose < 15 ? "#ff9800" : "#4caf50",
                                                                borderRadius: "2px"
                                                            }}></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Activity Recency Label */}
                                            <div style={{ display: "flex", justifyContent: "flex-start" }}>
                                                <div style={{ 
                                                    display: "inline-block",
                                                    backgroundColor: `${activityLabel.color}20`, // Using 20% opacity of the color
                                                    color: activityLabel.color,
                                                    padding: "4px 8px",
                                                    borderRadius: "5px",
                                                    fontSize: "12px",
                                                    fontWeight: "500"
                                                }}>
                                                    {activityLabel.text}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Auto-open toggle */}
                    <div style={{ 
                        padding: "12px 16px",
                        fontSize: "13px",
                        borderTop: "1px solid #e0e0e0",
                        backgroundColor: "white"
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
            
            {/* Debug button for development - can be removed in production */}
            <div style={{ 
                position: "fixed", 
                bottom: "0", 
                right: "0", 
                fontSize: "10px", 
                color: "#999",
                padding: "2px",
                backgroundColor: "rgba(255,255,255,0.8)"
            }}>
                <details>
                    <summary>Debug</summary>
                    <div>Token: {accessToken ? 'Yes' : 'No'}</div>
                    <div>ID: {currentOpportunityId || 'None'}</div>
                </details>
            </div>
        </div>
    );
};

export default Popup;