/**
 * Constants and configuration for the Gioca page
 * Extracted from the main component for better maintainability
 */

// Debug and feature flags
export const DEBUG_GIOCA = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_GIOCA === '1';
export const MISSED_WEEK_GATING = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MISSED_WEEK_GATING === '1';

export const TERMINAL_WEEK = (() => {
  const v = typeof process !== 'undefined' ? parseInt(String(process.env.NEXT_PUBLIC_TEST_TERMINAL_WEEK || '4'), 10) : 4;
  return Number.isFinite(v) ? v : 4;
})();

// Animation constants
export const ANIMATION_CONFIG = {
  // Gesture thresholds
  SWIPE_DISTANCE: 900,
  SWIPE_THRESHOLD: 150,
  DRAG_ELASTIC: 0.15,
  
  // Animation durations (in ms)
  CARD_TRANSITION: 300,
  SKIP_ANIMATION: 500,
  
  // Transform values for card rotation and movement
  CARD_X_RANGE: [-320, 0, 320] as const,
  CARD_Y_RANGE: [-24, 0, 24] as const,
  CARD_ROTATE_RANGE: [-10, 0, 10] as const,
} as const;

// Game configuration
export const GAME_CONFIG = {
  // Total predictions required for completion
  TOTAL_PREDICTIONS: 10,
  
  // Week configuration
  MAX_WEEKS: 38,
  DEFAULT_WEEK: 1,
  
  // Cache and polling intervals (in ms)
  FIXTURES_POLLING_INTERVAL: 60000, // 60 seconds
  CACHE_TTL: 15 * 60 * 1000, // 15 minutes
  
  // Countdown update interval
  COUNTDOWN_INTERVAL: 1000, // 1 second
  TARGET_RECOMPUTE_INTERVAL: 15000, // 15 seconds
} as const;

// UI constants
export const UI_CONFIG = {
  // Header heights
  DEFAULT_HEADER_HEIGHT: 160,
  
  // Layout breakpoints and sizes
  MAX_CARD_WIDTH: 390,
  CARD_PADDING: 3,
  
  // Z-index layers
  Z_INDEX: {
    CARD_STACK: 10,
    PREVIEW_CARD: 20,
    MODAL: 50,
  },
} as const;

// Persistence keys for localStorage
export const STORAGE_KEYS = {
  PERSISTENCE_STATE: (mode: string, week: number, user: string) => 
    `swipick:gioca:state:v1:mode:${mode}:week:${week}:user:${user}`,
  HAS_WEEK_PREDICTIONS: (week: number, user: string) => 
    `swipick:gioca:hasPreds:test:week:${week}:user:${user}`,
  WEEK1_ROLLOVER: (user: string) => 
    `swipick:risultati:autoRoll:week1:user:${user}`,
} as const;

// API endpoints (if any constants are used)
export const API_CONFIG = {
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // Request timeouts
  DEFAULT_TIMEOUT: 30000,
} as const;

// Date and time formatting
export const DATE_CONFIG = {
  TIMEZONE: 'Europe/Rome',
  LOCALE: 'it-IT',
  
  // Display formats
  TIME_FORMAT: { hour: '2-digit', minute: '2-digit' } as const,
  DATE_FORMAT: { 
    weekday: 'short', 
    day: '2-digit', 
    month: '2-digit' 
  } as const,
} as const;