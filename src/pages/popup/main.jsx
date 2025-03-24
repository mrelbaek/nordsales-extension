import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup';
import './popup.css';  // Make sure this line exists

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);