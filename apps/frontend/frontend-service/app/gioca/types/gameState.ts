/**
 * Game State types for the Gioca page
 * Contains all state-related interfaces and types
 */

import type { Fixture, TestFixtureAPI } from './fixtures';
import type { MatchCard, PredictionRecord } from './matchCards';

// Game Mode types (already exists in context, but defining for completeness)
export type GameMode = 'test' | 'live';

// Modal state interfaces
export interface UserMissingModalState {
  show: boolean;
  triedUid?: string;
}

// Persistence interfaces for localStorage
export interface GiocaPersistState {
  v: 1; // version
  lastIndex: number;
  predictions: PredictionRecord;
  deck: number[];
}

// Main game state interface - could be used for context
export interface GameState {
  // Current game configuration
  currentMode: GameMode;
  currentWeek: number;
  currentLiveWeek: number | null;
  selectedWeek: number;
  
  // Data state
  fixtures: Fixture[];
  matchCards: MatchCard[];
  predictions: PredictionRecord;
  currentFixtureIndex: number;
  
  // UI state
  loading: boolean;
  error: string | null;
  toast: string | null;
  
  // Animation state
  isSkipAnimating: boolean;
  previewOnTop: boolean;
  
  // Modal states
  missedWeekModalOpen: boolean;
  testingModalOpen: boolean;
  userMissingModal: UserMissingModalState;
  
  // Completion state
  weekComplete: boolean;
  localComplete: boolean;
  rolledWeek1Once: boolean;
  
  // User state
  userKey: string | null;
  
  // Timing state
  nextTarget: Date | null;
  
  // Layout state
  completeHeaderH: number;
}

// Countdown timer state
export interface TimeToMatch {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Animation and gesture types
export interface SwipeDirection {
  direction: 'left' | 'right' | 'up' | 'down';
  choice: '1' | 'X' | '2' | 'skip';
}

// Date range for week calculations
export interface DateRange {
  start: Date;
  end: Date;
}