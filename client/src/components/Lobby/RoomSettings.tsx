import React, { useState } from 'react';
import type { RoomSettings } from '../../types';

interface RoomSettingsProps {
  settings: RoomSettings;
  onUpdate: (settings: Partial<RoomSettings>) => void;
  isHost: boolean;
}

const RoomSettingsComponent: React.FC<RoomSettingsProps> = ({
  settings,
  onUpdate,
  isHost,
}) => {
  const [customWordInput, setCustomWordInput] = useState('');

  const handleAddWord = () => {
    const word = customWordInput.trim().toLowerCase();
    if (word && !settings.customWords.includes(word)) {
      onUpdate({ customWords: [...settings.customWords, word] });
      setCustomWordInput('');
    }
  };

  const handleRemoveWord = (word: string) => {
    onUpdate({ customWords: settings.customWords.filter(w => w !== word) });
  };

  const handleWordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddWord();
    }
  };

  if (!isHost) {
    return (
      <div className="settings-form">
        <div className="settings-row">
          <span className="settings-label">Max Players</span>
          <span className="settings-value">{settings.maxPlayers}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Rounds</span>
          <span className="settings-value">{settings.rounds}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Draw Time</span>
          <span className="settings-value">{settings.drawTime}s</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Choices</span>
          <span className="settings-value">{settings.wordCount}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Hints</span>
          <span className="settings-value">{settings.hintsCount}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Mode</span>
          <span className="settings-value" style={{ textTransform: 'capitalize' }}>{settings.wordMode}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-form">
      {/* Max Players */}
      <div className="settings-row">
        <span className="settings-label">
          Players
          <span className="jp">最大人数</span>
        </span>
        <div className="settings-control">
          <input
            type="range"
            className="settings-slider"
            min={2}
            max={20}
            value={settings.maxPlayers}
            onChange={(e) => onUpdate({ maxPlayers: Number(e.target.value) })}
          />
          <span className="settings-value">{settings.maxPlayers}</span>
        </div>
      </div>

      {/* Rounds */}
      <div className="settings-row">
        <span className="settings-label">
          Rounds
          <span className="jp">ラウンド数</span>
        </span>
        <div className="settings-control">
          <input
            type="range"
            className="settings-slider"
            min={2}
            max={10}
            value={settings.rounds}
            onChange={(e) => onUpdate({ rounds: Number(e.target.value) })}
          />
          <span className="settings-value">{settings.rounds}</span>
        </div>
      </div>

      {/* Draw Time */}
      <div className="settings-row">
        <span className="settings-label">
          Draw Time
          <span className="jp">描く時間</span>
        </span>
        <div className="settings-control">
          <input
            type="range"
            className="settings-slider"
            min={15}
            max={240}
            step={5}
            value={settings.drawTime}
            onChange={(e) => onUpdate({ drawTime: Number(e.target.value) })}
          />
          <span className="settings-value">{settings.drawTime}s</span>
        </div>
      </div>

      {/* Word Count */}
      <div className="settings-row">
        <span className="settings-label">
          Choices
          <span className="jp">単語の選択数</span>
        </span>
        <div className="settings-control">
          <input
            type="range"
            className="settings-slider"
            min={1}
            max={5}
            value={settings.wordCount}
            onChange={(e) => onUpdate({ wordCount: Number(e.target.value) })}
          />
          <span className="settings-value">{settings.wordCount}</span>
        </div>
      </div>

      {/* Hints */}
      <div className="settings-row">
        <span className="settings-label">
          Hints
          <span className="jp">ヒント数</span>
        </span>
        <div className="settings-control">
          <input
            type="range"
            className="settings-slider"
            min={0}
            max={5}
            value={settings.hintsCount}
            onChange={(e) => onUpdate({ hintsCount: Number(e.target.value) })}
          />
          <span className="settings-value">{settings.hintsCount}</span>
        </div>
      </div>

      {/* Word Mode */}
      <div className="settings-row">
        <span className="settings-label">
          Mode
          <span className="jp">モード</span>
        </span>
        <div className="settings-radio-group">
          <input
            type="radio"
            id="mode-normal"
            name="wordMode"
            className="settings-radio"
            checked={settings.wordMode === 'normal'}
            onChange={() => onUpdate({ wordMode: 'normal' })}
          />
          <label htmlFor="mode-normal" className="settings-radio-label">
            Normal
          </label>
          <input
            type="radio"
            id="mode-hidden"
            name="wordMode"
            className="settings-radio"
            checked={settings.wordMode === 'hidden'}
            onChange={() => onUpdate({ wordMode: 'hidden' })}
          />
          <label htmlFor="mode-hidden" className="settings-radio-label">
            Hidden
          </label>
        </div>
      </div>

      {/* Custom Words */}
      <div className="settings-custom-words">
        <span className="settings-label" style={{ marginBottom: '8px', display: 'block' }}>
          Custom Words
          <span className="jp">カスタムワード</span>
        </span>
        <div className="settings-words-input-row">
          <input
            type="text"
            className="settings-words-input"
            placeholder="Add a custom word..."
            value={customWordInput}
            onChange={(e) => setCustomWordInput(e.target.value)}
            onKeyDown={handleWordKeyDown}
            maxLength={30}
          />
          <button
            className="settings-words-add-btn"
            onClick={handleAddWord}
            disabled={!customWordInput.trim()}
          >
            Add
          </button>
        </div>
        {settings.customWords.length > 0 && (
          <div className="settings-word-tags">
            {settings.customWords.map((word) => (
              <span key={word} className="settings-word-tag">
                {word}
                <button
                  className="settings-word-tag-remove"
                  onClick={() => handleRemoveWord(word)}
                  aria-label={`Remove ${word}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomSettingsComponent;
