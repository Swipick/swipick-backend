# Profilo Page Implementation Guide for React Native

## Overview
The **Profilo** (Profile) page displays the user's performance statistics, including average accuracy, best/worst week performance, and a shareable profile summary. This is a read-only statistics dashboard that pulls data from the predictions system.

---

## Table of Contents
1. [Page Purpose](#page-purpose)
2. [Complete API Endpoints](#complete-api-endpoints)
3. [Data Flow Architecture](#data-flow-architecture)
4. [State Management](#state-management)
5. [UI Components Breakdown](#ui-components-breakdown)
6. [KPI Calculations](#kpi-calculations)
7. [Share Functionality](#share-functionality)
8. [Implementation Checklist](#implementation-checklist)

---

## 1. Page Purpose

The Profilo page serves as the user's **performance dashboard**:
- **Display user info**: Avatar, name, nickname/username
- **Show statistics**: Average accuracy, weeks played
- **Highlight performance**: Best and worst week results
- **Enable sharing**: Share button to post performance stats
- **Navigate to settings**: Gear icon to open Impostazioni page

### Key Features:
- Real-time data loading from backend
- Automatic calculation of statistics
- Avatar display (from Google profile or uploaded image)
- Share profile functionality (native mobile share)
- Navigation to settings page

---

## 2. Complete API Endpoints

### Endpoint 1: Get User by Firebase UID
**Purpose**: Resolve the backend user ID from Firebase UID and get basic user info

```
GET /api/users/profile/firebase/:firebaseUid
```

**Parameters**:
- `firebaseUid`: Firebase authentication UID (string)

**Request Example**:
```typescript
const response = await fetch(
  `${apiUrl}/users/profile/firebase/EiT1a0OEybNqNPcABMiaku7Eaf02`
);
const data = await response.json();
```

**Response Structure**:
```typescript
{
  "success": true,
  "data": {
    "id": "backend-user-uuid",           // Backend user ID (use for other API calls)
    "firebaseUid": "EiT1a0OEybNqNPcABMiaku7Eaf02",
    "email": "user@example.com",
    "nome": "John Doe",                  // Full name (can be null)
    "sopranome": "johndoe",              // Nickname/username (can be null)
    "googleProfileUrl": "https://...",   // Google profile photo URL (can be null)
    "needsProfileCompletion": false,
    "createdAt": "2025-10-01T10:00:00Z",
    "updatedAt": "2025-10-26T18:00:00Z"
  },
  "message": "User found"
}
```

**Error Response** (404):
```json
{
  "success": false,
  "message": "User not found"
}
```

---

### Endpoint 2: Get User Summary (Live Mode)
**Purpose**: Fetch user's complete prediction statistics including weekly breakdown

```
GET /api/predictions/user/:userId/summary?mode=live
```

**Parameters**:
- `userId`: Firebase UID (string) - **NOTE: Uses Firebase UID, not backend user ID**
- `mode`: Must be "live" for production mode (query param)

**Request Example**:
```typescript
const response = await fetch(
  `${apiUrl}/predictions/user/EiT1a0OEybNqNPcABMiaku7Eaf02/summary?mode=live`
);
const data = await response.json();
```

**Response Structure** (Snake Case):
```typescript
{
  "success": true,
  "data": {
    "user_id": "EiT1a0OEybNqNPcABMiaku7Eaf02",
    "total_predictions": 80,              // Total predictions across all weeks
    "correct_predictions": 52,            // Total correct predictions
    "overall_success_rate": 65.0,         // Percentage (0-100)
    "weekly_stats": [
      {
        "week": 1,
        "total_predictions": 10,
        "correct_predictions": 7,
        "success_rate": 70.0,             // Percentage for this week
        "points": 7                       // Points earned this week
      },
      {
        "week": 2,
        "total_predictions": 10,
        "correct_predictions": 5,
        "success_rate": 50.0,
        "points": 5
      },
      // ... more weeks
    ]
  }
}
```

**Response with Wrapper** (Some endpoints may wrap in additional `data` key):
```typescript
{
  "data": {
    "user_id": "...",
    "total_predictions": 80,
    // ... rest of structure
  }
}
```

**Error Response** (404):
```json
{
  "success": false,
  "message": "No predictions found for user"
}
```
*Note: 404 is normal for new users with no predictions yet*

---

### Endpoint 3: Get User Avatar
**Purpose**: Retrieve stored user avatar image (base64 encoded)

```
GET /api/users/:userId/avatar
```

**Parameters**:
- `userId`: Backend user ID (UUID string)

**Request Example**:
```typescript
const response = await fetch(
  `${apiUrl}/users/backend-user-uuid/avatar`
);
const data = await response.json();
```

**Response Structure**:
```typescript
{
  "success": true,
  "data": {
    "mimeType": "image/jpeg",
    "base64": "iVBORw0KGgoAAAANSUhEUgAA..."  // Base64 encoded image
  }
}
```

**Usage**:
```typescript
// Convert to data URL for display
const avatarUrl = `data:${mimeType};base64,${base64}`;
```

**Error Response** (404):
```json
{
  "success": false,
  "message": "Avatar not found"
}
```
*Note: 404 is normal if user hasn't uploaded an avatar - fallback to Google profile URL or initials*

---

## 3. Data Flow Architecture

### Complete Loading Sequence

```
1. App Initialization
   ↓
2. Load Firebase Auth → Get firebaseUser.uid
   ↓
3. Check Authentication
   ├─ If NOT authenticated → Redirect to /login
   └─ If authenticated → Continue
   ↓
4. API Call #1: getUserByFirebaseUid(firebaseUid)
   ↓
   Returns: { id, email, nome, sopranome, googleProfileUrl }
   ↓
5. Extract and Set State
   - userId = data.id (backend UUID)
   - displayName = firstName from nome (or email local part)
   - nickname = sopranome
   - email = data.email
   - avatarUrl = googleProfileUrl (temporary)
   ↓
6. API Call #2: getUserSummary(firebaseUid, 'live')
   ↓
   Returns: { total_predictions, correct_predictions, overall_success_rate, weekly_stats[] }
   ↓
7. Normalize Response (handle snake_case → camelCase)
   ↓
8. Set summary state
   ↓
9. API Call #3 (Optional): getUserAvatar(userId)
   ↓
   Returns: { mimeType, base64 }
   ↓
10. Update avatarUrl if avatar exists
    ↓
11. Calculate KPIs (useMemo)
    - weeksPlayed (weeks with totalPredictions > 0)
    - average (weighted average accuracy across all predictions)
    - best week (highest accuracy, tie-break by correct count)
    - worst week (lowest accuracy, tie-break by correct count)
    ↓
12. Render UI with data
```

### Data Transformation Flow

**Backend Response** (snake_case):
```json
{
  "weekly_stats": [
    {
      "week": 1,
      "total_predictions": 10,
      "correct_predictions": 7,
      "success_rate": 70.0,
      "points": 7
    }
  ]
}
```

**Normalized State** (camelCase):
```typescript
{
  weeklyStats: [
    {
      week: 1,
      totalPredictions: 10,
      correctPredictions: 7,
      accuracy: 70.0,
      points: 7
    }
  ]
}
```

---

## 4. State Management

### Core State Variables

```typescript
// Authentication
const [firebaseUser, setFirebaseUser] = useState(null);

// User Info
const [userId, setUserId] = useState<string | null>(null);           // Backend UUID
const [displayName, setDisplayName] = useState<string>('');          // First name
const [nickname, setNickname] = useState<string | null>(null);       // Username
const [email, setEmail] = useState<string>('');
const [avatarUrl, setAvatarUrl] = useState<string | null>(null);    // Image URL or data URL

// Statistics
const [summary, setSummary] = useState<UserSummary | null>(null);

// UI State
const [loading, setLoading] = useState<boolean>(true);
const [error, setError] = useState<string | null>(null);
```

### Type Definitions

```typescript
interface WeeklyStats {
  week: number;                    // Week number (1-38)
  totalPredictions: number;        // Predictions made this week (0-10)
  correctPredictions: number;      // Correct predictions this week
  accuracy: number;                // Percentage (0-100)
  points: number;                  // Points earned this week
}

interface UserSummary {
  totalPredictions: number;        // Total across all weeks
  correctPredictions: number;      // Total correct across all weeks
  overallAccuracy: number;         // Overall percentage (0-100)
  totalPoints: number;             // Total points earned
  currentWeek: number;             // Current active week
  weeklyStats: WeeklyStats[];      // Array of weekly performance
}
```

### Derived State (useMemo)

#### KPI Calculations

```typescript
const kpi = useMemo(() => {
  const weeks = summary?.weeklyStats || [];

  // Filter weeks where user made predictions
  const played = weeks.filter(w => w.totalPredictions > 0);
  const weeksPlayed = played.length;

  // Calculate weighted average (preferred over backend's overallAccuracy)
  const totals = played.reduce(
    (acc, w) => {
      acc.finished += w.totalPredictions;
      acc.correct += w.correctPredictions;
      return acc;
    },
    { finished: 0, correct: 0 }
  );
  const avg = totals.finished > 0
    ? (totals.correct / totals.finished) * 100
    : 0;

  // Find best week (highest accuracy, tie-break: more correct, then earlier week)
  const cmpBest = (a, b) => {
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    const bc = b.correctPredictions - a.correctPredictions;
    if (bc !== 0) return bc;
    return a.week - b.week;
  };
  const best = played.length
    ? [...played].sort(cmpBest)[0]
    : { accuracy: 0, week: 1 };

  // Find worst week (lowest accuracy, tie-break: fewer correct, then earlier week)
  const cmpWorst = (a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    const bc = a.correctPredictions - b.correctPredictions;
    if (bc !== 0) return bc;
    return a.week - b.week;
  };
  const worst = played.length
    ? [...played].sort(cmpWorst)[0]
    : { accuracy: 0, week: 1 };

  // Format percentages in Italian locale (e.g., "65,5%")
  const fmtPct = (n) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`;

  return {
    average: fmtPct(avg),
    weeksPlayed,
    best: { pct: fmtPct(best.accuracy), week: best.week },
    worst: { pct: fmtPct(worst.accuracy), week: worst.week }
  };
}, [summary]);
```

**Example KPI Output**:
```typescript
{
  average: "65,5%",
  weeksPlayed: 8,
  best: { pct: "80,0%", week: 3 },
  worst: { pct: "40,0%", week: 5 }
}
```

---

## 5. UI Components Breakdown

### Layout Structure

```
┌─────────────────────────────────────────┐
│  ┌─────────────────────────────────┐   │
│  │ Gradient Header (Purple)         │   │
│  │                                   │   │
│  │  ┌──────┐                        │   │
│  │  │Avatar│         [⚙️ Settings]  │   │
│  │  └──────┘                        │   │
│  │  John                            │   │
│  │  @johndoe                        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Punteggio medio                  │   │
│  │                           65,5%  │   │
│  │                  8 giornate      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │Risultato     │  │Risultato     │   │
│  │migliore      │  │peggiore      │   │
│  │              │  │              │   │
│  │       80,0%  │  │       40,0%  │   │
│  │  giornata 3  │  │  giornata 5  │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
│         [🔗 Condividi profilo]         │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      Bottom Navigation            │   │
│  │    [Gioca] [Risultati] [Profilo] │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Component 1: Gradient Header

**Visual Specifications**:
- Background: Radial gradient from `#554099` to `#3d2d73`
- Shadow: `0 8px 16px rgba(85, 64, 153, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)`
- Rounded bottom corners: `rounded-b-2xl` (border-radius: 16px)
- Padding: Top 36px, Bottom 28px, Horizontal 40px
- Text color: White

**Content**:
1. **Avatar** (128x128px, rounded-2xl):
   - If `avatarUrl` exists: Display image
   - Else: Display first initial of displayName in white on purple background

2. **User Info**:
   - Line 1: `displayName` (font-size: 18px, font-weight: 600)
   - Line 2: `@${nickname}` or `@${email.split('@')[0]}` (font-size: 14px, opacity: 0.8)

3. **Settings Button** (top right):
   - Icon: Gear/Settings icon
   - Action: Navigate to `/impostazioni`
   - Style: Transparent, hover background white/10

**React Native Implementation**:
```typescript
const HeaderAvatar = () => {
  const initial = (displayName || email || ' ')[0]?.toUpperCase() || 'U';

  if (avatarUrl) {
    return (
      <View style={styles.avatarContainer}>
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      </View>
    );
  }

  return (
    <View style={[styles.avatarContainer, styles.avatarPlaceholder]}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
};
```

---

### Component 2: Average Card

**Visual Specifications**:
- Background: Linear gradient from white to `#d8b4fe` (purple-300)
- Border: 1px solid `rgba(216, 180, 254, 0.4)` (purple-100/40)
- Border radius: 16px
- Padding: 20px
- Shadow: `lg` (large shadow)
- Min height: 132px

**Content**:
- Label: "Punteggio medio" (top left, font-size: 14px, color: #374151)
- Value: `kpi.average` (bottom right, font-size: 48px, font-weight: 800, color: #1f1147)
- Subtitle: `${kpi.weeksPlayed} giornate giocate` (below value, font-size: 12px, color: gray-500)

**Loading State**: Show "—" with pulse animation

---

### Component 3: Best/Worst Cards (Grid)

**Layout**: 2-column grid with gap of 16px

#### Best Week Card (Left)
**Visual Specifications**:
- Background: Linear gradient from `#e7f8f2` to white (top-left direction)
- Border: 1px solid `rgba(220, 252, 231, 0.5)` (green-100/50)
- Border radius: 16px
- Padding: 16px
- Shadow: `lg`
- Min height: 162px

**Content**:
- Label: "Risultato migliore" (top, font-size: 14px)
- Value: `kpi.best.pct` (bottom right, font-size: 48px, font-weight: 800)
- Subtitle: `giornata ${kpi.best.week}` (below value, font-size: 12px)

#### Worst Week Card (Right)
**Visual Specifications**:
- Background: Linear gradient from `#ffeef2` to white (180deg)
- Border: 1px solid `rgba(255, 237, 213, 0.5)` (orange-100/50)
- Border radius: 16px
- Padding: 16px
- Shadow: `lg`
- Min height: 162px

**Content**:
- Label: "Risultato peggiore" (top, font-size: 14px)
- Value: `kpi.worst.pct` (bottom right, font-size: 48px, font-weight: 800)
- Subtitle: `giornata ${kpi.worst.week}` (below value, font-size: 12px)

---

### Component 4: Share Button

**Visual Specifications**:
- Width: Auto (fit content)
- Padding: Vertical 8px, Horizontal 16px
- Border radius: 8px
- Background: `#4f46e5` (indigo-600)
- Text color: White
- Font size: 14px
- Font weight: 500
- Shadow: Medium
- Margin top: 48px

**Content**:
- Icon: Share icon (iOS share symbol)
- Text: "Condividi profilo"

**Disabled State** (while loading):
- Background: `#e5e7eb` (gray-200)
- Text color: `#6b7280` (gray-500)
- Cursor: Not allowed

---

## 6. KPI Calculations

### Calculation 1: Weeks Played
**Logic**: Count weeks where `totalPredictions > 0`

```typescript
const played = weeklyStats.filter(w => w.totalPredictions > 0);
const weeksPlayed = played.length;
```

**Example**:
```typescript
// Input: weeklyStats with 10 weeks, 8 have predictions
// Output: weeksPlayed = 8
```

---

### Calculation 2: Average Accuracy (Weighted)
**Logic**: Calculate total correct / total predictions across ALL played weeks

**Why Weighted?**
- More accurate than simple average of weekly percentages
- Week with 10 predictions weighs more than week with 5 predictions
- Matches how users perceive their overall performance

```typescript
const totals = played.reduce(
  (acc, w) => {
    acc.finished += w.totalPredictions;
    acc.correct += w.correctPredictions;
    return acc;
  },
  { finished: 0, correct: 0 }
);

const avg = totals.finished > 0
  ? (totals.correct / totals.finished) * 100
  : 0;
```

**Example**:
```typescript
// Week 1: 7/10 = 70%
// Week 2: 5/10 = 50%
// Simple average: (70 + 50) / 2 = 60%
// Weighted average: (7 + 5) / (10 + 10) = 12/20 = 60%
// (Same in this case, but differs when weeks have different prediction counts)
```

---

### Calculation 3: Best Week
**Logic**: Find week with highest accuracy, with tie-breaking rules

**Sort Priority**:
1. Highest `accuracy` percentage
2. If tied: Most `correctPredictions`
3. If still tied: Earliest `week` number

```typescript
const cmpBest = (a, b) => {
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;  // Higher accuracy wins
  const bc = b.correctPredictions - a.correctPredictions;
  if (bc !== 0) return bc;  // More correct wins
  return a.week - b.week;   // Earlier week wins
};

const best = [...played].sort(cmpBest)[0];
```

**Example**:
```typescript
// Week 1: 80% (8/10)
// Week 3: 80% (8/10)
// Week 5: 90% (9/10) ← BEST (highest accuracy)
// Result: { pct: "90,0%", week: 5 }
```

---

### Calculation 4: Worst Week
**Logic**: Find week with lowest accuracy, with tie-breaking rules

**Sort Priority**:
1. Lowest `accuracy` percentage
2. If tied: Fewest `correctPredictions`
3. If still tied: Earliest `week` number

```typescript
const cmpWorst = (a, b) => {
  if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;  // Lower accuracy wins
  const bc = a.correctPredictions - b.correctPredictions;
  if (bc !== 0) return bc;  // Fewer correct wins
  return a.week - b.week;   // Earlier week wins
};

const worst = [...played].sort(cmpWorst)[0];
```

**Example**:
```typescript
// Week 1: 50% (5/10)
// Week 2: 40% (4/10) ← WORST (lowest accuracy)
// Week 4: 60% (6/10)
// Result: { pct: "40,0%", week: 2 }
```

---

### Formatting: Italian Locale

**Logic**: Format percentages with Italian decimal separator (comma)

```typescript
const fmtPct = (n: number) =>
  `${n.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`;
```

**Examples**:
```typescript
fmtPct(65.5)   // "65,5%"
fmtPct(70.0)   // "70%"
fmtPct(33.333) // "33,3%"
```

---

## 7. Share Functionality

### Purpose
Allow users to share their profile statistics via native mobile share API

### Share Content

**Title**: `"Swipick"`

**Text**:
```
Il mio punteggio medio su Swipick è {average}% su {weeksPlayed} giornate,
il mio risultato migliore è {best.pct}%. Sai fare meglio?
```

**URL**: App website or deep link to app

**Example Text**:
```
Il mio punteggio medio su Swipick è 65,5% su 8 giornate,
il mio risultato migliore è 80,0%. Sai fare meglio?
```

### React Native Implementation

```typescript
import { Share } from 'react-native';

const onShare = async () => {
  try {
    const title = 'Swipick';
    const message = `Il mio punteggio medio su Swipick è ${kpi.average}% su ${kpi.weeksPlayed} giornate, il mio risultato migliore è ${kpi.best.pct}%. Sai fare meglio?`;
    const url = 'https://swipick.com'; // Or app deep link

    await Share.share({
      title: title,
      message: `${message}\n${url}`,
    });
  } catch (error) {
    console.error('Share failed:', error);
  }
};
```

### Web Fallback (if needed)

```typescript
// Check if native share is available
if (navigator.share) {
  await navigator.share({ title, text, url });
} else if (navigator.clipboard) {
  // Fallback: Copy to clipboard
  await navigator.clipboard.writeText(`${text}\n${url}`);
  alert('Link copiato negli appunti');
} else {
  // Last resort: Alert with text
  alert(text);
}
```

---

## 8. Implementation Checklist

### Data Fetching
- [ ] Implement Firebase Authentication context
- [ ] Create API call to `GET /api/users/profile/firebase/:firebaseUid`
- [ ] Create API call to `GET /api/predictions/user/:userId/summary?mode=live`
- [ ] Create API call to `GET /api/users/:userId/avatar`
- [ ] Handle authentication check (redirect to login if not authenticated)
- [ ] Implement error handling for failed API calls
- [ ] Handle 404 responses (no predictions, no avatar)

### Data Transformation
- [ ] Implement `normalizeSummary()` function to handle snake_case → camelCase
- [ ] Handle response with/without `{ data: ... }` wrapper
- [ ] Extract firstName from full name (split on whitespace, take first part)
- [ ] Fallback to email local part if no name available

### State Management
- [ ] Create state for all user info (userId, displayName, nickname, email, avatarUrl)
- [ ] Create state for summary data
- [ ] Create state for loading and error
- [ ] Implement `useMemo` for KPI calculations
- [ ] Ensure state updates trigger re-renders

### KPI Calculations
- [ ] Filter played weeks (totalPredictions > 0)
- [ ] Calculate weighted average accuracy
- [ ] Find best week (sort by accuracy desc, correctPredictions desc, week asc)
- [ ] Find worst week (sort by accuracy asc, correctPredictions asc, week asc)
- [ ] Format percentages in Italian locale (comma as decimal separator)

### UI Components
- [ ] Implement gradient header with purple colors
- [ ] Create avatar component (image or initial fallback)
- [ ] Add settings button (gear icon) to header
- [ ] Create average card with gradient background
- [ ] Create best/worst week cards in 2-column grid
- [ ] Add share button with icon
- [ ] Implement loading states (pulse animation, "—" placeholders)
- [ ] Implement error display

### Navigation
- [ ] Add navigation to `/impostazioni` from settings button
- [ ] Integrate with bottom navigation bar
- [ ] Handle back navigation
- [ ] Deep link support (if needed)

### Share Functionality
- [ ] Implement React Native Share API
- [ ] Format share message with user statistics
- [ ] Add app URL or deep link
- [ ] Handle share errors gracefully

### Polish
- [ ] Test with empty data (new user with no predictions)
- [ ] Test with partial data (some weeks played, some not)
- [ ] Test avatar loading (Google URL, uploaded image, fallback to initial)
- [ ] Test Italian locale formatting (comma vs period)
- [ ] Test on iOS and Android
- [ ] Verify gradient colors match design
- [ ] Check card shadows and borders

---

## API Response Examples

### Example 1: Successful User Load
```json
{
  "success": true,
  "data": {
    "id": "user-uuid-123",
    "firebaseUid": "EiT1a0OEybNqNPcABMiaku7Eaf02",
    "email": "john@example.com",
    "nome": "John Doe",
    "sopranome": "johndoe",
    "googleProfileUrl": "https://lh3.googleusercontent.com/a/...",
    "needsProfileCompletion": false,
    "createdAt": "2025-09-01T10:00:00Z",
    "updatedAt": "2025-10-26T18:00:00Z"
  }
}
```

### Example 2: Successful Summary Load
```json
{
  "success": true,
  "data": {
    "user_id": "EiT1a0OEybNqNPcABMiaku7Eaf02",
    "total_predictions": 80,
    "correct_predictions": 52,
    "overall_success_rate": 65.0,
    "weekly_stats": [
      {
        "week": 1,
        "total_predictions": 10,
        "correct_predictions": 7,
        "success_rate": 70.0,
        "points": 7
      },
      {
        "week": 2,
        "total_predictions": 10,
        "correct_predictions": 5,
        "success_rate": 50.0,
        "points": 5
      }
    ]
  }
}
```

### Example 3: New User (No Predictions)
```json
{
  "success": false,
  "message": "No predictions found for user"
}
```
*Handle gracefully: Show 0% average, 0 weeks played*

### Example 4: Avatar Response
```json
{
  "success": true,
  "data": {
    "mimeType": "image/jpeg",
    "base64": "iVBORw0KGgoAAAANSUhEUgAA..."
  }
}
```

---

## Connection to Impostazioni Page

The Profilo page connects to the Impostazioni (Settings) page through:

1. **Settings Button**: Gear icon in top right of header
   ```typescript
   onPress={() => navigation.navigate('Impostazioni')}
   ```

2. **Shared User Data**: Both pages use the same user ID and Firebase UID
   - Profilo: Read-only display
   - Impostazioni: Editable settings

3. **Avatar Updates**: When user uploads new avatar in Impostazioni, it should reflect in Profilo
   - Implement refresh on focus/navigation back
   - Or use shared state/context

See [REACT_NATIVE_IMPOSTAZIONI_PAGE.md](REACT_NATIVE_IMPOSTAZIONI_PAGE.md) for Impostazioni implementation details.
