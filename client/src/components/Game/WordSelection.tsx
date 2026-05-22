import React, { useState, useEffect, useCallback } from 'react';
import { useGame } from '../../context/GameContext';
import Modal from '../UI/Modal';
import { WORD_CHOOSE_TIME } from '../../utils/constants';

const WordSelection: React.FC = () => {
  const { gameState, chooseWord } = useGame();
  const [timeLeft, setTimeLeft] = useState(WORD_CHOOSE_TIME);
  const [selected, setSelected] = useState(false);

  const handleChoose = useCallback((word: string) => {
    if (selected) return;
    setSelected(true);
    chooseWord(word);
  }, [selected, chooseWord]);

  // Auto-select random word when timer runs out
  useEffect(() => {
    if (timeLeft <= 0 && !selected && gameState.wordChoices.length > 0) {
      const randomWord = gameState.wordChoices[Math.floor(Math.random() * gameState.wordChoices.length)];
      handleChoose(randomWord);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, selected, gameState.wordChoices, handleChoose]);

  return (
    <Modal isOpen={true} showClose={false} clickOutsideToClose={false}>
      <div className="word-selection">
        <h2>✨ Choose a Word to Draw</h2>
        <p className="subtitle">言葉を選んでください</p>

        <div className="word-choices">
          {gameState.wordChoices.map((word, i) => (
            <button
              key={i}
              className="word-card"
              onClick={() => handleChoose(word)}
              disabled={selected}
            >
              {word}
            </button>
          ))}
        </div>

        <div className="word-timer">
          ⏳ {timeLeft}s
        </div>
      </div>
    </Modal>
  );
};

export default WordSelection;
