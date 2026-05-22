import React from 'react';
import { useSocket } from '../../context/SocketContext';
import { useGame } from '../../context/GameContext';
import { useCanvas } from '../../hooks/useCanvas';
import DrawingTools from './DrawingTools';
import './Canvas.css';

const DrawingCanvas: React.FC = () => {
  const { socket } = useSocket();
  const { isDrawer, roomId, gameState } = useGame();

  const {
    canvasRef,
    currentColor,
    brushSize,
    currentTool,
    setColor,
    setBrushSize,
    setTool,
    undo,
    clearCanvas,
    cursorPos,
  } = useCanvas({ isDrawer, socket, roomId });

  const isActive = gameState.phase === 'drawing';

  return (
    <div className="canvas-wrapper">
      <div className="canvas-container">
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          className={`drawing-canvas ${isDrawer && isActive ? 'is-drawer' : ''}`}
          style={{ pointerEvents: isActive ? 'auto' : 'none' }}
        />

        {/* Custom brush cursor for drawer */}
        {isDrawer && isActive && cursorPos && (
          <div
            className="brush-cursor"
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: brushSize + 4,
              height: brushSize + 4,
              borderColor: currentTool === 'eraser'
                ? 'rgba(200, 200, 200, 0.8)'
                : 'rgba(0, 0, 0, 0.5)',
            }}
          />
        )}

        {/* Waiting state */}
        {gameState.phase === 'waiting' && (
          <div className="canvas-status">
            <span className="status-emoji">🎨</span>
            <p>Waiting to start...</p>
          </div>
        )}

        {/* Choosing word state */}
        {gameState.phase === 'choosing' && !isDrawer && (
          <div className="canvas-status">
            <span className="status-emoji">🤔</span>
            <p>Artist is choosing a word...</p>
          </div>
        )}
      </div>

      {/* Drawing tools - only for drawer during drawing phase */}
      {isDrawer && isActive && (
        <DrawingTools
          currentColor={currentColor}
          brushSize={brushSize}
          currentTool={currentTool}
          onColorChange={setColor}
          onBrushSizeChange={setBrushSize}
          onToolChange={setTool}
          onUndo={undo}
          onClear={clearCanvas}
        />
      )}
    </div>
  );
};

export default DrawingCanvas;
