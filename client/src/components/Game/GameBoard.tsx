import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import DrawingCanvas from '../Canvas/DrawingCanvas';
import ChatBox from '../Chat/ChatBox';
import Scoreboard from '../Scoreboard/Scoreboard';
import Timer from './Timer';
import HintDisplay from './HintDisplay';
import WordSelection from './WordSelection';
import RoundEnd from './RoundEnd';
import GameOver from './GameOver';
import './Game.css';

const GameBoard: React.FC = () => {
  const {
    gameState,
    players,
    isDrawer,
    leaveRoom,
    myPlayerId,
  } = useGame();

  const navigate = useNavigate();

  useEffect(() => {
    // If the user refreshes or hasn't joined properly, send them to homepage
    if (!myPlayerId) {
      navigate('/', { replace: true });
    }
  }, [myPlayerId, navigate]);

  const currentDrawerPlayer = players.find(p => p.id === gameState.currentDrawer);

  return (
    <div className="game-board">
      {/* Top Bar */}
      <div className="game-top-bar">
        <div className="game-round-info">
          <span className="round-badge">
            Round {gameState.currentRound} / {gameState.totalRounds}
          </span>
          {currentDrawerPlayer && (
            <span className="drawer-name">
              {isDrawer ? (
                <>✏️ <strong>You</strong> are drawing!</>
              ) : (
                <>🎨 <strong>{currentDrawerPlayer.name}</strong> is drawing</>
              )}
            </span>
          )}
        </div>

        <div className="hint-and-timer">
          {gameState.phase === 'drawing' && (
            <>
              {isDrawer && gameState.currentWord ? (
                <span className="drawer-name" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {gameState.currentWord}
                </span>
              ) : (
                <HintDisplay hint={gameState.wordHint} wordLength={gameState.wordLength} />
              )}
              <Timer
                timeRemaining={gameState.timeRemaining}
                totalTime={gameState.totalTime}
              />
            </>
          )}
        </div>

        <button className="leave-game-btn" onClick={leaveRoom}>
          🚪 Leave
        </button>
      </div>

      {/* Scoreboard (Left) */}
      <Scoreboard />

      {/* Center - Canvas */}
      <div className="game-center">
        <DrawingCanvas />
      </div>

      {/* Chat (Right) */}
      <ChatBox />

      {/* Word Selection Modal (for drawer) */}
      {gameState.phase === 'choosing' && isDrawer && gameState.wordChoices.length > 0 && (
        <WordSelection />
      )}

      {/* Round End Overlay */}
      {gameState.phase === 'round_end' && gameState.correctWord && (
        <RoundEnd />
      )}

      {/* Game Over Overlay */}
      {gameState.phase === 'game_over' && (
        <GameOver />
      )}
    </div>
  );
};

export default GameBoard;
