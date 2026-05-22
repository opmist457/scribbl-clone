import React, { useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useGame } from '../../context/GameContext';
import Avatar from '../UI/Avatar';
import { AVATAR_COLORS } from '../../utils/constants';
import './Home.css';

const Home: React.FC = () => {
  const { isConnected } = useSocket();
  const { createRoom, joinRoom, error } = useGame();

  const [playerName, setPlayerName] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [localError, setLocalError] = useState('');

  const displayName = playerName.trim() || 'Player';

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setLocalError('Please enter your name');
      return;
    }
    if (!isConnected) {
      setLocalError('Not connected to server');
      return;
    }
    setLocalError('');
    createRoom(playerName.trim(), avatarColor);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setLocalError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setLocalError('Please enter a room code');
      return;
    }
    if (!isConnected) {
      setLocalError('Not connected to server');
      return;
    }
    setLocalError('');
    joinRoom(roomCode.trim().toUpperCase(), playerName.trim(), avatarColor);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showJoinInput) {
        handleJoinRoom();
      } else {
        handleCreateRoom();
      }
    }
  };

  const currentError = error || localError;

  return (
    <div className="home-page">
      {/* Connection status */}
      <div className="home-connection">
        <span className={`connection-dot ${!isConnected ? 'disconnected' : ''}`} />
        {isConnected ? 'Connected' : 'Connecting...'}
      </div>

      {/* Wave pattern overlay */}
      <div className="home-wave-overlay" />

      {/* Hero */}
      <div className="home-hero">
        <h1 className="home-title">
          Skribbl<span className="jp-text"> 描く</span>
        </h1>
        <p className="home-subtitle">
          Draw, Guess & Have Fun!
          <span className="jp-sub">みんなで描いて当てよう！</span>
        </p>
      </div>

      {/* Main Card */}
      <div className="home-content">
        <div className="home-card">
          {/* Name Input */}
          <div className="home-input-group">
            <label className="home-input-label">
              Your Name / お名前
            </label>
            <input
              type="text"
              className="home-name-input"
              placeholder="お名前 (Your Name)"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={20}
              autoFocus
            />
          </div>

          {/* Avatar Color Picker */}
          <div className="home-avatar-section">
            <div className="home-avatar-preview">
              <Avatar name={displayName} color={avatarColor} size="lg" />
              <span className="home-avatar-preview-text">Choose your color</span>
            </div>
            <div className="home-avatar-grid">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  className={`avatar-color-btn ${color === avatarColor ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setAvatarColor(color)}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="home-divider">
            <div className="home-divider-line" />
            <span className="home-divider-text">始めましょう / Let's Begin</span>
            <div className="home-divider-line" />
          </div>

          {/* Actions */}
          <div className="home-actions">
            <button
              className="home-action-btn home-create-btn"
              onClick={handleCreateRoom}
              disabled={!isConnected || !playerName.trim()}
            >
              🏠 Create Room
              <span className="btn-jp">部屋を作る</span>
            </button>

            {!showJoinInput ? (
              <button
                className="home-action-btn home-join-btn"
                onClick={() => setShowJoinInput(true)}
                disabled={!isConnected || !playerName.trim()}
              >
                🚪 Join Room
                <span className="btn-jp">部屋に入る</span>
              </button>
            ) : (
              <div className="home-join-section">
                <div className="home-join-input-row">
                  <input
                    type="text"
                    className="home-room-code-input"
                    placeholder="Room Code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    maxLength={8}
                    autoFocus
                  />
                  <button
                    className="home-join-go-btn"
                    onClick={handleJoinRoom}
                    disabled={!isConnected || !roomCode.trim() || !playerName.trim()}
                  >
                    Join →
                  </button>
                </div>
                <button
                  className="home-action-btn home-join-btn"
                  onClick={() => {
                    setShowJoinInput(false);
                    setRoomCode('');
                  }}
                  style={{ marginTop: '8px', fontSize: '0.9rem', padding: '10px' }}
                >
                  ← Back
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {currentError && (
            <div className="home-error">
              {currentError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
