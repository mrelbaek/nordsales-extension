import React, { useEffect, useState } from "react";
import { login, getAccessToken } from "@/utils/auth";

const API_URL = "https://orga6a657bc.crm.dynamics.com/api/data/v9.0/opportunities?$top=5";

const Popup = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const token = await getAccessToken();
                if (!token) throw new Error("No access token available");

                const response = await fetch(API_URL, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    throw new Error(`API request failed: ${response.statusText}`);
                }

                const result = await response.json();
                setData(result.value);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    return (
        <div>
            <h2>NordSales Extension</h2>
            <button onClick={login}>Sign in with Microsoft</button>
            {loading && <p>Loading opportunities...</p>}
            {error && <p style={{ color: "red" }}>Error: {error}</p>}
            {data && (
                <ul>
                    {data.map((opportunity) => (
                        <li key={opportunity.opportunityid}>{opportunity.name}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default Popup;
