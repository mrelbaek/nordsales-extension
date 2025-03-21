import React, { useEffect, useState } from "react";
import { login, getAccessToken, logout } from "@/utils/auth";

const API_URL = "https://orga6a657bc.crm.dynamics.com/api/data/v9.0/opportunities?$top=5";

const Popup = () => {
    const [accessToken, setAccessToken] = useState(null);
    const [opportunities, setOpportunities] = useState([]);
    const [loading, setLoading] = useState(false); // Loading indicator

    const fetchOpportunities = async (token) => {
        try {
            setLoading(true);
            const response = await fetch(API_URL, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch data");
            }

            const data = await response.json();
            setOpportunities(data.value);
        } catch (error) {
            console.error("Error fetching opportunities:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        async function initialize() {
            try {
                const token = await getAccessToken();
                setAccessToken(token);
                if (token) fetchOpportunities(token);
            } catch (error) {
                console.warn("No stored access token found");
            }
        }
        initialize();
    }, []);

    const handleLogin = async () => {
        try {
            const token = await login();
            setAccessToken(token);
            fetchOpportunities(token); // Fetch opportunities immediately after login
        } catch (error) {
            console.error("Login failed:", error);
        }
    };

    const handleLogout = async () => {
        await logout();
        setAccessToken(null);
        setOpportunities([]);
    };

    return (
        <div style={{ padding: "10px", width: "250px" }}>
            <h2><b>NordSales Extension</b></h2>

            {/* Show login button if no token */}
            {!accessToken && (
                <button onClick={handleLogin} style={{ padding: "10px", background: "black", color: "white", border: "none", cursor: "pointer", marginBottom: "10px" }}>
                    Sign in with Microsoft
                </button>
            )}

            {/* Show logout button if logged in */}
            {accessToken && (
                <>
                    <button onClick={handleLogout} style={{ padding: "10px", background: "red", color: "white", border: "none", cursor: "pointer", marginBottom: "10px" }}>
                        Logout
                    </button>
                    
                    {loading ? (
                        <p>Loading opportunities...</p>
                    ) : (
                        <ul>
                            {opportunities.map((opp) => (
                                <li key={opp.opportunityid}>{opp.name}</li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
};

export default Popup;
