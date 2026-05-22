import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { GameProvider } from './context/GameContext';
import { useSocket } from './context/SocketContext';
import Home from './components/Home/Home';
import Lobby from './components/Lobby/Lobby';
import GameBoard from './components/Game/GameBoard';
import './App.css';

const SAKURA_PETALS = ['🌸', '🌸', '💮', '🌸', '🌸', '🌺', '🌸', '💮', '🌸', '🌸'];

const ConnectionBanner: React.FC = () => {
  const { isConnected } = useSocket();
  if (isConnected) return null;
  return (
    <div className="connection-banner">
      🔌 Connecting to server...
    </div>
  );
};

const AppContent: React.FC = () => {
  return (
    <GameProvider>
      <div className="app-wrapper">
        {/* Cherry blossom petals background */}
        <div className="sakura-layer">
          {SAKURA_PETALS.map((petal, i) => (
            <span key={i} className="sakura-petal">{petal}</span>
          ))}
        </div>

        <ConnectionBanner />

        <div className="app-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lobby/:roomId" element={<Lobby />} />
            <Route path="/game/:roomId" element={<GameBoard />} />
          </Routes>
        </div>
      </div>
    </GameProvider>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </BrowserRouter>
  );
};

export default App;
