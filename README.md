NordSales Chrome Extension
A Chrome extension for Dynamics 365 Sales that provides a seamless way to view opportunity details and activities directly from your browser.
Overview
The NordSales extension enhances your Dynamics CRM experience by providing a sleek sidebar that automatically detects when you're viewing an opportunity and displays relevant information without leaving your current page. It provides a convenient way to view opportunity details, activity history, and insights while navigating through Dynamics 365.
Features

Automatic Opportunity Detection: Detects the opportunity you're currently viewing in Dynamics CRM
Comprehensive Information Display: Shows opportunity details, customer information, and estimated values
Activity Statistics: Summarizes different types of activities (emails, phone calls, meetings, tasks, notes)
Calendar View: Visualizes activities on an interactive calendar
Timeline: Shows a chronological log of all activities
Analytics: Provides insights like days since last contact
Microsoft Authentication: Securely connects to your Dynamics 365 instance

Technical Details
The extension is built using:

React for the user interface
Chrome Extension APIs for sidebar and communication
Microsoft Authentication Library for secure access to Dynamics CRM
Dynamics 365 Web API for fetching opportunity data

Installation

Clone this repository
Install dependencies: npm install
Build the extension: npm run build
Load the extension in Chrome:

Open Chrome and navigate to chrome://extensions
Enable "Developer mode"
Click "Load unpacked" and select the dist folder from this project



Development
Project Structure
/nordsales-extension
├── src/              # Source files
│   ├── assets/       # Icons and images
│   ├── pages/        # UI components for different extension pages
│   │   ├── popup/    # Popup UI components
│   │   └── options/  # Options page components
│   ├── utils/        # Utility functions
│   └── contentScript.js  # Content script for opportunity detection
├── public/           # Static assets
├── service-worker.js # Extension background worker
└── manifest.json     # Extension manifest

Building
Copynpm run build

Development Mode
Copynpm run dev

Usage
Navigate to any opportunity in Dynamics 365 Sales
Click the NordSales extension icon to view opportunity details
The sidebar will display comprehensive information about the current opportunity
As you navigate between opportunities, the sidebar automatically updates

Configuration
You can configure the extension behavior through the options page:

Auto-open settings
Display preferences
(Future) Custom fields and views

License
MIT License
