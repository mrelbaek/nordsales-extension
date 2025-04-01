import React from 'react';
import AccordionSection from '../common/AccordionSection';

/**
 * Basic opportunity information component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.opportunity - Opportunity data
 * @param {boolean} props.isOpen - Whether section is expanded
 * @param {Function} props.onToggle - Function to call when toggling section
 * @returns {JSX.Element} Basic info component
 */
const BasicInfo = ({ opportunity, isOpen, onToggle }) => {
  return (
    <AccordionSection
    title="Basic Info"
    isOpen={isOpen}
    onToggle={onToggle}
    >
    <div style={{ marginBottom: "16px", backgroundColor: "white", borderRadius: "8px", overflow: "hidden", padding: "16px" }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>Opportunity Details</h3>
      
      <div style={{ marginBottom: "8px" }}>
        <strong>ID:</strong> {opportunity.opportunityid}
      </div>
      
      {opportunity.customerid_account && (
        <div style={{ marginBottom: "8px" }}>
          <strong>Customer:</strong> {opportunity.customerid_account.name}
        </div>
      )}
      
      {opportunity.estimatedvalue && (
        <div style={{ marginBottom: "8px" }}>
          <strong>Estimated Value:</strong> ${opportunity.estimatedvalue.toLocaleString()}
        </div>
      )}
      
      {opportunity.statecode !== undefined && (
        <div style={{ marginBottom: "8px" }}>
          <strong>Status:</strong> {opportunity.statecode === 0 ? "Open" : "Closed"}
        </div>
      )}
      
      {opportunity.createdon && (
        <div style={{ marginBottom: "8px" }}>
          <strong>Created On:</strong> {new Date(opportunity.createdon).toLocaleDateString()}
        </div>
      )}
      
      {opportunity.estimatedclosedate && (
        <div style={{ marginBottom: "8px" }}>
          <strong>Est. Close Date:</strong> {new Date(opportunity.estimatedclosedate).toLocaleDateString()}
        </div>
      )}
      
      {opportunity.actualclosedate && (
        <div style={{ marginBottom: "8px" }}>
          <strong>Actual Close Date:</strong> {new Date(opportunity.actualclosedate).toLocaleDateString()}
        </div>
      )}
      
      <div style={{ marginTop: "16px" }}>
        <a 
          href={`https://orga6a657bc.crm.dynamics.com/main.aspx?appid=e82f31a2-d4e4-ef11-9341-6045bd0438e7&pagetype=entityrecord&etn=opportunity&id=${opportunity.opportunityid}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#0078d4", textDecoration: "none" }}
        >
          Open in Dynamics →
        </a>
      </div>
    </div>
    </AccordionSection>
  );
};

export default BasicInfo;