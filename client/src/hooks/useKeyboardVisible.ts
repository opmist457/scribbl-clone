import { useState, useEffect } from 'react';

/**
 * Detects whether the mobile virtual keyboard is likely open by
 * listening for focus/blur events on <input> and <textarea> elements.
 *
 * This is far more reliable than the visualViewport API, which fires
 * inconsistently across Android Chrome, Samsung Internet, and iOS Safari.
 *
 * Only activates on narrow screens (<=768px) to avoid false positives
 * on desktop where focusing an input doesn't open a virtual keyboard.
 */
export function useKeyboardVisible(): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const isMobile = () => window.innerWidth <= 768;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        isMobile() &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        setIsKeyboardVisible(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      // Only close if focus is NOT moving to another input/textarea
      if (
        !relatedTarget ||
        (relatedTarget.tagName !== 'INPUT' && relatedTarget.tagName !== 'TEXTAREA')
      ) {
        setIsKeyboardVisible(false);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return isKeyboardVisible;
}
