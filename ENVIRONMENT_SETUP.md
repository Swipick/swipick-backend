# Environment Variables Setup Guide

## Required Environment Variables for Dual User Creation

Add these variables to your `.env` file in the root directory:

### Database Configuration (Neon PostgreSQL)

```bash
# Extract from your existing DATABASE_URL if needed
NEON_DB_HOST=ep-lingering-math-a2q9fal5-pooler.eu-central-1.aws.neon.tech
NEON_DB_PORT=5432
NEON_DB_USERNAME=neondb_owner
NEON_DB_PASSWORD=npg_jsN3doJKHDh8
NEON_DB_NAME=neondb
```

### Firebase Admin SDK Configuration

```bash
# Replace these with your actual Firebase project credentials
FIREBASE_PROJECT_ID=your-actual-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

### Security Configuration

```bash
JWT_SECRET=your-super-secure-jwt-secret-key-here
BCRYPT_ROUNDS=12
```

## How to Get Firebase Admin SDK Credentials

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project** (swipick project)
3. **Go to Project Settings** (gear icon)
4. **Service Accounts tab**
5. **Click "Generate new private key"**
6. **Download the JSON file**
7. **Extract the values:**
   - `project_id` → FIREBASE_PROJECT_ID
   - `private_key` → FIREBASE_PRIVATE_KEY (keep the \n characters)
   - `client_email` → FIREBASE_CLIENT_EMAIL

## Database URL Parsing

Your current DATABASE_URL can be parsed into individual components:

```
postgresql://neondb_owner:npg_jsN3doJKHDh8@ep-lingering-math-a2q9fal5-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

Becomes:

- HOST: ep-lingering-math-a2q9fal5-pooler.eu-central-1.aws.neon.tech
- USERNAME: neondb_owner
- PASSWORD: npg_jsN3doJKHDh8
- DATABASE: neondb
- PORT: 5432 (default)
