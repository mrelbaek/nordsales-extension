import React, { useState, useEffect } from 'react'

function Options() {
  const [settings, setSettings] = useState({
    darkMode: false,
    notifications: true,
  })
  
  useEffect(() => {
    // Load settings from storage
    chrome.storage.local.get(['settings'], (result) => {
      if (result.settings) {
        setSettings(result.settings)
      }
    })
  }, [])
  
  const updateSettings = (key, value) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    chrome.storage.local.set({ settings: newSettings })
  }
  
  const saveSettings = () => {
    chrome.storage.local.set({ settings })
    alert('Settings saved!')
  }

  return (
    <div className="options">
      <h1>NordSales Extension Options</h1>
      
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.darkMode}
            onChange={(e) => updateSettings('darkMode', e.target.checked)}
          />
          Dark Mode
        </label>
      </div>
      
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.notifications}
            onChange={(e) => updateSettings('notifications', e.target.checked)}
          />
          Show Notifications
        </label>
      </div>
      
      <button onClick={saveSettings}>
        Save Settings
      </button>
    </div>
  )
}

export default Options