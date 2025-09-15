/**
 * Centralized exports for all Gioca page types
 * Provides a single import point for type definitions
 */

// Re-export all fixture types
export type {
  Team,
  Fixture,
  TestFixtureAPI,
  DatabaseFixture,
  RawFixtureData,
} from './fixtures';

export {
  isTestFixture,
  isTestFixtureArray,
} from './fixtures';

// Re-export all match card types
export type {
  MatchCardKickoff,
  Last5Item,
  MatchCardTeamHome,
  MatchCardTeamAway,
  MatchCard,
  PredictionChoice,
  PredictionResult,
  PredictionRecord,
} from './matchCards';

// Re-export all game state types
export type {
  GameMode,
  UserMissingModalState,
  GiocaPersistState,
  GameState,
  TimeToMatch,
  SwipeDirection,
  DateRange,
} from './gameState';