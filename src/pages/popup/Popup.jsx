import React, { useEffect, useState } from "react";
import { login, getAccessToken, logout } from "@/utils/auth";
import "./popup.css";

// Base URL for API calls - replace with your actual org ID
const BASE_URL = "https://orga6a657bc.crm.dynamics.com/api/data/v9.0";

// Calendar constants
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const Popup = () => {
    // State declarations
    const [accessToken, setAccessToken] = useState(null);
    const [opportunities, setOpportunities] = useState([]);
    const [currentOpportunityId, setCurrentOpportunityId] = useState(null);
    const [currentOpportunity, setCurrentOpportunity] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null); // Renamed from 'error' to avoid conflicts
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

    // Helper function to translate activity type codes to readable labels
    const getActivityTypeLabel = (typeCode, count = 1) => {
        const activityTypes = {
            4201: count === 1 ? "Meeting" : "Meetings",
            4202: count === 1 ? "Email" : "Emails",
            4204: count === 1 ? "Phone Call" : "Phone Calls",
            4210: count === 1 ? "Task" : "Tasks",
            4212: "Fax",
            4214: count === 1 ? "Note" : "Notes",
            4216: "Social Activity",
            4251: "Recurring Appointment"
            // Add more as needed
        };
        
        return activityTypes[typeCode] || typeCode.toString();
    };

    // Helper function to get activity icon path by type
    const getActivityIconPath = (typeCode) => {
        switch (typeCode) {
            case 4201: return "/assets/calendar-dots.png"; // Appointment/Meeting
            case 4202: return "/assets/envelope-simple.png"; // Email
            case 4204: return "/assets/phone.png"; // Phone Call
            case 4210: return "/assets/check-square.png"; // Task
            case 4214: return "/assets/note-pencil.png"; // Note
            default: return null; // No specific icon
        }
    };

    // Helper function to get activity color by type
    const getActivityColor = (typeCode) => {
        switch (typeCode) {
            case 4201: return "#4285F4"; // Appointment - blue
            case 4202: return "#0F9D58"; // Email - green
            case 4204: return "#F4B400"; // Phone Call - yellow
            case 4210: return "#DB4437"; // Task - red
            case 4212: return "#9C27B0"; // Fax - purple
            case 4214: return "#00ACC1"; // Notes - teal
            case 4216: return "#00ACC1"; // Social Activity - teal
            case 4251: return "#7986CB"; // Recurring Appointment - indigo
            default: return "#9E9E9E"; // gray
        }
    };

    // Helper function to summarize activities by type with proper pluralization
    const summarizeActivities = (activities) => {
        if (!activities || activities.length === 0) return [];
        
        const summary = {};
        
        activities.forEach(activity => {
            const type = activity.activitytypecode;
            if (!summary[type]) {
                summary[type] = {
                    count: 0,
                    type: type,
                    iconPath: getActivityIconPath(type)
                };
            }
            summary[type].count++;
        });
        
        // Add labels with proper pluralization after counting
        Object.values(summary).forEach(item => {
            item.label = getActivityTypeLabel(item.type, item.count);
        });
        
        return Object.values(summary);
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

    // Fetch list of opportunities
    const fetchOpportunities = async (token) => {
        try {
            setLoading(true);
            setErrorMessage(null);
            
            console.log("Fetching opportunities list...");
            
            const url = `${BASE_URL}/opportunities?$select=name,opportunityid,_customerid_value,createdon,statecode,estimatedvalue,estimatedclosedate,actualclosedate&$expand=customerid_account($select=name)&$top=5`;
            
            const response = await fetch(url, {
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json",
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0",
                    "Content-Type": "application/json"
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
            setErrorMessage(`Failed to fetch opportunities list: ${error.message}`);
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
            setErrorMessage(null);
            
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
            setErrorMessage(`Failed to fetch opportunity details: ${error.message}`);
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
            
            if (activeTab && activeTab.url && activeTab.url.includes('crm.dynamics.com')) {
                try {
                    console.log("Attempting to get opportunity ID from content script");
                    const response = await chrome.tabs.sendMessage(
                        activeTab.id, 
                        { type: "CHECK_OPPORTUNITY_ID" }
                    );
                    console.log("Content script response:", response);
                    
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
            setErrorMessage(null);
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
            setErrorMessage(`Login failed: ${error.message}`);
        }
    };

    const handleLogout = async () => {
        await logout();
        setAccessToken(null);
        setOpportunities([]);
        setCurrentOpportunity(null);
        setErrorMessage(null);
        setDebugInfo(null);
    };

    const handleBackToList = () => {
        setCurrentOpportunity(null);
        fetchOpportunities(accessToken);
    };

    const clearError = () => {
        setErrorMessage(null);
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

    return (
        <div className="popup-container">
            {/* Error message if any */}
            {errorMessage && (
                <div className="error-message">
                    <button onClick={clearError} className="error-close">×</button>
                    <div><strong>Error:</strong> {errorMessage}</div>
                </div>
            )}

            {/* Show login button if no token */}
            {!accessToken && (
                <div className="login-container">
                    <h2>NordSales Extension</h2>
                    <button onClick={handleLogin} className="btn btn-primary">
                        Sign in with Microsoft
                    </button>
                </div>
            )}

            {/* Show content when logged in */}
            {accessToken && currentOpportunity && (
                <div className="main-container">
                    {/* Header */}
                    <div className="header">
                        <div>
                            <h2>{currentOpportunity.name}</h2>
                            <div className="header-subtitle">
                                Active for {Math.ceil((new Date() - new Date(currentOpportunity.createdon)) / (1000 * 60 * 60 * 24))} days
                            </div>
                        </div>
                        <div>
                            <button onClick={handleBackToList} className="btn btn-back">Back</button>
                            <button onClick={handleLogout} className="btn btn-logout">Logout</button>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="action-bar">
                        <button className="icon-button">🔍</button>
                        <button className="icon-button">📋</button>
                        <button className="icon-button">🔖</button>
                    </div>

                    {/* Main Content Area - Scrollable */}
                    <div className="content-area">
                        {/* Action Buttons */}
                        <div className="action-buttons">
                            <button>Save</button>
                            <button>Add to list</button>
                        </div>

                        {/* Statistics Section */}
                        <div className={`card ${!accordionState.statistics ? 'collapsed' : ''}`}>
                            <div 
                                onClick={() => toggleAccordion('statistics')} 
                                className={`section-header ${!accordionState.statistics ? 'collapsed' : ''}`}
                            >
                                <div className="section-title">
                                    <span>{accordionState.statistics ? "▼" : "►"}</span>
                                    <h3>Statistics</h3>
                                </div>
                            </div>
                            
                            {accordionState.statistics && (
                                <div className="section-content">
                                    {currentOpportunity.activities && currentOpportunity.activities.length > 0 ? (
                                        <div>
                                            {summarizeActivities(currentOpportunity.activities).map((stat, index) => (
                                                <div key={index} className="stat-item">
                                                    <div className="icon-container">
                                                        {stat.iconPath ? (
                                                            <img src={stat.iconPath} alt={stat.label} className="stat-icon" />
                                                        ) : (
                                                            <span>📝</span>
                                                        )}
                                                    </div>
                                                    <div>{stat.count} {stat.label}</div>
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
                        <div className={`card ${!accordionState.entries ? 'collapsed' : ''}`}>
                            <div 
                                onClick={() => toggleAccordion('entries')} 
                                className={`section-header ${!accordionState.entries ? 'collapsed' : ''}`}
                            >
                                <div className="section-title">
                                    <span>{accordionState.entries ? "▼" : "►"}</span>
                                    <h3>Entries</h3>
                                </div>
                            </div>
                            
                            {accordionState.entries && (
                                <div className="section-content">
                                    {/* Calendar Header */}
                                    <div className="calendar-header">
                                        <button 
                                            onClick={() => navigateCalendar('prev')}
                                            className="calendar-nav-button"
                                        >
                                            ◀
                                        </button>
                                        <h4>{MONTHS[calendarMonth]} {calendarYear}</h4>
                                        <button 
                                            onClick={() => navigateCalendar('next')}
                                            className="calendar-nav-button"
                                        >
                                            ▶
                                        </button>
                                    </div>
                                    
                                    {/* Calendar Grid */}
                                    <div className="calendar">
                                        {/* Day headers */}
                                        <div className="calendar-days-header">
                                            {DAYS_OF_WEEK.map(day => (
                                                <div key={day} className="day-header">{day}</div>
                                            ))}
                                        </div>
                                        
                                        {/* Calendar days */}
                                        {generateCalendar(calendarYear, calendarMonth, currentOpportunity.activities).map((week, weekIndex) => (
                                            <div key={weekIndex} className="calendar-week">
                                                {week.map((day, dayIndex) => (
                                                    <div 
                                                        key={dayIndex} 
                                                        className={`calendar-day ${day?.isToday ? 'today' : ''} ${day?.activities.length > 0 ? 'has-activities' : ''}`}
                                                        onClick={() => day?.activities.length > 0 && setSelectedDate(new Date(calendarYear, calendarMonth, day.day))}
                                                    >
                                                        {day?.day}
                                                        {day?.activities.length > 0 && (
                                                            <span className="activity-indicator"></span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Selected Date Activities */}
                                    {selectedDate && (
                                        <div className="activity-list">
                                            <h4>Activities on {selectedDate.toLocaleDateString()}:</h4>
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
                                                        className="activity-item"
                                                        style={{ borderLeftColor: getActivityColor(activity.activitytypecode) }}
                                                    >
                                                        <div className="icon-container">
                                                            {getActivityIconPath(activity.activitytypecode) ? (
                                                                <img 
                                                                    src={getActivityIconPath(activity.activitytypecode)} 
                                                                    alt={getActivityTypeLabel(activity.activitytypecode, 1)} 
                                                                    className="activity-icon" 
                                                                />
                                                            ) : (
                                                                <span>📝</span>
                                                            )}
                                                        </div>
                                                        <div className="activity-item-content">
                                                            <div className="activity-title">{activity.subject}</div>
                                                            <div className="activity-type">
                                                                {getActivityTypeLabel(activity.activitytypecode, 1)}
                                                            </div>
                                                            <div className="activity-time">
                                                                {new Date(activity.createdon).toLocaleTimeString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                            <button
                                                onClick={() => setSelectedDate(null)}
                                                className="clear-selection"
                                            >
                                                Clear selection
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Analytics Section */}
                        <div className={`card ${!accordionState.analytics ? 'collapsed' : ''}`}>
                            <div 
                                onClick={() => toggleAccordion('analytics')} 
                                className={`section-header ${!accordionState.analytics ? 'collapsed' : ''}`}
                            >
                                <div className="section-title">
                                    <span>{accordionState.analytics ? "▼" : "►"}</span>
                                    <h3>Analytics</h3>
                                </div>
                            </div>
                            
                            {accordionState.analytics && (
                                <div className="section-content">
                                    {currentOpportunity.activities && currentOpportunity.activities.length > 0 ? (
                                        <div className="analytics-grid">
                                            {/* Days Since Last Contact */}
                                            <div className="analytics-tile">
                                                <div className="analytics-label">Open</div>
                                                <div className="analytics-value">
                                                    {calculateDaysSinceLastContact(currentOpportunity.activities)?.days || 0}
                                                </div>
                                                <div className="analytics-unit">days</div>
                                                <div className="analytics-avg">
                                                    {calculateDaysSinceLastContact(currentOpportunity.activities)?.days > 30 ? 
                                                        "30 avg" : "35 avg"}
                                                </div>
                                            </div>
                                            
                                            {/* Other analytics tiles */}
                                            <div className="analytics-tile"></div>
                                            <div className="analytics-tile"></div>
                                            <div className="analytics-tile"></div>
                                        </div>
                                    ) : (
                                        <p>No activities to analyze.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Timeline Log Section */}
                        <div className={`card ${!accordionState.timeline ? 'collapsed' : ''}`}>
                            <div 
                                onClick={() => toggleAccordion('timeline')} 
                                className={`section-header ${!accordionState.timeline ? 'collapsed' : ''}`}
                            >
                                <div className="section-title">
                                    <span>{accordionState.timeline ? "▼" : "►"}</span>
                                    <h3>Timeline Log</h3>
                                </div>
                            </div>
                            
                            {accordionState.timeline && (
                                <div className="section-content">
                                    {currentOpportunity.activities && currentOpportunity.activities.length > 0 ? (
                                        <div className="timeline">
                                            {currentOpportunity.activities.map((activity) => (
                                                <div key={activity.activityid} className="timeline-item">
                                                    <div className="timeline-icon">
                                                        {getActivityIconPath(activity.activitytypecode) ? (
                                                            <img 
                                                            src={getActivityIconPath(activity.activitytypecode)}
                                                            alt={getActivityTypeLabel(activity.activitytypecode, 1)} 
                                                                className="timeline-icon-img" 
                                                            />
                                                        ) : (
                                                            <span>{getActivityTypeLabel(activity.activitytypecode, 1).charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="timeline-content">
                                                        <div className="timeline-title">
                                                            {activity.subject || getActivityTypeLabel(activity.activitytypecode, 1)}
                                                        </div>
                                                        <div className="timeline-type">
                                                            {getActivityTypeLabel(activity.activitytypecode, 1)}
                                                        </div>
                                                        <div className="timeline-time">
                                                            {new Date(activity.createdon).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p>No activities in the timeline.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Basic Info Section */}
                        <div className="opportunity-details">
                            <h3>Opportunity Details</h3>
                            
                            <div className="detail-row">
                                <strong>ID:</strong> {currentOpportunity.opportunityid}
                            </div>
                            
                            {currentOpportunity.customerid_account && (
                                <div className="detail-row">
                                    <strong>Customer:</strong> {currentOpportunity.customerid_account.name}
                                </div>
                            )}
                            
                            {currentOpportunity.estimatedvalue && (
                                <div className="detail-row">
                                    <strong>Estimated Value:</strong> ${currentOpportunity.estimatedvalue.toLocaleString()}
                                </div>
                            )}
                            
                            {currentOpportunity.statecode !== undefined && (
                                <div className="detail-row">
                                    <strong>Status:</strong> {currentOpportunity.statecode === 0 ? "Open" : "Closed"}
                                </div>
                            )}
                            
                            {currentOpportunity.createdon && (
                                <div className="detail-row">
                                    <strong>Created On:</strong> {new Date(currentOpportunity.createdon).toLocaleDateString()}
                                </div>
                            )}
                            
                            {currentOpportunity.estimatedclosedate && (
                                <div className="detail-row">
                                    <strong>Est. Close Date:</strong> {new Date(currentOpportunity.estimatedclosedate).toLocaleDateString()}
                                </div>
                            )}
                            
                            {currentOpportunity.actualclosedate && (
                                <div className="detail-row">
                                    <strong>Actual Close Date:</strong> {new Date(currentOpportunity.actualclosedate).toLocaleDateString()}
                                </div>
                            )}
                            
                            <div className="details-link">
                                <a 
                                    href={`https://orga6a657bc.crm.dynamics.com/main.aspx?appid=e82f31a2-d4e4-ef11-9341-6045bd0438e7&pagetype=entityrecord&etn=opportunity&id=${currentOpportunity.opportunityid}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Open in Dynamics →
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Footer with auto-open toggle */}
                    <div className="footer">
                        <label>
                            <input
                                type="checkbox"
                                checked={autoOpen}
                                onChange={toggleAutoOpen}
                            />
                            Auto-open when visiting Dynamics CRM
                        </label>
                    </div>
                </div>
            )}

            {/* Show opportunity list when logged in but no opportunity selected */}
            {accessToken && !currentOpportunity && (
                <div className="main-container">
                    {/* Header */}
                    <div className="header">
                        <h2>Recent Opportunities</h2>
                        <button onClick={handleLogout} className="btn btn-logout">Logout</button>
                    </div>

                    {/* Opportunity List */}
                    <div className="content-area">
                        {loading ? (
                            <div className="loading">
                                <p>Loading...</p>
                            </div>
                        ) : opportunities.length === 0 ? (
                            <p>No opportunities found.</p>
                        ) : (
                            <div className="opportunity-list">
                                {opportunities.map((opp) => (
                                    <div 
                                        key={opp.opportunityid}
                                        className="opportunity-card"
                                        onClick={() => fetchOpportunityDetails(accessToken, opp.opportunityid)}
                                    >
                                        <div className="opportunity-title">{opp.name}</div>
                                        {opp.customerid_account && (
                                            <div className="opportunity-detail">
                                                <strong>Customer:</strong> {opp.customerid_account.name}
                                            </div>
                                        )}
                                        {opp.estimatedvalue && (
                                            <div className="opportunity-detail">
                                                <strong>Value:</strong> ${opp.estimatedvalue.toLocaleString()}
                                            </div>
                                        )}
                                        {opp.createdon && (
                                            <div className="opportunity-date">
                                                Created: {new Date(opp.createdon).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer with auto-open toggle */}
                    <div className="footer">
                        <label>
                            <input
                                type="checkbox"
                                checked={autoOpen}
                                onChange={toggleAutoOpen}
                            />
                            Auto-open when visiting Dynamics CRM
                        </label>
                    </div>
                </div>
            )}
            
            {/* Debug panel */}
            <div className="debug-panel">
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
