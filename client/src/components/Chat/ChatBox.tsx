import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import './Chat.css';

interface ChatBoxProps {
  onFocusChange?: (focused: boolean) => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({ onFocusChange }) => {
  const { messages, sendMessage, isDrawer, gameState } = useGame();
  const [input, setInput] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const isDrawingPhase = gameState.phase === 'drawing';
  const canSend = !isDrawer || !isDrawingPhase;

  // Auto-scroll to bottom inside the chat container without shifting the window
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput('');
  };

  const handleFocus = () => {
    onFocusChange?.(true);
    if (window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  };

  const handleBlur = () => {
    onFocusChange?.(false);
  };

  return (
    <div className="chat-box">
      <div className="chat-header">
        💬 Chat & Guesses
      </div>

      <div className="chat-messages" ref={messagesContainerRef}>
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
            onFocus={handleFocus}
            onBlur={handleBlur}
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
