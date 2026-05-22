import React from 'react';

interface HintDisplayProps {
  hint: string;
  wordLength: number;
}

const HintDisplay: React.FC<HintDisplayProps> = ({ hint, wordLength }) => {
  if (!hint && wordLength <= 0) return null;

  const chars = hint ? hint.split('') : [];

  return (
    <div className="hint-display">
      <div className="hint-letters">
        {chars.map((char, i) => {
          if (char === ' ') {
            return <span key={i} className="hint-char space" />;
          }
          const isRevealed = char !== '_';
          return (
            <span key={i} className={`hint-char ${isRevealed ? 'revealed' : ''}`}>
              {isRevealed ? char : '_'}
            </span>
          );
        })}
      </div>
      {wordLength > 0 && (
        <span className="hint-length">({wordLength})</span>
      )}
    </div>
  );
};

export default HintDisplay;
