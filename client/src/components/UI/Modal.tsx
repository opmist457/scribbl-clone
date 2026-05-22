import React, { useEffect, useCallback } from 'react';
import './UI.css';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  showClose?: boolean;
  clickOutsideToClose?: boolean;
  children: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  showClose = true,
  clickOutsideToClose = true,
  children,
  className = '',
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={clickOutsideToClose && onClose ? onClose : undefined}
    >
      <div
        className={`modal-container ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && onClose && (
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
