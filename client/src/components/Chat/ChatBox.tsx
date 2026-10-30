import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGame } from '../../context/GameContext';
import './Chat.css';

interface ChatBoxProps {
  onFocusChange?: (focused: boolean) => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({ onFocusChange }) => {
  const { messages, sendMessage, isDrawer, gameState } = useGame();
  const [input, setInput] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDrawingPhase = gameState.phase === 'drawing';
  const canSend = !isDrawer || !isDrawingPhase;

  // Auto-scroll to bottom inside the chat container without shifting the window
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Clean up blur timer on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const doSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput('');
  }, [input, sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    onFocusChange?.(true);
    if (window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  };

  const handleBlur = () => {
    // Delay unsetting typing state by 250ms so taps on the Send button don't get canceled by layout shift
    blurTimeoutRef.current = setTimeout(() => {
      onFocusChange?.(false);
    }, 250);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSubmit();
    }
  };

  const handleSendPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Prevent the input from losing focus when touching the Send button
    e.preventDefault();
  };

  const handleSendTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    // On mobile touch devices, execute submission directly if click would be delayed/canceled
    if (input.trim()) {
      e.preventDefault();
      doSubmit();
      inputRef.current?.focus();
    }
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
            ref={inputRef}
            className="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={isDrawingPhase ? '推測を入力... (Type your guess)' : 'メッセージ... (Message)'}
            maxLength={100}
            autoComplete="off"
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!input.trim()}
            onPointerDown={handleSendPointerDown}
            onMouseDown={(e) => e.preventDefault()}
            onTouchEnd={handleSendTouchEnd}
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
};

export default ChatBox;
