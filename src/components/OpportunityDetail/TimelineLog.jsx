import React from 'react';
import { getActivityDate, getActivityLabel, getIconForActivity, getActivityColor } from '../../utils/activityUtils';
import AccordionSection from '../common/AccordionSection';

/**
 * Timeline log component displaying activities chronologically
 * 
 * @param {Object} props - Component props
 * @param {Array} props.activities - Activities to display
 * @param {boolean} props.isOpen - Whether section is expanded
 * @param {Function} props.onToggle - Function to call when toggling section
 * @returns {JSX.Element} Timeline log component
 */
const TimelineLog = ({ activities = [], isOpen, onToggle }) => {
  console.log('TimelineLog received activities:', activities);
  // Group activities by date
  const groupActivitiesByDate = () => {
    const groupedActivities = {};
    
    // Group activities by date
    activities.forEach(activity => {
      const date = getActivityDate(activity);
      if (!date) return;
      
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
    
    return { sortedDates, groupedActivities };
  };

  return (
    <AccordionSection
      title="Timeline Log"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {activities && activities.length > 0 ? (
        <div className="enhanced-timeline">
          {(() => {
            const { sortedDates, groupedActivities } = groupActivitiesByDate();
            
            return sortedDates.map((dateKey, dateIndex) => {
              const dateActivities = groupedActivities[dateKey];
              
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
                    {dateKey} ({dateActivities.length} {dateActivities.length === 1 ? 'activity' : 'activities'})
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
                    
                    {dateActivities.map((activity) => {
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
                                {new Date(getActivityDate(activity)).toLocaleTimeString([], {
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
    </AccordionSection>
  );
};

export default TimelineLog;