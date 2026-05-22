/* ==============================
 * CONSTANTS
 * ============================== */

// Drawing color palette
export const BRUSH_COLORS: string[] = [
  '#000000', // Black
  '#ffffff', // White
  '#808080', // Gray
  '#c0c0c0', // Silver
  '#8b2252', // Deep Red (Japanese)
  '#c0392b', // Red
  '#e74c3c', // Light Red
  '#ffb7c5', // Sakura Pink
  '#f39c12', // Orange
  '#c9a84c', // Gold
  '#f1c40f', // Yellow
  '#5a7247', // Bamboo Green
  '#2ecc71', // Green
  '#1abc9c', // Teal
  '#3498db', // Blue
  '#1a1147', // Deep Indigo
  '#9b59b6', // Purple
  '#2d1b69', // Dark Purple
  '#8e44ad', // Violet
  '#e8a0bf', // Cherry Blossom
];

// Avatar color options
export const AVATAR_COLORS: string[] = [
  '#ffb7c5', // Sakura Pink
  '#c9a84c', // Gold
  '#5a7247', // Bamboo Green
  '#1a1147', // Deep Indigo
  '#8b2252', // Deep Red
  '#3498db', // Blue
  '#e8a0bf', // Cherry Blossom
  '#f39c12', // Amber
  '#9b59b6', // Purple
  '#1abc9c', // Teal
  '#e74c3c', // Red
  '#2d1b69', // Dark Purple
];

// Default room settings
export const DEFAULT_ROOM_SETTINGS = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  wordMode: 'normal' as const,
  customWords: [] as string[],
};

export const BRUSH_SIZES = [
  { label: 'Tiny', value: 2 },
  { label: 'Small', value: 6 },
  { label: 'Medium', value: 12 },
  { label: 'Large', value: 24 },
  { label: 'Huge', value: 40 },
];

// Animation durations (ms)
export const ANIMATION = {
  pageTransition: 400,
  cardHover: 200,
  modalEntrance: 300,
  petalFall: 15000,
  scoreChange: 600,
  messageAppear: 200,
  hintReveal: 500,
};

// Word choose timer
export const WORD_CHOOSE_TIME = 15;

// Round end display time
export const ROUND_END_DISPLAY_TIME = 5000;
