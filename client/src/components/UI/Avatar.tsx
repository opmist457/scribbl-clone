import React from 'react';
import './UI.css';

interface AvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isHost?: boolean;
  isDrawing?: boolean;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  name,
  color,
  size = 'md',
  isHost = false,
  isDrawing = false,
  className = '',
}) => {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`avatar avatar-${size} ${className}`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials || '?'}
      {isHost && (
        <span className="avatar-overlay avatar-crown" title="Host">
          👑
        </span>
      )}
      {isDrawing && !isHost && (
        <span className="avatar-overlay avatar-pencil" title="Drawing">
          ✏️
        </span>
      )}
    </div>
  );
};

export default Avatar;
