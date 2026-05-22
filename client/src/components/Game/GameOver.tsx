import React, { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useNavigate } from 'react-router-dom';
import Avatar from '../UI/Avatar';
import Button from '../UI/Button';

const CELEBRATION_EMOJIS = ['🌸', '✨', '🎉', '🎊', '🏆', '⭐', '🎵', '💮', '🌺'];

const GameOver: React.FC = () => {
  const { players, playAgain, leaveRoom, isHost } = useGame();
  const navigate = useNavigate();
  const [particles, setParticles] = useState<Array<{ id: number; emoji: string; left: number; delay: number; duration: number }>>([]);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const second = sortedPlayers[1];
  const third = sortedPlayers[2];

  // Podium order: [2nd, 1st, 3rd]
  const podium = [second, winner, third].filter(Boolean);

  // Generate celebration particles
  useEffect(() => {
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      emoji: CELEBRATION_EMOJIS[Math.floor(Math.random() * CELEBRATION_EMOJIS.length)],
      left: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
    }));
    setParticles(newParticles);
  }, []);

  const handlePlayAgain = () => {
    playAgain();
  };

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };

  return (
    <>
      {/* Celebration particles */}
      <div className="celebration-particles">
        {particles.map(p => (
          <span
            key={p.id}
            className="celebration-petal"
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      <div className="game-over-overlay">
        <div className="game-over-card">
          <div className="game-over-title">おめでとう!</div>
          <div className="game-over-subtitle">Game Over — Final Results</div>

          {/* Podium */}
          <div className="podium">
            {podium.map((player, i) => {
              const place = i === 1 ? 'first' : i === 0 ? 'second' : 'third';
              const medal = i === 1 ? '🥇' : i === 0 ? '🥈' : '🥉';
              return (
                <div key={player.id} className={`podium-place ${place}`}>
                  <Avatar
                    name={player.name}
                    color={player.avatarColor}
                    size="md"
                  />
                  <span className="podium-name">{player.name}</span>
                  <span className="podium-score">{player.score} pts</span>
                  <div className="podium-bar">{medal}</div>
                </div>
              );
            })}
          </div>

          {/* Full Leaderboard */}
          {sortedPlayers.length > 3 && (
            <div className="final-leaderboard">
              <h3>Full Rankings</h3>
              <ul className="final-board-list">
                {sortedPlayers.map((player, i) => (
                  <li key={player.id} className="final-board-item">
                    <span className="final-rank">#{i + 1}</span>
                    <Avatar name={player.name} color={player.avatarColor} size="sm" />
                    <span className="final-name">{player.name}</span>
                    <span className="final-score">{player.score} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="game-over-actions">
            {isHost && (
              <Button variant="primary" size="lg" onClick={handlePlayAgain}>
                🔄 Play Again
              </Button>
            )}
            <Button variant="secondary" size="lg" onClick={handleLeave}>
              🚪 Leave
            </Button>
          </div>

          {!isHost && (
            <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'rgba(26,17,71,0.5)' }}>
              Waiting for host to start a new game...
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default GameOver;
