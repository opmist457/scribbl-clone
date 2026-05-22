import React, { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { ROUND_END_DISPLAY_TIME } from '../../utils/constants';

const RoundEnd: React.FC = () => {
  const { gameState, players } = useGame();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, ROUND_END_DISPLAY_TIME);

    return () => clearTimeout(timer);
  }, []);

  if (!visible || !gameState.correctWord) return null;

  // Calculate round scores
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="round-end-overlay">
      <div className="round-end-card">
        <h2>🖌️ Round Over!</h2>
        <div className="round-end-word">{gameState.correctWord}</div>

        <ul className="round-scores-list">
          {sortedPlayers.map((player) => (
            <li key={player.id} className="round-score-item">
              <span className="round-score-name">
                {player.hasGuessedCorrectly ? '✅ ' : ''}
                {player.name}
              </span>
              <span className="round-score-pts">
                {player.score} pts
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default RoundEnd;
