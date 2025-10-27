# Impostazioni (Settings) Page Implementation Guide for React Native

## Overview
The **Impostazioni** (Settings) page allows users to manage their account settings, notification preferences, and avatar. This page provides access to account information, avatar upload, notification toggles, and account deletion.

---

## Table of Contents
1. [Page Purpose](#page-purpose)
2. [Complete API Endpoints](#complete-api-endpoints)
3. [Data Flow Architecture](#data-flow-architecture)
4. [State Management](#state-management)
5. [UI Components Breakdown](#ui-components-breakdown)
6. [Notification Preferences](#notification-preferences)
7. [Avatar Upload](#avatar-upload)
8. [Account Deletion](#account-deletion)
9. [Implementation Checklist](#implementation-checklist)

---

## 1. Page Purpose

The Impostazioni page serves as the **user settings dashboard**:
- **Display account info**: Email, username (read-only)
- **Manage avatar**: Upload or change profile picture
- **Control notifications**: Toggle preferences for different notification types
- **Delete account**: Permanently remove user account and data

### Key Features:
- Read-only account information display
- Avatar upload with image validation
- Real-time notification preference updates (optimistic UI)
- Destructive account deletion with confirmation modal
- Toast notifications for user feedback

---

## 2. Complete API Endpoints

### Endpoint 1: Get User by Firebase UID
**Purpose**: Resolve backend user ID and load basic account info

```
GET /api/users/profile/firebase/:firebaseUid
```

**Parameters**:
- `firebaseUid`: Firebase authentication UID (string)

**Response Structure**:
```typescript
{
  "success": true,
  "data": {
    "id": "backend-user-uuid",           // Backend user ID
    "firebaseUid": "EiT1a0OEybNqNPcABMiaku7Eaf02",
    "email": "user@example.com",
    "nickname": "johndoe",               // Can be null
    "nome": "John Doe",
    "googleProfileUrl": "https://..."
  }
}
```

---

### Endpoint 2: Get User Preferences
**Purpose**: Load user's notification preferences

```
GET /api/users/:userId/preferences
```

**Parameters**:
- `userId`: Backend user ID (UUID string)

**Request Example**:
```typescript
const response = await fetch(
  `${apiUrl}/users/backend-user-uuid/preferences`
);
const data = await response.json();
```

**Response Structure**:
```typescript
{
  "success": true,
  "data": {
    "results": true,      // Notification for weekly results
    "matches": true,      // Notification at 90th minute (disabled in UI for now)
    "goals": true         // Notification for goals (disabled in UI for now)
  }
}
```

**Default Values** (if no preferences set):
```json
{
  "results": true,
  "matches": true,
  "goals": true
}
```

---

### Endpoint 3: Update User Preferences
**Purpose**: Save user's notification preference changes

```
PATCH /api/users/:userId/preferences
```

**Parameters**:
- `userId`: Backend user ID (UUID string)

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```typescript
{
  "results"?: boolean,   // Optional: Update results notification
  "matches"?: boolean,   // Optional: Update matches notification
  "goals"?: boolean      // Optional: Update goals notification
}
```

**Example Request**:
```typescript
await fetch(`${apiUrl}/users/backend-user-uuid/preferences`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    results: false  // Disable results notification
  })
});
```

**Response**:
```typescript
{
  "success": true,
  "message": "Preferences updated successfully"
}
```

**Note**: Partial updates are supported - only send fields you want to change

---

### Endpoint 4: Upload Avatar (Multipart)
**Purpose**: Upload user's profile picture to Neon database

```
POST /api/users/:userId/avatar/upload
```

**Parameters**:
- `userId`: Backend user ID (UUID string)

**Request Type**: `multipart/form-data`

**Request Body**:
```typescript
FormData with:
  - file: Image file (JPEG, PNG, or WebP)
```

**Example Request**:
```typescript
const formData = new FormData();
formData.append('file', {
  uri: imageUri,
  type: 'image/jpeg',
  name: 'avatar.jpg'
});

await fetch(`${apiUrl}/users/backend-user-uuid/avatar/upload`, {
  method: 'POST',
  body: formData
});
```

**Response**:
```typescript
{
  "success": true,
  "message": "Avatar uploaded successfully"
}
```

**Validation Rules**:
- **Supported formats**: JPEG, PNG, WebP
- **Max file size**: 5MB
- **Server processing**: Image is sanitized with sharp library
- **Storage**: Base64 encoded in Neon database

**Error Responses**:
```json
// File too large
{
  "success": false,
  "message": "File size exceeds 5MB limit"
}

// Invalid format
{
  "success": false,
  "message": "Unsupported image format. Use JPEG, PNG, or WebP"
}
```

---

### Endpoint 5: Delete Account
**Purpose**: Permanently delete user account and all associated data

```
DELETE /api/users/:userId
```

**Parameters**:
- `userId`: Backend user ID (UUID string)

**Request Headers**:
```
Authorization: Bearer <firebase_id_token>
```

**Important**: Requires valid Firebase ID token for security

**Request Example**:
```typescript
const token = await user.getIdToken(); // Firebase auth token

await fetch(`${apiUrl}/users/backend-user-uuid`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Response**:
```typescript
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**What Gets Deleted**:
1. User record from `users` table
2. All predictions from `specs` table (via firebase_uid)
3. All final week scores
4. Avatar image
5. User preferences

**Error Responses**:
```json
// Missing or invalid token
{
  "success": false,
  "message": "Authentication required"
}

// Token doesn't match user
{
  "success": false,
  "message": "Unauthorized"
}
```

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
   Returns: { id, email, nickname }
   ↓
5. Set State
   - userId = data.id
   - email = data.email
   - nickname = data.nickname
   ↓
6. API Call #2: getUserPreferences(userId)
   ↓
   Returns: { results, matches, goals }
   ↓
7. Set Notification States
   - notifResults = results
   - notifMatches = matches
   - notifGoals = goals
   ↓
8. Render UI
```

### Preference Update Flow (Optimistic UI)

```
User toggles notification switch
   ↓
1. IMMEDIATELY update local state (optimistic)
   setNotifResults(newValue)
   ↓
2. API Call: PATCH /api/users/:userId/preferences
   body: { results: newValue }
   ↓
3. Wait for response
   ↓
4. Success?
   ├─ YES → Show success toast
   │         "Preferenze aggiornate"
   │         Keep optimistic state
   └─ NO → Rollback state
             Revert to previous value
             Show error alert
```

**Why Optimistic UI?**
- Feels instant and responsive
- Better user experience
- Network latency doesn't block interaction
- Automatic rollback on failure

---

### Avatar Upload Flow

```
User taps "immagine profilo"
   ↓
1. Open image picker (camera or gallery)
   ↓
2. User selects image
   ↓
3. Client-side validation
   ├─ Check MIME type (jpeg/png/webp)
   ├─ Check file size (< 5MB)
   └─ If invalid → Show error, EXIT
   ↓
4. Set uploading = true (show loading)
   ↓
5. Create FormData with image
   ↓
6. API Call: POST /api/users/:userId/avatar/upload
   ↓
7. Wait for response
   ↓
8. Success?
   ├─ YES → Show success toast
   │         "Avatar aggiornato"
   │         Clear file input
   └─ NO → Show error alert
             "Caricamento avatar fallito"
   ↓
9. Set uploading = false
```

---

### Account Deletion Flow

```
User taps "ELIMINA ACCOUNT" button
   ↓
1. Show confirmation modal
   "Sei sicuro di voler eliminare definitivamente il tuo account?"
   ↓
2. User confirms
   ↓
3. Set deleting = true (disable buttons)
   ↓
4. Get Firebase ID token
   token = await user.getIdToken()
   ↓
5. API Call: DELETE /api/users/:userId
   Headers: { Authorization: Bearer <token> }
   ↓
6. Wait for response
   ↓
7. Success?
   ├─ YES → Logout user
   │         Clear local state
   │         Redirect to welcome/login
   └─ NO → Show error alert
             Keep modal open
   ↓
8. Set deleting = false
```

---

## 4. State Management

### Core State Variables

```typescript
// Authentication
const { firebaseUser, getAuthToken, logout } = useAuthContext();

// User Info
const [userId, setUserId] = useState<string | null>(null);       // Backend UUID
const [email, setEmail] = useState<string>('');                  // User email
const [nickname, setNickname] = useState<string>('');            // Username

// Notification Preferences
const [notifResults, setNotifResults] = useState<boolean>(true);
const [notifMatches, setNotifMatches] = useState<boolean>(true); // Disabled in UI
const [notifGoals, setNotifGoals] = useState<boolean>(true);     // Disabled in UI

// UI State
const [loading, setLoading] = useState<boolean>(true);
const [error, setError] = useState<string | null>(null);
const [toast, setToast] = useState<string | null>(null);
const [prossimamenteToast, setProssimamenteToast] = useState<string | null>(null);

// File Upload
const [uploading, setUploading] = useState<boolean>(false);
const fileInputRef = useRef<HTMLInputElement | null>(null);

// Account Deletion
const [deleting, setDeleting] = useState<boolean>(false);
const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
```

---

## 5. UI Components Breakdown

### Layout Structure

```
┌─────────────────────────────────────────┐
│  ┌─────────────────────────────────┐   │
│  │ [←]      Impostazioni      │   │ ← Fixed Header
│  └─────────────────────────────────┘   │
│                                         │
│  Account                                │
│  ──────────────────────────────────── │
│  email                  user@email.com  │
│  username               johndoe      → │
│  password                            → │
│  immagine profilo                    → │
│                                         │
│  Notifiche                              │
│  ──────────────────────────────────── │
│  Risultati                    [Toggle] │
│    Scopri il tuo punteggio...          │
│  Partite (disabled)           [Toggle] │
│    Ti avvisiamo al 90°                 │
│  Gol (disabled)               [Toggle] │
│    Ad ogni marcatura...                │
│                                         │
│  Pericolo                               │
│  ──────────────────────────────────── │
│  [      ELIMINA ACCOUNT      ]         │
│    Questa azione è irreversibile...    │
└─────────────────────────────────────────┘
```

---

### Component 1: Fixed Header

**Visual Specifications**:
- Position: Fixed at top
- Background: White
- Height: 125px
- Border bottom: 1px solid gray-100
- Shadow: Small
- Z-index: 20

**Content**:
1. **Back Button** (left):
   - Icon: Left chevron arrow
   - Action: Navigate back
   - Style: Transparent, hover gray-100

2. **Title** (center):
   - Text: "Impostazioni"
   - Font size: 18px
   - Font weight: Bold (700)

**React Native Implementation**:
```typescript
<View style={styles.header}>
  <TouchableOpacity
    style={styles.backButton}
    onPress={() => navigation.goBack()}
  >
    <Icon name="chevron-left" size={24} color="#000" />
  </TouchableOpacity>
  <Text style={styles.headerTitle}>Impostazioni</Text>
</View>
```

---

### Component 2: Account Section

**Section Header**: "Account" (font-size: 14px, font-weight: 600, color: gray-800)

#### Row 1: Email (Read-Only)
**Layout**: Two-column, no chevron
- Left: "email" (gray-800)
- Right: Email address (gray-500, font-size: 14px)
- Padding: 22px vertical
- No tap action

#### Row 2: Username (Disabled)
**Layout**: Two-column with chevron
- Left: "username" (gray-800)
- Right: Nickname value or "—" (gray-500, font-size: 14px) + chevron
- Padding: 22px vertical
- Opacity: 60% (disabled)
- No tap action (future feature)

#### Row 3: Password (Disabled)
**Layout**: Single column with chevron
- Left: "password" (gray-800)
- Right: Chevron only
- Padding: 22px vertical
- Opacity: 60% (disabled)
- No tap action (future feature)

#### Row 4: Avatar Upload (Active)
**Layout**: Two-column with chevron
- Left: "immagine profilo" (gray-800)
- Right: Loading text (if uploading) + chevron
- Padding: 22px vertical
- Opacity: 60% while uploading (disabled)
- Tap action: Open image picker

**Image Picker Requirements**:
```typescript
import * as ImagePicker from 'react-native-image-picker';

const onPickAvatar = () => {
  ImagePicker.launchImageLibrary({
    mediaType: 'photo',
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.9,
  }, (response) => {
    if (response.assets && response.assets[0]) {
      handleImageUpload(response.assets[0]);
    }
  });
};
```

---

### Component 3: Notification Section

**Section Header**: "Notifiche" (font-size: 14px, font-weight: 600, color: gray-800, margin-top: 24px)

#### Toggle Row Structure
Each row contains:
- **Left side**:
  - Title (font-size: 16px, color: gray-800)
  - Description (font-size: 12px, color: gray-500)
- **Right side**:
  - Toggle switch

#### Row 1: Risultati (Active)
**Title**: "Risultati"
**Description**: "Scopri il tuo punteggio a fine giornata"
**State**: `notifResults`
**Action**: Toggle updates preference immediately (optimistic UI)

**Toggle Switch Visual**:
- Width: 44px (11 * 4)
- Height: 24px (6 * 4)
- Track color OFF: `#e5e7eb` (gray-200)
- Track color ON: `#9333ea` (purple-600)
- Thumb: White circle, 20px diameter
- Thumb position OFF: Left (2px from edge)
- Thumb position ON: Right (2px from edge)
- Animation: 200ms ease

#### Row 2: Partite (Disabled)
**Title**: "Partite"
**Description**: "Ti avvisiamo al 90°"
**State**: Always `false` (disabled)
**Action**: Show toast "prossimamente" (coming soon)
**Opacity**: 50%

#### Row 3: Gol (Disabled)
**Title**: "Gol"
**Description**: "Ad ogni marcatura sarai il primo a saperlo"
**State**: Always `false` (disabled)
**Action**: Show toast "prossimamente" (coming soon)
**Opacity**: 50%

**React Native Toggle Implementation**:
```typescript
import { Switch } from 'react-native';

<Switch
  value={notifResults}
  onValueChange={(value) => optimisticUpdate({ results: value })}
  trackColor={{ false: '#e5e7eb', true: '#9333ea' }}
  thumbColor="#ffffff"
/>
```

---

### Component 4: Delete Account Section

**Section Header**: "Pericolo" (font-size: 14px, font-weight: 600, color: gray-800, margin-top: 20px)

**Button**:
- Text: "ELIMINA ACCOUNT"
- Background: `#dc2626` (red-600)
- Text color: White
- Font weight: 600
- Padding: 12px vertical
- Border radius: 12px
- Shadow: Small
- Letter spacing: Wide (tracking-wide)
- Active scale: 0.99 (press feedback)

**Disclaimer Text** (below button):
- Text: "Questa azione è irreversibile e rimuoverà il tuo account e la tua cronologia."
- Font size: 11px
- Color: gray-500
- Margin top: 8px

**Disabled State** (while deleting):
- Opacity: 60%
- Not tappable

---

### Component 5: Delete Confirmation Modal

**Overlay**:
- Background: `rgba(0, 0, 0, 0.5)` (black with 50% opacity)
- Position: Full screen
- Z-index: 50

**Modal Card**:
- Width: Full screen (mobile) or 420px (tablet)
- Background: White
- Border radius: 16px (top corners on mobile, all corners on tablet)
- Padding: 20px
- Shadow: 2xl (very large)

**Content**:
1. **Title**: "Conferma eliminazione" (font-size: 16px, font-weight: 600, color: gray-900)
2. **Message**: "Sei sicuro di voler eliminare definitivamente il tuo account? Questa azione non può essere annullata." (font-size: 14px, color: gray-600)
3. **Buttons** (horizontal, equal width):
   - **Cancel**: "Annulla" (gray-100 background, gray-900 text)
   - **Confirm**: "Elimina" or "Eliminazione…" (red-600 background, white text, font-weight: 600)

**React Native Implementation**:
```typescript
<Modal
  visible={showDeleteModal}
  transparent={true}
  animationType="fade"
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>Conferma eliminazione</Text>
      <Text style={styles.modalMessage}>
        Sei sicuro di voler eliminare definitivamente il tuo account?
        Questa azione non può essere annullata.
      </Text>
      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => setShowDeleteModal(false)}
          disabled={deleting}
        >
          <Text style={styles.cancelButtonText}>Annulla</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={confirmDelete}
          disabled={deleting}
        >
          <Text style={styles.deleteButtonText}>
            {deleting ? 'Eliminazione…' : 'Elimina'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
```

---

## 6. Notification Preferences

### Optimistic Update Pattern

**Why Optimistic?**
- Instant UI feedback (no waiting for server)
- Better perceived performance
- Automatic rollback on error

**Implementation**:
```typescript
const optimisticUpdate = async (patch: {
  results?: boolean;
  matches?: boolean;
  goals?: boolean;
}) => {
  if (!userId) return;

  // Save previous state for rollback
  const prev = {
    results: notifResults,
    matches: notifMatches,
    goals: notifGoals
  };

  // Apply optimistic state IMMEDIATELY
  if (patch.results !== undefined) setNotifResults(patch.results);
  if (patch.matches !== undefined) setNotifMatches(patch.matches);
  if (patch.goals !== undefined) setNotifGoals(patch.goals);

  try {
    // Send to server
    await apiClient.updateUserPreferences(userId, patch);

    // Success: Show confirmation
    setToast('Preferenze aggiornate');
    setTimeout(() => setToast(null), 1800);
  } catch (error) {
    console.error('Update failed:', error);

    // ROLLBACK on error
    setNotifResults(prev.results);
    setNotifMatches(prev.matches);
    setNotifGoals(prev.goals);

    alert('Impossibile aggiornare le preferenze');
  }
};
```

**Usage**:
```typescript
<Switch
  value={notifResults}
  onValueChange={(value) => optimisticUpdate({ results: value })}
/>
```

---

### Toast Notifications

**Purpose**: Show brief feedback messages

**Types**:
1. **Success Toast**: "Preferenze aggiornate" (after preference update)
2. **Coming Soon Toast**: "prossimamente" (for disabled features)

**Visual Specifications**:
- Position: Bottom center (or top center)
- Background: Black/dark gray with 90% opacity
- Text color: White
- Padding: 12px horizontal, 8px vertical
- Border radius: 8px
- Duration: 1800ms (1.8 seconds)
- Animation: Fade in + Fade out

**React Native Implementation**:
```typescript
import Toast from 'react-native-toast-message';

// Show toast
Toast.show({
  type: 'success',
  text1: 'Preferenze aggiornate',
  position: 'bottom',
  visibilityTime: 1800
});
```

---

## 7. Avatar Upload

### Client-Side Validation

**Step 1: Check MIME Type**
```typescript
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
if (!allowedTypes.includes(file.type)) {
  alert('Formato immagine non supportato. Usa JPEG, PNG o WebP.');
  return;
}
```

**Step 2: Check File Size**
```typescript
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
if (file.size > MAX_SIZE) {
  alert('Immagine troppo grande (max 5MB)');
  return;
}
```

---

### Upload Implementation

```typescript
const onFileChange = async (imageUri: string, imageType: string) => {
  if (!userId) return;

  try {
    setUploading(true);

    // Create FormData
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: imageType,
      name: 'avatar.jpg'
    });

    // Upload
    await apiClient.uploadUserAvatarBytes(userId, formData);

    // Success feedback
    setToast('Avatar aggiornato');
    setTimeout(() => setToast(null), 1800);
  } catch (error) {
    console.error('Avatar upload failed:', error);
    alert('Caricamento avatar fallito');
  } finally {
    setUploading(false);
  }
};
```

---

### Server-Side Processing

**What the server does**:
1. Receives multipart upload
2. Validates MIME type and size
3. Sanitizes image with `sharp` library:
   - Strips metadata (EXIF)
   - Resizes to max 512x512px
   - Converts to JPEG with 85% quality
4. Encodes to base64
5. Stores in Neon `users` table

**Result**: Avatar is safely processed and stored, ready for retrieval

---

## 8. Account Deletion

### Security Requirements

**Firebase ID Token Required**:
- Ensures user is currently authenticated
- Prevents unauthorized deletions
- Token must be fresh (not expired)

**Getting Token**:
```typescript
const token = await firebaseUser.getIdToken(/* forceRefresh */ false);
```

---

### Deletion Implementation

```typescript
const confirmDelete = async () => {
  if (!userId) return;

  try {
    setDeleting(true);

    // Get fresh Firebase ID token
    const token = await getAuthToken();
    if (!token) {
      alert('Autenticazione richiesta per eliminare l\'account');
      return;
    }

    // Delete account
    await apiClient.deleteAccount(userId, token);

    // Logout locally
    await logout();

    // Redirect to welcome/login
    navigation.replace('Welcome');
  } catch (error) {
    console.error('Delete account failed:', error);
    const msg = error instanceof Error ? error.message : 'Eliminazione account fallita';
    alert(msg);
  } finally {
    setDeleting(false);
    setShowDeleteModal(false);
  }
};
```

---

### What Gets Deleted

**Backend cascade deletion**:
1. **users** table: User record
2. **specs** table: All predictions (matched by firebase_uid)
3. **final_week_scores** table: All final scores
4. **user_preferences** table: Notification preferences
5. **Avatar data**: Base64 image (in users.avatar_data)

**Frontend cleanup**:
1. Clear AsyncStorage/SecureStore
2. Clear Firebase auth session
3. Reset all state
4. Navigate to login/welcome

---

## 9. Implementation Checklist

### Data Fetching
- [ ] Implement Firebase Authentication context
- [ ] Create API call to `GET /api/users/profile/firebase/:firebaseUid`
- [ ] Create API call to `GET /api/users/:userId/preferences`
- [ ] Create API call to `PATCH /api/users/:userId/preferences`
- [ ] Create API call to `POST /api/users/:userId/avatar/upload` (multipart)
- [ ] Create API call to `DELETE /api/users/:userId` (with Authorization header)
- [ ] Handle authentication check (redirect to login if not authenticated)
- [ ] Implement error handling for all API calls

### State Management
- [ ] Create state for user info (userId, email, nickname)
- [ ] Create state for notification preferences (notifResults, notifMatches, notifGoals)
- [ ] Create state for UI (loading, error, toast, uploading, deleting, showDeleteModal)
- [ ] Create ref for file input (if using web-style picker)

### UI Components
- [ ] Implement fixed header with back button and title
- [ ] Create account section with 4 rows (email, username, password, avatar)
- [ ] Implement notification section with 3 toggle rows
- [ ] Create delete account section with button and disclaimer
- [ ] Implement delete confirmation modal with overlay
- [ ] Add toast notifications component

### Notification Preferences
- [ ] Implement optimistic update pattern
- [ ] Add previous state storage for rollback
- [ ] Implement toggle switches with correct colors
- [ ] Add success toast on successful update
- [ ] Add error alert with rollback on failure
- [ ] Disable "Partite" and "Gol" toggles (show "prossimamente" toast)

### Avatar Upload
- [ ] Implement image picker (camera + gallery)
- [ ] Add client-side validation (MIME type, file size)
- [ ] Create FormData with image
- [ ] Show loading state while uploading
- [ ] Add success toast on successful upload
- [ ] Add error alert on upload failure
- [ ] Clear file input after upload

### Account Deletion
- [ ] Implement delete button with confirmation modal
- [ ] Add modal open/close state
- [ ] Implement Firebase ID token retrieval
- [ ] Add delete API call with Authorization header
- [ ] Handle success: logout + redirect
- [ ] Handle error: show alert, keep modal open
- [ ] Disable buttons while deleting
- [ ] Show loading text ("Eliminazione…")

### Navigation
- [ ] Add back button functionality
- [ ] Handle navigation from Profilo page (gear icon)
- [ ] Implement redirect to login if not authenticated
- [ ] Handle redirect after account deletion

### Polish
- [ ] Test all API endpoints with valid data
- [ ] Test error scenarios (network failure, 401, 404, 500)
- [ ] Test optimistic UI with slow network
- [ ] Test avatar upload with different image formats
- [ ] Test avatar upload with oversized images
- [ ] Test account deletion with confirmation
- [ ] Verify toast notifications appear and disappear
- [ ] Check disabled states (username, password, matches, goals)
- [ ] Test on iOS and Android
- [ ] Verify modal animations

---

## API Response Examples

### Example 1: Get User Response
```json
{
  "success": true,
  "data": {
    "id": "user-uuid-123",
    "firebaseUid": "EiT1a0OEybNqNPcABMiaku7Eaf02",
    "email": "john@example.com",
    "nickname": "johndoe",
    "nome": "John Doe"
  }
}
```

### Example 2: Get Preferences Response
```json
{
  "success": true,
  "data": {
    "results": true,
    "matches": true,
    "goals": true
  }
}
```

### Example 3: Update Preferences Success
```json
{
  "success": true,
  "message": "Preferences updated successfully"
}
```

### Example 4: Upload Avatar Success
```json
{
  "success": true,
  "message": "Avatar uploaded successfully"
}
```

### Example 5: Delete Account Success
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

### Example 6: Delete Account Error (No Token)
```json
{
  "success": false,
  "message": "Authentication required"
}
```

---

## Connection to Profilo Page

The Impostazioni page is accessed from the Profilo page through:

1. **Settings Button**: Gear icon in Profilo header
   ```typescript
   <TouchableOpacity onPress={() => navigation.navigate('Impostazioni')}>
     <Icon name="settings" />
   </TouchableOpacity>
   ```

2. **Shared User Data**: Both pages use the same user ID and Firebase UID
   - Profilo: Display user info and stats (read-only)
   - Impostazioni: Edit settings and preferences

3. **Avatar Updates**: Changes made in Impostazioni should reflect in Profilo
   - Implement navigation listener to refresh Profilo on return
   - Or use shared state/context for real-time updates

**Navigation Example**:
```typescript
// In Profilo page
<TouchableOpacity onPress={() => navigation.navigate('Impostazioni')}>
  <Icon name="settings" />
</TouchableOpacity>

// In Impostazioni page
<TouchableOpacity onPress={() => navigation.goBack()}>
  <Icon name="chevron-left" />
</TouchableOpacity>

// Refresh Profilo when returning
useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    loadData(); // Reload profile data
  });
  return unsubscribe;
}, [navigation]);
```

See [REACT_NATIVE_PROFILO_PAGE.md](REACT_NATIVE_PROFILO_PAGE.md) for Profilo implementation details.
