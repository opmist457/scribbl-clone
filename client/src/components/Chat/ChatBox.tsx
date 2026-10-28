import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import './Chat.css';

const ChatBox: React.FC = () => {
  const { messages, sendMessage, isDrawer, gameState } = useGame();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isDrawingPhase = gameState.phase === 'drawing';
  const canSend = !isDrawer || !isDrawingPhase;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput('');
  };

  return (
    <div className="chat-box">
      <div className="chat-header">
        💬 Chat & Guesses
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-msg system">
            Messages will appear here...
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.type}`}>
            {msg.type === 'chat' && (
              <>
                <span className="msg-sender">{msg.playerName}:</span>
                {msg.content}
              </>
            )}
            {msg.type === 'correct_guess' && (
              <>🎉 {msg.content}</>
            )}
            {msg.type === 'close_guess' && (
              <>🤏 {msg.content}</>
            )}
            {(msg.type === 'system' || msg.type === 'join' || msg.type === 'leave') && (
              <>{msg.content}</>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {isDrawer && isDrawingPhase ? (
        <div className="chat-drawer-notice">
          ✏️ You are drawing — no guessing!
        </div>
      ) : (
        <form className="chat-input-area" onSubmit={handleSubmit}>
          <input
            className="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isDrawingPhase ? '推測を入力... (Type your guess)' : 'メッセージ... (Message)'}
            maxLength={100}
            autoComplete="off"
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!input.trim()}
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
};

export default ChatBox;
