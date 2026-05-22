import React from 'react';
import { useGame } from '../../context/GameContext';
import Avatar from '../UI/Avatar';
import './Scoreboard.css';

const Scoreboard: React.FC = () => {
  const { players, gameState } = useGame();

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const getRankClass = (index: number): string => {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return 'default';
  };

  return (
    <div className="scoreboard">
      <div className="scoreboard-header">
        🏆 Players
      </div>

      <div className="scoreboard-list">
        {sortedPlayers.map((player, index) => {
          const isDrawing = player.id === gameState.currentDrawer;
          const hasGuessed = player.hasGuessedCorrectly && gameState.phase === 'drawing';

          return (
            <div
              key={player.id}
              className={`score-player ${isDrawing ? 'is-drawing' : ''} ${hasGuessed ? 'has-guessed' : ''}`}
            >
              <span className={`score-rank ${getRankClass(index)}`}>
                {index + 1}
              </span>

              <Avatar
                name={player.name}
                color={player.avatarColor}
                size="sm"
                isHost={player.isHost}
                isDrawing={isDrawing}
              />

              <div className="score-info">
                <div className="score-name">
                  {player.name}
                  {player.isHost && <span title="Host">👑</span>}
                </div>
                <div className="score-points">{player.score} pts</div>
              </div>

              <div className="score-status">
                {isDrawing && (
                  <span className="score-drawing-icon" title="Drawing">✏️</span>
                )}
                {hasGuessed && (
                  <span className="score-guess-check" title="Guessed correctly">✓</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Scoreboard;
