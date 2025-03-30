import React, { useState } from 'react';
import { DAYS_OF_WEEK, MONTHS } from '../../constants';
import { generateCalendar } from '../../utils/dateUtils';
import { getActivityLabel, getIconForActivity, getActivityColor } from '../../utils/activityUtils';
import AccordionSection from '../common/AccordionSection';

/**
 * Calendar component displaying activities by date
 * 
 * @param {Object} props - Component props
 * @param {Array} props.activities - Activities to display
 * @param {boolean} props.isOpen - Whether section is expanded
 * @param {Function} props.onToggle - Function to call when toggling section
 * @returns {JSX.Element} Calendar component
 */
const Calendar = ({ activities = [], isOpen, onToggle }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

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
    <AccordionSection
      title="Entries"
      isOpen={isOpen}
      onToggle={onToggle}
    >
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
          fontSize: "12px",
          color: "#666",
          marginBottom: "8px"
        }}>
          {DAYS_OF_WEEK.map(day => (
            <div key={day}>{day}</div>
          ))}
        </div>
        
        {/* Calendar days */}
        {generateCalendar(calendarYear, calendarMonth, activities).map((week, weekIndex) => (
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
                backgroundColor: day?.isToday ? "#e0ff82" : "transparent",
                color: day?.isToday ? "#1f2223" : day?.day ? "black" : "#ccc",
                cursor: day?.activities.length > 0 ? "pointer" : "default"
              }}
              onClick={() => day?.activities.length > 0 && setSelectedDate(new Date(calendarYear, calendarMonth, day.day))}
              >
                {day?.day}
                {day?.activities.length > 0 && (
                  <span style={{ 
                    position: "absolute", 
                    bottom: "-2px", 
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
          {activities
            .filter(activity => {
              const activityDate = new Date(activity.createdon);
              if (!activityDate) return false;
              
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
    </AccordionSection>
  );
};

export default Calendar;