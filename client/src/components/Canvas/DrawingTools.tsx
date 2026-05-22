import React, { useState } from 'react';
import type { DrawTool } from '../../types';
import { BRUSH_COLORS, BRUSH_SIZES } from '../../utils/constants';

interface DrawingToolsProps {
  currentColor: string;
  brushSize: number;
  currentTool: DrawTool;
  onColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onToolChange: (tool: DrawTool) => void;
  onUndo: () => void;
  onClear: () => void;
}

const DrawingTools: React.FC<DrawingToolsProps> = ({
  currentColor,
  brushSize,
  currentTool,
  onColorChange,
  onBrushSizeChange,
  onToolChange,
  onUndo,
  onClear,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClear = () => {
    if (showClearConfirm) {
      onClear();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  return (
    <div className="drawing-tools">
      {/* Color Palette */}
      <div className="tools-section color-palette">
        {BRUSH_COLORS.map((color) => (
          <button
            key={color}
            className={`color-swatch ${currentColor === color && currentTool !== 'eraser' ? 'active' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => {
              onColorChange(color);
              onToolChange('brush');
            }}
            title={color}
          />
        ))}
      </div>

      <div className="tools-divider" />

      {/* Brush Sizes */}
      <div className="tools-section brush-sizes">
        {BRUSH_SIZES.map(({ label, value }) => (
          <button
            key={value}
            className={`brush-size-btn ${brushSize === value ? 'active' : ''}`}
            onClick={() => onBrushSizeChange(value)}
            title={label}
          >
            <span
              className="brush-size-dot"
              style={{ width: Math.min(value, 20), height: Math.min(value, 20) }}
            />
          </button>
        ))}
      </div>

      <div className="tools-divider" />

      {/* Tool Selection */}
      <div className="tools-section">
        <button
          className={`tool-btn ${currentTool === 'brush' ? 'active' : ''}`}
          onClick={() => onToolChange('brush')}
          title="Brush (B)"
        >
          🖌️
        </button>
        <button
          className={`tool-btn ${currentTool === 'eraser' ? 'active' : ''}`}
          onClick={() => onToolChange('eraser')}
          title="Eraser (E)"
        >
          🧹
        </button>
      </div>

      <div className="tools-divider" />

      {/* Actions */}
      <div className="tools-section">
        <button className="tool-btn" onClick={onUndo} title="Undo (Ctrl+Z)">
          ↩️
        </button>
        <button
          className={`tool-btn danger ${showClearConfirm ? 'active' : ''}`}
          onClick={handleClear}
          title={showClearConfirm ? 'Click again to confirm' : 'Clear Canvas'}
        >
          {showClearConfirm ? '⚠️' : '🗑️'}
        </button>
      </div>
    </div>
  );
};

export default DrawingTools;
