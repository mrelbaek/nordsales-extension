import React, { useState, useEffect } from 'react'

function Popup() {
  const [count, setCount] = useState(0)
  
  useEffect(() => {
    // Load count from storage
    chrome.storage.local.get(['count'], (result) => {
      if (result.count !== undefined) {
        setCount(result.count)
      }
    })
  }, [])
  
  const incrementCount = () => {
    const newCount = count + 1
    setCount(newCount)
    chrome.storage.local.set({ count: newCount })
  }

  return (
    <div className="popup">
      <h1>NordSales Extension</h1>
      <div className="card">
        <button onClick={incrementCount}>
          Count is {count}
        </button>
        <p>
          Edit <code>src/pages/popup/Popup.jsx</code> and save to test
        </p>
      </div>
    </div>
  )
}

export default Popup