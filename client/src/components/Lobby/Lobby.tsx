import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import Avatar from '../UI/Avatar';
import RoomSettingsComponent from './RoomSettings';
import './Lobby.css';

const Lobby: React.FC = () => {
  const {
    roomId,
    players,
    settings,
    isHost,
    myPlayerId,
    leaveRoom,
    updateSettings,
    startGame,
  } = useGame();

  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // If the user refreshes or hasn't joined properly, send them to homepage
    if (!myPlayerId) {
      navigate('/', { replace: true });
    }
  }, [myPlayerId, navigate]);

  const handleCopyCode = async () => {
    if (roomId) {
      try {
        await navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback
        const el = document.createElement('textarea');
        el.value = roomId;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const canStart = isHost && players.length >= 2;

  return (
    <div className="lobby-page">
      <div className="lobby-container">
        {/* Torii Gate Header */}
        <div className="lobby-header">
          <h1 className="lobby-title">
            Lobby <span className="jp">ロビー</span>
          </h1>
        </div>

        {/* Room Code */}
        <div className="lobby-room-code">
          <div className="room-code-badge">
            <span className="room-code-label">Room Code:</span>
            <span className="room-code-value">{roomId || '---'}</span>
          </div>
          <button
            className={`room-code-copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopyCode}
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>

        {/* Grid: Players + Settings */}
        <div className="lobby-grid">
          {/* Player List */}
          <div className="lobby-section">
            <h2 className="lobby-section-title">
              <span className="icon">👥</span>
              Players
            </h2>
            <div className="lobby-player-list">
              {players.map((player, i) => (
                <div
                  key={player.id}
                  className="lobby-player-item"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <Avatar
                    name={player.name}
                    color={player.avatarColor}
                    size="md"
                    isHost={player.isHost}
                  />
                  <span className="lobby-player-name">{player.name}</span>
                  <div className="lobby-player-badges">
                    {player.isHost && (
                      <span className="lobby-player-badge badge-host">Host</span>
                    )}
                    {player.id === myPlayerId && (
                      <span className="lobby-player-badge badge-you">You</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="lobby-player-count">
              {players.length} / {settings.maxPlayers} players
            </div>

            {/* Waiting Message */}
            {players.length < 2 && (
              <div className="lobby-waiting">
                Waiting for more players
                <span className="lobby-waiting-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="lobby-section">
            <h2 className="lobby-section-title">
              <span className="icon">⚙️</span>
              Settings
            </h2>
            <RoomSettingsComponent
              settings={settings}
              onUpdate={updateSettings}
              isHost={isHost}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="lobby-actions">
          {isHost && (
            <button
              className="lobby-start-btn"
              onClick={startGame}
              disabled={!canStart}
            >
              {canStart
                ? '🎮 Start Game ゲーム開始'
                : `Need ${2 - players.length} more player(s)`}
            </button>
          )}
          <button className="lobby-leave-btn" onClick={leaveRoom}>
            🚪 Leave Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
