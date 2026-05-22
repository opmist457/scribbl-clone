import React from 'react';

interface TimerProps {
  timeRemaining: number;
  totalTime: number;
}

const Timer: React.FC<TimerProps> = ({ timeRemaining, totalTime }) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const progress = totalTime > 0 ? timeRemaining / totalTime : 0;
  const offset = circumference * (1 - progress);

  // Color transitions
  let strokeColor = '#5a7247'; // green
  if (progress < 0.25) {
    strokeColor = '#c0392b'; // red
  } else if (progress < 0.5) {
    strokeColor = '#f39c12'; // amber
  }

  const isUrgent = timeRemaining <= 10;

  return (
    <div className={`timer-container ${isUrgent ? 'urgent' : ''}`}>
      <svg className="timer-svg" viewBox="0 0 48 48">
        <circle
          className="timer-track"
          cx="24"
          cy="24"
          r={radius}
        />
        <circle
          className="timer-progress"
          cx="24"
          cy="24"
          r={radius}
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="timer-text">{timeRemaining}</span>
    </div>
  );
};

export default Timer;
