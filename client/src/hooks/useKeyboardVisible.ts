import { useState, useEffect } from 'react';

/**
 * Detects whether the mobile virtual keyboard is open by comparing
 * the visual viewport height against the window's inner height.
 * 
 * When the keyboard pops up, `window.visualViewport.height` shrinks
 * while `window.innerHeight` stays the same (or also shrinks depending
 * on the `interactive-widget` meta value). A significant difference
 * (> 150px) reliably indicates the keyboard is visible.
 * 
 * Only activates on narrow screens (<=768px) to avoid false positives
 * on desktop browsers.
 */
export function useKeyboardVisible(): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return; // Not supported (very old browsers)

    // Store the initial full height so we can compare against it
    let fullHeight = viewport.height;

    const handleResize = () => {
      // Only run on mobile-width screens
      if (window.innerWidth > 768) {
        setIsKeyboardVisible(false);
        return;
      }

      // If the viewport shrinks by more than 150px, the keyboard is open
      const heightDiff = fullHeight - viewport.height;
      const keyboardOpen = heightDiff > 150;

      setIsKeyboardVisible(keyboardOpen);

      // When the keyboard closes, update the full height reference
      // (handles orientation changes)
      if (!keyboardOpen) {
        fullHeight = viewport.height;
      }
    };

    viewport.addEventListener('resize', handleResize);

    return () => {
      viewport.removeEventListener('resize', handleResize);
    };
  }, []);

  return isKeyboardVisible;
}
