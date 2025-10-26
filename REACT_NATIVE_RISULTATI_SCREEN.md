# Risultati Screen Implementation Guide for React Native

## Overview
The **Risultati** (Results) screen displays the user's weekly match predictions and allows them to reveal results one by one. This document provides comprehensive documentation of how the screen works, including button behavior, prediction badge colors, data flow, and all interactions.

---

## Table of Contents
1. [Screen Purpose](#screen-purpose)
2. [Data Flow Architecture](#data-flow-architecture)
3. [API Endpoints](#api-endpoints)
4. [State Management](#state-management)
5. [Mostra Risultato Button Behavior](#mostra-risultato-button-behavior)
6. [Prediction Badge Color System](#prediction-badge-color-system)
7. [Complete Implementation Flow](#complete-implementation-flow)
8. [Match Card Structure](#match-card-structure)
9. [Confetti Animation](#confetti-animation)
10. [Local Storage (Reveal State)](#local-storage-reveal-state)

---

## 1. Screen Purpose

The Risultati screen serves multiple purposes:
- **Display weekly predictions**: Show all 10 matches from a selected week (Giornata)
- **Reveal results on demand**: Allow users to tap "Mostra Risultato" to reveal the match outcome
- **Visual feedback**: Color-code prediction badges (1/X/2) to show correct/incorrect/pending predictions
- **Track progress**: Display a success meter showing percentage of correct predictions
- **Celebrate wins**: Fire confetti animation when revealing a correct prediction
- **Share results**: Allow users to share their weekly performance

---

## 2. Data Flow Architecture

### Data Sources
The Risultati screen pulls data from **two main sources**:

#### Source 1: Weekly Predictions (with results)
**Endpoint**: `GET /api/predictions/user/:userId/week/:week?mode=live`

**Purpose**: Get all user predictions for the selected week, including match results if available

**Response Structure** (`WeeklyStatsResponseDto`):
```typescript
{
  week: number;                        // Week number (1-38)
  total_predictions: number;           // Total predictions made (0-10)
  correct_predictions: number;         // Number of correct predictions
  success_rate: number;                // Percentage (0-100)
  predictions: SpecResponseDto[];      // Array of prediction objects
}
```

**Individual Prediction Object** (`SpecResponseDto`):
```typescript
{
  id: string;                    // Prediction UUID
  user_id: string;               // Firebase UID
  fixture_id: string;            // Fixture UUID
  choice: '1' | 'X' | '2';      // User's prediction
  result?: '1' | 'X' | '2';     // Actual match result (if finished)
  is_correct?: boolean;          // True/false if result available
  week: number;                  // Week number
  timestamp: Date;               // When prediction was made
  match_display: string;         // "Team A vs Team B"
  choice_display: string;        // Display version of choice
  homeScore?: number | null;     // Home team score (if available)
  awayScore?: number | null;     // Away team score (if available)
}
```

**Example Response**:
```json
{
  "week": 8,
  "total_predictions": 10,
  "correct_predictions": 6,
  "success_rate": 60,
  "predictions": [
    {
      "id": "pred-uuid-1",
      "user_id": "EiT1a0OEybNqNPcABMiaku7Eaf02",
      "fixture_id": "fixture-uuid-1",
      "choice": "1",
      "result": "1",
      "is_correct": true,
      "week": 8,
      "timestamp": "2025-10-25T14:30:00Z",
      "match_display": "Inter vs Juventus",
      "choice_display": "1",
      "homeScore": 2,
      "awayScore": 1
    },
    {
      "id": "pred-uuid-2",
      "user_id": "EiT1a0OEybNqNPcABMiaku7Eaf02",
      "fixture_id": "fixture-uuid-2",
      "choice": "X",
      "result": "2",
      "is_correct": false,
      "week": 8,
      "timestamp": "2025-10-25T14:35:00Z",
      "match_display": "Milan vs Napoli",
      "choice_display": "X",
      "homeScore": 1,
      "awayScore": 2
    }
  ]
}
```

#### Source 2: Fixture Data (fallback for scores)
**Endpoint**: `GET /api/fixtures/week/:week`

**Purpose**: Get raw fixture data including scores, used as fallback when prediction data doesn't include scores

**Response Structure** (`FixtureRow[]`):
```typescript
{
  id: string;                    // Fixture UUID
  homeTeam: string;              // Home team name
  awayTeam: string;              // Away team name
  home_score: number | null;     // Home team score
  away_score: number | null;     // Away team score
  match_date: Date;              // Kickoff time
  venue: string;                 // Stadium name
  status: string;                // Match status (e.g., "FINISHED", "LIVE", "NOT_STARTED")
  week: number;                  // Week number
  // ... other fields
}
```

---

## 3. API Endpoints

### Primary Endpoint
```
GET /api/predictions/user/:userId/week/:week?mode=live
```

**Parameters**:
- `userId`: Firebase UID (string)
- `week`: Week number 1-38 (number)
- `mode`: Must be "live" for production mode

**Headers**:
```
Content-Type: application/json
```

**Example Request**:
```typescript
const response = await fetch(
  `${apiUrl}/predictions/user/EiT1a0OEybNqNPcABMiaku7Eaf02/week/8?mode=live`
);
const data = await response.json();
```

**Success Response** (200):
```json
{
  "week": 8,
  "total_predictions": 10,
  "correct_predictions": 6,
  "success_rate": 60,
  "predictions": [...]
}
```

**Error Response** (404):
```json
{
  "success": false,
  "message": "No predictions found for this week"
}
```
*Note: 404 is normal if user hasn't made predictions yet*

### Fallback Endpoint
```
GET /api/fixtures/week/:week
```

**Purpose**: Get raw fixture data when prediction data is incomplete

---

## 4. State Management

The Risultati screen maintains several pieces of state:

### Core State Variables

```typescript
// User and week selection
const [userId, setUserId] = useState<string | null>(null);
const [selectedWeek, setSelectedWeek] = useState<number>(1);

// Prediction data from API
const [weeklyStats, setWeeklyStats] = useState<WeeklyStatsResponseDto | null>(null);

// Match cards (fixture list for the week)
const [weekCards, setWeekCards] = useState<MatchCard[]>([]);

// Fixture scores (fallback data)
const [fixtureScores, setFixtureScores] = useState<Map<string, {
  homeScore: number | null;
  awayScore: number | null;
  actual?: '1' | 'X' | '2';
}>>(new Map());

// Reveal state (which matches have been revealed)
const [revealed, setRevealed] = useState<Record<string, boolean>>({});

// Recent reveal (for confetti animation)
const [recentlyRevealed, setRecentlyRevealed] = useState<{
  id: string;
  origin?: { x: number; y: number };
} | null>(null);

// UI state
const [toast, setToast] = useState<string | null>(null);
```

### Derived State (useMemo)

#### predByFixture Map
**Purpose**: Quick lookup of prediction data by fixture ID

```typescript
const predByFixture = useMemo(() => {
  const map = new Map<string, {
    prediction: '1' | 'X' | '2' | null;
    actual?: '1' | 'X' | '2';
    isCorrect?: boolean;
    homeScore?: number | null;
    awayScore?: number | null;
  }>();

  if (!weeklyStats) return map;

  for (const p of weeklyStats.predictions || []) {
    const choiceField = p.choice || p.userChoice;
    const resultField = p.result || p.actualResult;
    const fixtureId = p.fixture_id || p.fixtureId;

    map.set(fixtureId, {
      prediction: choiceField,
      actual: resultField,
      isCorrect: p.is_correct ?? p.isCorrect,
      homeScore: p.homeScore,
      awayScore: p.awayScore
    });
  }

  return map;
}, [weeklyStats]);
```

**Example Map Contents**:
```typescript
Map {
  "fixture-uuid-1" => {
    prediction: "1",
    actual: "1",
    isCorrect: true,
    homeScore: 2,
    awayScore: 1
  },
  "fixture-uuid-2" => {
    prediction: "X",
    actual: "2",
    isCorrect: false,
    homeScore: 1,
    awayScore: 2
  }
}
```

#### meter Object
**Purpose**: Calculate success statistics for display

```typescript
const meter = useMemo(() => {
  if (weekCards.length === 0) {
    return { revealed: 0, correct: 0, percent: 0 };
  }

  let revealedCount = 0;
  let correctCount = 0;

  for (const m of weekCards) {
    if (!revealed[m.fixtureId]) continue;  // Skip unrevealed
    revealedCount += 1;

    const pred = predByFixture.get(m.fixtureId);
    if (pred?.isCorrect === true) correctCount += 1;
  }

  const percent = revealedCount > 0
    ? Math.round((correctCount / revealedCount) * 100)
    : 0;

  return { revealed: revealedCount, correct: correctCount, percent };
}, [weekCards, revealed, predByFixture]);
```

**Example meter Output**:
```typescript
{
  revealed: 5,    // User revealed 5 out of 10 matches
  correct: 3,     // 3 of those 5 were correct
  percent: 60     // 60% success rate
}
```

---

## 5. Mostra Risultato Button Behavior

The "Mostra Risultato" (Show Result) button is the primary interaction point on each match card. Its behavior changes based on match status and reveal state.

### Button States

#### State 1: Match Not Finished
**Visual**: Button enabled, text: "MOSTRA\nRISULTATO"
**Background Color**: Gray (`bg-gray-200`)
**On Click**:
1. Check if match is finished
2. If NOT finished: Trigger shake animation
3. Show toast: "Il risultato non è ancora disponibile"
4. Do NOT reveal

**Code Logic**:
```typescript
<button
  onClick={(e) => {
    if (!matchHasFinished) {
      // Shake animation
      const target = e.currentTarget;
      target.style.animation = 'shake 0.5s ease-in-out';
      setTimeout(() => {
        target.style.animation = '';
      }, 500);

      // Show toast
      setToast('Il risultato non è ancora disponibile');
      return; // EXIT - don't reveal
    }

    // If finished, proceed to reveal
    onReveal(m.fixtureId, e.currentTarget);
  }}
  disabled={isRevealed}
  className={`min-w-[72px] px-2 py-2 rounded-md ${statusColor}`}
>
  {isRevealed ? 'FINE\nPARTITA' : 'MOSTRA\nRISULTATO'}
</button>
```

**Shake Animation CSS**:
```css
@keyframes shake {
  0% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
  100% { transform: translateX(0); }
}
```

#### State 2: Match Finished, Not Revealed
**Visual**: Button enabled, text: "MOSTRA\nRISULTATO"
**Background Color**: Green (`bg-green-600`)
**On Click**:
1. Call `onReveal(fixtureId, buttonElement)`
2. Mark fixture as revealed
3. Update local storage
4. If prediction correct → Fire confetti
5. Button changes to State 3

#### State 3: Match Revealed
**Visual**: Button disabled, text: "FINE\nPARTITA"
**Background Color**: Gray (`bg-gray-400`)
**On Click**: Nothing (button is disabled)

### onReveal Function

```typescript
const onReveal = async (fixtureId: string, anchorEl?: HTMLElement) => {
  // 1. Mark as revealed in state
  setRevealed((prev) => ({ ...prev, [fixtureId]: true }));

  // 2. Calculate button position for confetti origin
  let origin: { x: number; y: number } | undefined = undefined;
  try {
    if (anchorEl && typeof window !== 'undefined') {
      const rect = anchorEl.getBoundingClientRect();
      origin = {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      };
    }
  } catch {}

  // 3. Store reveal context for confetti effect
  setRecentlyRevealed({ id: fixtureId, origin });
};
```

### Confetti Trigger

```typescript
// Effect runs when recentlyRevealed changes
useEffect(() => {
  const ctx = recentlyRevealed;
  if (!ctx) return;

  const fid = ctx.id;
  if (!revealed[fid]) return; // Ensure it's marked revealed

  // Get prediction data
  const pred = predByFixture.get(fid);
  const actual = pred?.actual ?? fixtureScores.get(fid)?.actual;
  const userPick = pred?.prediction ?? null;

  if (!actual || !userPick) return; // Wait for data

  // Check if correct
  const isCorrect = userPick === actual;

  if (isCorrect) {
    fireConfetti(ctx.origin); // 🎉 FIRE CONFETTI!
  }

  // Clear to avoid duplicate firing
  setRecentlyRevealed(null);
}, [recentlyRevealed, predByFixture, fixtureScores, revealed, fireConfetti]);
```

**Complete Flow Diagram**:
```
User taps button
    ↓
Is match finished? (matchHasFinished)
    ├─ NO → Shake animation + Toast
    │       "Il risultato non è ancora disponibile"
    │       EXIT
    └─ YES → onReveal(fixtureId)
              ↓
              setRevealed({ fixtureId: true })
              ↓
              setRecentlyRevealed({ id, origin })
              ↓
              useEffect detects change
              ↓
              Check if prediction correct
              ↓
              isCorrect? → fireConfetti(origin) 🎉
              ↓
              Button text changes to "FINE PARTITA"
              Button disabled
              Badge colors update
```

---

## 6. Prediction Badge Color System

Each match card displays three badges representing the three possible outcomes: **1** (Home Win), **X** (Draw), **2** (Away Win). The badges change color based on:
1. Whether user made a prediction
2. Whether result has been revealed
3. Whether prediction was correct

### Color States

#### State 1: Not Chosen (Default)
**Condition**: User did NOT predict this outcome
**Visual**:
- Background: `#f3f4f6` (gray-100)
- Text: `#374151` (gray-700)
- No border/ring

**Example**: User predicted "1", so "X" and "2" badges show gray

#### State 2: Chosen but Not Revealed
**Condition**: User predicted this outcome AND result NOT revealed yet
**Visual**:
- Background: `#e0e7ff` (indigo-100)
- Text: `#4338ca` (indigo-700)
- Ring: `2px solid #818cf8` (indigo-400)

**Example**: User predicted "X", result not revealed → "X" badge shows blue with ring

#### State 3: Correct Prediction (Revealed)
**Condition**: User predicted this outcome AND result revealed AND prediction correct
**Visual**:
- Background: `#ccffb3` (light green)
- Text: `#2a8000` (dark green)
- No ring

**Example**: User predicted "1", match finished 2-1 → "1" badge shows green

#### State 4: Wrong Prediction (Revealed)
**Condition**: User predicted this outcome AND result revealed AND prediction wrong
**Visual**:
- Background: `#ffb3b3` (light red)
- Text: `#cc0000` (dark red)
- No ring

**Example**: User predicted "X", match finished 2-1 → "X" badge shows red

### Badge Rendering Logic

```typescript
{(['1', 'X', '2'] as Choice[]).map((c) => {
  const chosen = pred?.prediction === c;  // Did user choose this?
  const actual = pred?.actual ?? scoreFallback?.actual;  // Actual result
  const correct = chosen && actual === c && isRevealed;  // Correct AND revealed?
  const wrong = chosen && actual !== c && actual != null && isRevealed;  // Wrong AND revealed?

  // Determine classes
  let classes = 'bg-gray-100 text-gray-700';  // DEFAULT: Not chosen

  if (correct) {
    classes = 'bg-[#ccffb3] text-[#2a8000]';  // GREEN: Correct
  } else if (wrong) {
    classes = 'bg-[#ffb3b3] text-[#cc0000]';  // RED: Wrong
  } else if (chosen && !isRevealed) {
    classes = 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400';  // BLUE: Chosen, not revealed
  }

  return (
    <div key={c} className={`w-8 h-8 rounded-md flex items-center justify-center font-semibold ${classes}`}>
      {c}
    </div>
  );
})}
```

### Visual Examples

#### Example 1: Before Reveal
```
User predicted: 1
Match status: Not finished
Result: Not available

┌─────┬─────┬─────┐
│  1  │  X  │  2  │
│ 🔵  │ ⚪️  │ ⚪️  │  (1 = blue ring, X/2 = gray)
└─────┴─────┴─────┘
```

#### Example 2: After Reveal - Correct
```
User predicted: 1
Match status: Finished
Result: 1 (Home Win)

┌─────┬─────┬─────┐
│  1  │  X  │  2  │
│ 🟢  │ ⚪️  │ ⚪️  │  (1 = green, X/2 = gray)
└─────┴─────┴─────┘
```

#### Example 3: After Reveal - Wrong
```
User predicted: X
Match status: Finished
Result: 2 (Away Win)

┌─────┬─────┬─────┐
│  1  │  X  │  2  │
│ ⚪️  │ 🔴  │ ⚪️  │  (X = red, 1/2 = gray)
└─────┴─────┴─────┘
```

### Color Palette Reference

| State | Background | Text | Ring | Hex Codes |
|-------|-----------|------|------|-----------|
| Not Chosen | Gray 100 | Gray 700 | None | `#f3f4f6`, `#374151` |
| Chosen (Not Revealed) | Indigo 100 | Indigo 700 | Indigo 400 | `#e0e7ff`, `#4338ca`, `#818cf8` |
| Correct | Custom Green | Custom Dark Green | None | `#ccffb3`, `#2a8000` |
| Wrong | Custom Red | Custom Dark Red | None | `#ffb3b3`, `#cc0000` |

---

## 7. Complete Implementation Flow

### App Initialization
```
1. Load Firebase Auth → Get userId
2. Determine current week (selectedWeek)
3. Initialize reveal state from localStorage
```

### Data Loading Sequence
```
On selectedWeek change:
  ↓
1. Fetch weeklyStats from API
   GET /api/predictions/user/:userId/week/:week?mode=live
  ↓
2. Fetch weekCards (fixtures for the week)
   GET /api/fixtures/week/:week
  ↓
3. Build predByFixture Map (predictions by fixture ID)
  ↓
4. Build fixtureScores Map (fallback scores)
  ↓
5. Load reveal state from localStorage
  ↓
6. Calculate meter (revealed count, correct count, percentage)
  ↓
7. Render UI
```

### User Interaction Flow

#### Tap "Mostra Risultato" Button
```
User taps button
  ↓
Check: Is match finished?
  ├─ NO → Shake + Toast → EXIT
  └─ YES ↓
onReveal(fixtureId, buttonElement)
  ↓
Update revealed state
  ↓
Save to localStorage
  ↓
Calculate button position (for confetti origin)
  ↓
setRecentlyRevealed({ id, origin })
  ↓
useEffect fires
  ↓
Check prediction correctness
  ├─ Correct → fireConfetti(origin) 🎉
  └─ Wrong → No confetti
  ↓
UI updates:
  - Button text: "FINE PARTITA"
  - Button disabled: true
  - Badge colors update (green/red)
  - Meter updates (revealed count, correct count)
```

#### Change Week
```
User selects different week
  ↓
setSelectedWeek(newWeek)
  ↓
Clear current data
  ↓
Fetch new weeklyStats
  ↓
Fetch new weekCards
  ↓
Load reveal state for new week
  ↓
Recalculate meter
  ↓
Re-render with new data
```

---

## 8. Match Card Structure

Each match card displays:
- Team names (Home vs Away)
- Kickoff time
- Match score (if revealed and available)
- Prediction badges (1/X/2)
- "Mostra Risultato" button

### Card Layout

```
┌─────────────────────────────────────────┐
│  Inter vs Juventus                      │
│  Sabato 26/10 • 20:45                   │
│  ────────────────────────────            │
│                                          │
│  [1] [X] [2]          [MOSTRA RISULTATO]│
│   🟢  ⚪️  ⚪️                              │
│                                          │
│  Score: 2-1 (if revealed)                │
└─────────────────────────────────────────┘
```

### Card Data Binding

```typescript
interface MatchCardProps {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  status: string;
  prediction?: '1' | 'X' | '2';
  result?: '1' | 'X' | '2';
  homeScore?: number;
  awayScore?: number;
  isRevealed: boolean;
  onReveal: (fixtureId: string, buttonEl: HTMLElement) => void;
}
```

### Rendering Example

```typescript
{weekCards.map((m) => {
  const pred = predByFixture.get(m.fixtureId);
  const scoreFallback = fixtureScores.get(m.fixtureId);
  const isRevealed = revealed[m.fixtureId] || false;
  const matchHasFinished = m.status === 'FINISHED' || m.status === 'FT';

  return (
    <div key={m.fixtureId} className="match-card">
      {/* Team Names */}
      <div className="text-lg font-semibold">
        {m.home.name} vs {m.away.name}
      </div>

      {/* Kickoff */}
      <div className="text-sm text-gray-600">
        {formatDate(m.kickoff.iso)}
      </div>

      {/* Score (if revealed) */}
      {isRevealed && (pred?.homeScore != null || scoreFallback?.homeScore != null) && (
        <div className="text-xl font-bold">
          {pred?.homeScore ?? scoreFallback?.homeScore} - {pred?.awayScore ?? scoreFallback?.awayScore}
        </div>
      )}

      {/* Prediction Badges */}
      <div className="flex gap-2">
        {renderBadges(pred, isRevealed)}
      </div>

      {/* Mostra Risultato Button */}
      <button
        onClick={(e) => handleReveal(m.fixtureId, matchHasFinished, e.currentTarget)}
        disabled={isRevealed}
      >
        {isRevealed ? 'FINE\nPARTITA' : 'MOSTRA\nRISULTATO'}
      </button>
    </div>
  );
})}
```

---

## 9. Confetti Animation

### Confetti Library
The web app uses **canvas-confetti** library:
```bash
npm install canvas-confetti
```

### fireConfetti Function

```typescript
const fireConfetti = useCallback((origin?: { x: number; y: number }) => {
  const confetti = (window as any).confetti;
  if (!confetti) return;

  const opts = {
    particleCount: 100,
    spread: 70,
    origin: origin || { x: 0.5, y: 0.5 },  // Default center
    colors: ['#ccffb3', '#2a8000', '#66ff33'],  // Green theme
  };

  confetti(opts);
}, []);
```

### Integration Points

1. **Import library** in component:
```typescript
import confetti from 'canvas-confetti';
```

2. **Call on correct reveal**:
```typescript
if (isCorrect) {
  fireConfetti(ctx.origin);
}
```

### React Native Alternative
For React Native, use **react-native-confetti-cannon**:
```bash
npm install react-native-confetti-cannon
```

```typescript
import ConfettiCannon from 'react-native-confetti-cannon';

<ConfettiCannon
  count={100}
  origin={{ x: origin.x * width, y: origin.y * height }}
  colors={['#ccffb3', '#2a8000', '#66ff33']}
  fadeOut={true}
  autoStart={true}
/>
```

---

## 10. Local Storage (Reveal State)

### Why Local Storage?
- Reveals are **client-side only** (not synced to backend)
- Persists across page refreshes
- Allows users to reveal at their own pace
- Doesn't affect backend statistics

### Storage Key Format
```typescript
const revealKey = `swipick:results:${userId}:week:${selectedWeek}:live`;
```

**Example Keys**:
```
swipick:results:EiT1a0OEybNqNPcABMiaku7Eaf02:week:8:live
swipick:results:EiT1a0OEybNqNPcABMiaku7Eaf02:week:9:live
```

### Storage Value Format
**Stored as**: JSON array of fixture IDs
```json
["fixture-uuid-1", "fixture-uuid-2", "fixture-uuid-3"]
```

### Load from localStorage

```typescript
useEffect(() => {
  if (!revealKey) return;

  try {
    const raw = localStorage.getItem(revealKey);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      const map: Record<string, boolean> = {};
      parsed.forEach((fid) => { map[fid] = true; });
      setRevealed(map);
    } else {
      setRevealed({});
    }
  } catch {
    setRevealed({});
  }
}, [revealKey]);
```

### Save to localStorage

```typescript
useEffect(() => {
  if (!revealKey) return;

  try {
    const ids = Object.entries(revealed)
      .filter(([, v]) => v)  // Only keep true values
      .map(([k]) => k);      // Extract fixture IDs

    localStorage.setItem(revealKey, JSON.stringify(ids));
  } catch {}
}, [revealed, revealKey]);
```

### React Native Alternative
Use **AsyncStorage**:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Load
const loadRevealed = async () => {
  try {
    const raw = await AsyncStorage.getItem(revealKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Convert to map
    }
  } catch {}
};

// Save
const saveRevealed = async (revealed: Record<string, boolean>) => {
  try {
    const ids = Object.entries(revealed)
      .filter(([, v]) => v)
      .map(([k]) => k);
    await AsyncStorage.setItem(revealKey, JSON.stringify(ids));
  } catch {}
};
```

---

## Summary Checklist for React Native Implementation

### Data Fetching
- [ ] Implement `GET /api/predictions/user/:userId/week/:week?mode=live`
- [ ] Implement `GET /api/fixtures/week/:week` (fallback)
- [ ] Parse `WeeklyStatsResponseDto` response
- [ ] Build `predByFixture` Map from predictions
- [ ] Build `fixtureScores` Map from fixtures

### State Management
- [ ] Create state for `weeklyStats`, `weekCards`, `revealed`, `recentlyRevealed`
- [ ] Implement `predByFixture` derived state (useMemo equivalent)
- [ ] Implement `meter` calculation (revealed count, correct count, %)
- [ ] Load/save reveal state with AsyncStorage

### Button Behavior
- [ ] Implement "Mostra Risultato" button with 3 states
- [ ] Add shake animation for unfinished matches
- [ ] Show toast "Il risultato non è ancora disponibile"
- [ ] Implement `onReveal` function
- [ ] Change button to "FINE PARTITA" after reveal
- [ ] Disable button after reveal

### Badge Colors
- [ ] Implement 4 color states (not chosen, chosen, correct, wrong)
- [ ] Apply colors based on prediction + reveal state
- [ ] Use exact hex codes: `#ccffb3`, `#2a8000`, `#ffb3b3`, `#cc0000`, `#e0e7ff`, `#4338ca`
- [ ] Add ring to "chosen but not revealed" state

### Confetti Animation
- [ ] Install `react-native-confetti-cannon`
- [ ] Fire confetti on correct prediction reveal
- [ ] Calculate origin from button position
- [ ] Use green color theme

### Additional Features
- [ ] Week selector (navigate between weeks)
- [ ] Success meter display
- [ ] Share functionality (React Native Share API)
- [ ] Toast notifications
- [ ] Loading states
- [ ] Error handling

---

## Implementation Notes for React Native

### Key Differences from Web
1. **No localStorage** → Use AsyncStorage
2. **No canvas-confetti** → Use react-native-confetti-cannon
3. **No CSS classes** → Use StyleSheet or styled-components
4. **Touch events** → Use TouchableOpacity for buttons
5. **Animations** → Use Animated API or react-native-reanimated

### Recommended Libraries
```json
{
  "@react-native-async-storage/async-storage": "^1.21.0",
  "react-native-confetti-cannon": "^1.5.2",
  "react-native-reanimated": "^3.6.0"
}
```

### Performance Considerations
- Use `useMemo` for `predByFixture` and `meter` calculations
- Use `useCallback` for `onReveal` and `fireConfetti`
- Implement FlatList for match cards (virtualization)
- Debounce week changes
- Cache API responses

---

## API Response Examples

### Successful Week with Predictions
```json
{
  "week": 8,
  "total_predictions": 10,
  "correct_predictions": 6,
  "success_rate": 60,
  "predictions": [
    {
      "id": "pred-1",
      "user_id": "EiT1a0OEybNqNPcABMiaku7Eaf02",
      "fixture_id": "fixture-1",
      "choice": "1",
      "result": "1",
      "is_correct": true,
      "week": 8,
      "timestamp": "2025-10-25T14:30:00Z",
      "match_display": "Inter vs Juventus",
      "choice_display": "1",
      "homeScore": 2,
      "awayScore": 1
    }
  ]
}
```

### Week with No Predictions (404)
```json
{
  "success": false,
  "message": "No predictions found for this week"
}
```

---

## Contact & Support
For questions about this implementation, contact the backend team or refer to:
- Backend controller: `apps/backend/gaming-services/src/modules/specs/specs.controller.ts`
- Frontend implementation: `apps/frontend/frontend-service/app/risultati/page.tsx`
- API client: `apps/frontend/frontend-service/lib/api-client.ts`
