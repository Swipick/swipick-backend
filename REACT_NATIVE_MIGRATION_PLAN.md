# Swipick React Native Migration Plan

**Version:** 1.0
**Date:** October 19, 2025
**Target Platform:** iOS & Android (React Native with Expo)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Authentication & Authorization](#authentication--authorization)
6. [Swipe Behavior Implementation](#swipe-behavior-implementation)
7. [API Integration](#api-integration)
8. [State Management](#state-management)
9. [Navigation](#navigation)
10. [Styling & Theming](#styling--theming)
11. [Dependencies & Packages](#dependencies--packages)
12. [Migration Phases](#migration-phases)
13. [Testing Strategy](#testing-strategy)
14. [Deployment](#deployment)

---

## Executive Summary

This document outlines the complete migration of the Swipick web application (Next.js) to React Native mobile applications for iOS and Android. The backend API remains unchanged; only the frontend presentation layer will be rebuilt using React Native with Expo.

### Key Objectives
- ✅ Maintain 100% feature parity with web app
- ✅ Reuse backend API infrastructure (no changes needed)
- ✅ Native mobile experience with swipe gestures
- ✅ Firebase authentication using same credentials
- ✅ Offline-first architecture for predictions
- ✅ Push notifications for match results

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│     React Native App (Expo)         │
│  ┌────────────────────────────────┐ │
│  │   Screens (Gioca, Risultati)   │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │   Navigation (React Navigation)│ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │   State (Redux Toolkit/Zustand)│ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │   Services (API, Auth, Cache)  │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
              ↓ HTTP/HTTPS
┌─────────────────────────────────────┐
│     Existing Backend (NestJS)       │
│  - BFF (Port 9000)                  │
│  - Gaming Services (Port 3002)      │
│  - PostgreSQL + Redis               │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│     Firebase Services               │
│  - Authentication                   │
│  - Cloud Messaging (FCM)            │
└─────────────────────────────────────┘
```

---

## Technology Stack

### Core Framework
- **React Native**: 0.74+ (via Expo SDK 51+)
- **Expo**: Managed workflow for easy development
- **TypeScript**: Strong typing for maintainability

### Key Libraries

| Category | Package | Purpose |
|----------|---------|---------|
| **Navigation** | `@react-navigation/native` | Screen navigation |
| | `@react-navigation/stack` | Stack-based navigation |
| | `@react-navigation/bottom-tabs` | Bottom tab navigation |
| **State Management** | `zustand` or `@reduxjs/toolkit` | Global state |
| **Gestures** | `react-native-gesture-handler` | Swipe gestures |
| | `react-native-reanimated` | Smooth animations |
| **Authentication** | `@react-native-firebase/auth` | Firebase auth |
| | `@react-native-firebase/messaging` | Push notifications |
| **Networking** | `axios` | HTTP requests |
| | `@tanstack/react-query` | Data fetching & caching |
| **Storage** | `@react-native-async-storage/async-storage` | Local persistence |
| **UI Components** | `react-native-paper` (optional) | Material Design |
| **Icons** | `@expo/vector-icons` | Icon library |
| **Animations** | `react-native-reanimated` | Complex animations |
| | `lottie-react-native` | Lottie animations |
| **Forms** | `react-hook-form` | Form validation |

---

## Project Structure

```
apps/mobile/swipick-app/
├── app.json                          # Expo configuration
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
│
├── src/
│   ├── screens/                      # Screen components
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   └── WelcomeScreen.tsx
│   │   ├── game/
│   │   │   ├── GiocaScreen.tsx       # Main swipe screen
│   │   │   ├── TestGiocaScreen.tsx   # Test mode
│   │   │   └── ModeSelectionScreen.tsx
│   │   ├── results/
│   │   │   ├── RisultatiScreen.tsx
│   │   │   └── TestRisultatiScreen.tsx
│   │   ├── profile/
│   │   │   ├── ProfiloScreen.tsx
│   │   │   └── ImpostazioniScreen.tsx
│   │   └── onboarding/
│   │       └── WelcomeScreen.tsx
│   │
│   ├── components/                   # Reusable components
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Loading.tsx
│   │   │   └── Toast.tsx
│   │   ├── game/
│   │   │   ├── MatchCard.tsx
│   │   │   ├── SwipeableCard.tsx
│   │   │   ├── PredictionButtons.tsx
│   │   │   ├── GameHeader.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── TeamInfo.tsx
│   │   ├── results/
│   │   │   ├── SuccessMeter.tsx
│   │   │   ├── WeekHeader.tsx
│   │   │   └── MatchResultCard.tsx
│   │   └── profile/
│   │       └── StatsCard.tsx
│   │
│   ├── navigation/                   # Navigation setup
│   │   ├── AppNavigator.tsx          # Main navigator
│   │   ├── AuthNavigator.tsx         # Auth flow
│   │   ├── MainNavigator.tsx         # Authenticated flow
│   │   └── types.ts                  # Navigation types
│   │
│   ├── services/                     # Business logic
│   │   ├── api/
│   │   │   ├── client.ts             # Axios instance
│   │   │   ├── fixtures.ts           # Fixtures API
│   │   │   ├── predictions.ts        # Predictions API
│   │   │   └── user.ts               # User API
│   │   ├── auth/
│   │   │   ├── authService.ts        # Firebase auth wrapper
│   │   │   └── tokenManager.ts       # Token handling
│   │   ├── storage/
│   │   │   ├── AsyncStorageService.ts
│   │   │   └── cacheService.ts
│   │   └── notifications/
│   │       └── notificationService.ts
│   │
│   ├── store/                        # State management
│   │   ├── index.ts                  # Store configuration
│   │   ├── slices/                   # Redux slices (if using Redux)
│   │   │   ├── authSlice.ts
│   │   │   ├── gameSlice.ts
│   │   │   ├── resultsSlice.ts
│   │   │   └── userSlice.ts
│   │   └── stores/                   # Zustand stores (alternative)
│   │       ├── useAuthStore.ts
│   │       ├── useGameStore.ts
│   │       └── useResultsStore.ts
│   │
│   ├── hooks/                        # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useFixtures.ts
│   │   ├── usePredictions.ts
│   │   ├── useSwipe.ts
│   │   └── useLiveWeek.ts
│   │
│   ├── types/                        # TypeScript types
│   │   ├── api.types.ts
│   │   ├── auth.types.ts
│   │   ├── game.types.ts
│   │   ├── fixtures.types.ts
│   │   └── navigation.types.ts
│   │
│   ├── utils/                        # Utility functions
│   │   ├── date.ts
│   │   ├── validation.ts
│   │   ├── formatters.ts
│   │   └── constants.ts
│   │
│   ├── config/                       # Configuration
│   │   ├── firebase.ts
│   │   ├── api.ts
│   │   └── env.ts
│   │
│   ├── theme/                        # Styling
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── index.ts
│   │
│   └── assets/                       # Static assets
│       ├── images/
│       │   ├── team-logos/
│       │   └── icons/
│       ├── fonts/
│       └── animations/
│
├── android/                          # Android native code
├── ios/                              # iOS native code
└── .expo/                            # Expo cache

```

---

## Authentication & Authorization

### Firebase Authentication Setup

#### 1. Firebase Configuration

**File:** `src/config/firebase.ts`

```typescript
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getMessaging, Messaging } from 'firebase/messaging';
import Constants from 'expo-constants';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
  appId: Constants.expoConfig?.extra?.firebaseAppId,
};

// Initialize Firebase
export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);
export const messaging: Messaging = getMessaging(firebaseApp);
```

#### 2. Auth Service

**File:** `src/services/auth/authService.ts`

```typescript
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  User,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EMAIL_KEY = '@swipick:emailForSignIn';

export class AuthService {
  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<User> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await this.saveEmailForSignIn(email);
    return userCredential.user;
  }

  /**
   * Register new user
   */
  async registerWithEmail(email: string, password: string, displayName?: string): Promise<User> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }

    // Send verification email
    if (userCredential.user) {
      await sendEmailVerification(userCredential.user);
    }

    await this.saveEmailForSignIn(email);
    return userCredential.user;
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    await signOut(auth);
    await AsyncStorage.removeItem(EMAIL_KEY);
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return auth.currentUser;
  }

  /**
   * Get ID token for API requests
   */
  async getIdToken(): Promise<string | null> {
    const user = this.getCurrentUser();
    if (!user) return null;
    return await user.getIdToken();
  }

  /**
   * Save email for sign-in (for email link flow if needed)
   */
  private async saveEmailForSignIn(email: string): Promise<void> {
    await AsyncStorage.setItem(EMAIL_KEY, email);
  }

  /**
   * Get saved email
   */
  async getSavedEmailForSignIn(): Promise<string | null> {
    return await AsyncStorage.getItem(EMAIL_KEY);
  }
}

export const authService = new AuthService();
```

#### 3. Auth Context/Store

**Using Zustand (Recommended for simpler state management):**

**File:** `src/store/stores/useAuthStore.ts`

```typescript
import { create } from 'zustand';
import { User } from 'firebase/auth';
import { authService } from '@/services/auth/authService';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null });
      const user = await authService.signInWithEmail(email, password);
      set({ user, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string, displayName?: string) => {
    try {
      set({ loading: true, error: null });
      const user = await authService.registerWithEmail(email, password, displayName);
      set({ user, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  signOut: async () => {
    try {
      set({ loading: true, error: null });
      await authService.signOut();
      set({ user: null, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  resetPassword: async (email: string) => {
    try {
      set({ loading: true, error: null });
      await authService.resetPassword(email);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

#### 4. Auth State Listener

**File:** `src/navigation/AppNavigator.tsx`

```typescript
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useAuthStore } from '@/store/stores/useAuthStore';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { LoadingScreen } from '@/components/common/Loading';

export default function AppNavigator() {
  const { user, loading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
```

---

## Swipe Behavior Implementation

### Card Swipe Component

The swipe functionality is the core interaction for the Gioca screen. We'll use `react-native-gesture-handler` and `react-native-reanimated` for smooth, native-feeling gestures.

**File:** `src/components/game/SwipeableCard.tsx`

```typescript
import React, { useCallback } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3; // 30% of screen width

export type SwipeDirection = 'left' | 'right' | 'up';
export type PredictionChoice = '1' | 'X' | '2' | 'SKIP';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipe: (choice: PredictionChoice) => void;
  enabled?: boolean;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  onSwipe,
  enabled = true,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const handleSwipeComplete = useCallback((choice: PredictionChoice) => {
    onSwipe(choice);
  }, [onSwipe]);

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
    },
    onActive: (event, ctx) => {
      if (!enabled) return;

      translateX.value = ctx.startX + event.translationX;
      translateY.value = ctx.startY + event.translationY;
    },
    onEnd: (event) => {
      if (!enabled) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        return;
      }

      const velocityX = event.velocityX;
      const velocityY = event.velocityY;

      // Determine swipe direction and trigger prediction
      if (Math.abs(translateY.value) > Math.abs(translateX.value)) {
        // Vertical swipe (up for SKIP)
        if (translateY.value < -SWIPE_THRESHOLD || velocityY < -500) {
          // Swipe up - SKIP
          translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 300 });
          runOnJS(handleSwipeComplete)('SKIP');
        } else {
          // Return to center
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
        }
      } else {
        // Horizontal swipe
        if (translateX.value > SWIPE_THRESHOLD || velocityX > 500) {
          // Swipe right - Home win (1)
          translateX.value = withTiming(SCREEN_WIDTH + 100, { duration: 300 });
          runOnJS(handleSwipeComplete)('1');
        } else if (translateX.value < -SWIPE_THRESHOLD || velocityX < -500) {
          // Swipe left - Away win (2)
          translateX.value = withTiming(-SCREEN_WIDTH - 100, { duration: 300 });
          runOnJS(handleSwipeComplete)('2');
        } else {
          // Return to center
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
        }
      }
    },
  });

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-15, 0, 15],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      Math.abs(translateX.value) + Math.abs(translateY.value),
      [0, SWIPE_THRESHOLD],
      [1, 0.8],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotateZ: `${rotation}deg` },
      ],
      opacity,
    };
  });

  // Swipe indicators
  const leftIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolate.CLAMP
    ),
  }));

  const rightIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    ),
  }));

  const upIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolate.CLAMP
    ),
  }));

  return (
    <View style={styles.container}>
      <PanGestureHandler onGestureEvent={gestureHandler} enabled={enabled}>
        <Animated.View style={[styles.card, animatedCardStyle]}>
          {/* Swipe indicators */}
          <Animated.View style={[styles.indicator, styles.leftIndicator, leftIndicatorStyle]}>
            <View style={styles.indicatorLabel}>
              {/* "2" indicator for away win */}
            </View>
          </Animated.View>

          <Animated.View style={[styles.indicator, styles.rightIndicator, rightIndicatorStyle]}>
            <View style={styles.indicatorLabel}>
              {/* "1" indicator for home win */}
            </View>
          </Animated.View>

          <Animated.View style={[styles.indicator, styles.upIndicator, upIndicatorStyle]}>
            <View style={styles.indicatorLabel}>
              {/* "SKIP" indicator */}
            </View>
          </Animated.View>

          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.65,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  indicator: {
    position: 'absolute',
    padding: 12,
    borderRadius: 8,
    zIndex: 10,
  },
  leftIndicator: {
    top: 50,
    left: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.9)', // Red for away
  },
  rightIndicator: {
    top: 50,
    right: 20,
    backgroundColor: 'rgba(52, 199, 89, 0.9)', // Green for home
  },
  upIndicator: {
    top: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 204, 0, 0.9)', // Yellow for skip
  },
  indicatorLabel: {
    // Style for indicator text
  },
});
```

### Prediction Buttons (Alternative to Swipe)

**File:** `src/components/game/PredictionButtons.tsx`

```typescript
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { PredictionChoice } from '@/types/game.types';

interface PredictionButtonsProps {
  onPredict: (choice: PredictionChoice) => void;
  disabled?: boolean;
}

export const PredictionButtons: React.FC<PredictionButtonsProps> = ({
  onPredict,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, styles.button1]}
        onPress={() => onPredict('1')}
        disabled={disabled}
      >
        <Text style={styles.buttonText}>1</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonX]}
        onPress={() => onPredict('X')}
        disabled={disabled}
      >
        <Text style={styles.buttonText}>X</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.button2]}
        onPress={() => onPredict('2')}
        disabled={disabled}
      >
        <Text style={styles.buttonText}>2</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.skipButton]}
        onPress={() => onPredict('SKIP')}
        disabled={disabled}
      >
        <Text style={styles.skipButtonText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 16,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  button1: {
    backgroundColor: '#4CAF50', // Green for home
  },
  buttonX: {
    backgroundColor: '#9E9E9E', // Gray for draw
  },
  button2: {
    backgroundColor: '#F44336', // Red for away
  },
  buttonText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  skipButton: {
    position: 'absolute',
    bottom: -60,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FFC107',
    borderRadius: 20,
  },
  skipButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## API Integration

### API Client Configuration

**File:** `src/services/api/client.ts`

```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { authService } from '@/services/auth/authService';
import Constants from 'expo-constants';

// Get BFF URL from environment
const BFF_URL = Constants.expoConfig?.extra?.bffUrl || 'http://localhost:9000';

class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: `${BFF_URL}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - Add auth token
    this.instance.interceptors.request.use(
      async (config) => {
        const token = await authService.getIdToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - Handle errors
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - sign out
          await authService.signOut();
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.put(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

### API Service Examples

**File:** `src/services/api/predictions.ts`

```typescript
import { apiClient } from './client';
import { PredictionChoice } from '@/types/game.types';

export interface CreatePredictionDto {
  userId: string;
  fixtureId: string;
  choice: PredictionChoice;
  week: number;
  mode: 'live' | 'test';
}

export interface WeeklyStatsResponse {
  week: number;
  total_predictions: number;
  correct_predictions: number;
  success_rate: number;
  predictions: any[];
}

export const predictionsApi = {
  createPrediction: async (data: CreatePredictionDto) => {
    return apiClient.post('/predictions', data);
  },

  getWeeklyStats: async (userId: string, week: number, mode: 'live' | 'test' = 'live') => {
    return apiClient.get<WeeklyStatsResponse>(
      `/predictions/user/${userId}/week/${week}?mode=${mode}`
    );
  },

  getUserSummary: async (userId: string, mode: 'live' | 'test' = 'live') => {
    return apiClient.get(`/predictions/user/${userId}/summary?mode=${mode}`);
  },

  deleteUserPredictions: async (userId: string, mode?: 'live' | 'test') => {
    const modeParam = mode ? `?mode=${mode}` : '';
    return apiClient.delete(`/predictions/user/${userId}${modeParam}`);
  },
};
```

---

## State Management

### Recommended: Zustand (Simpler, lighter than Redux)

**File:** `src/store/stores/useGameStore.ts`

```typescript
import { create } from 'zustand';
import { MatchCard, PredictionChoice } from '@/types/game.types';
import { predictionsApi } from '@/services/api/predictions';

interface GameState {
  // State
  currentWeek: number;
  matches: MatchCard[];
  currentMatchIndex: number;
  loading: boolean;
  error: string | null;
  mode: 'live' | 'test';

  // Actions
  setWeek: (week: number) => void;
  loadMatches: (week: number, mode: 'live' | 'test') => Promise<void>;
  makePrediction: (choice: PredictionChoice, userId: string) => Promise<void>;
  nextMatch: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentWeek: 1,
  matches: [],
  currentMatchIndex: 0,
  loading: false,
  error: null,
  mode: 'live',

  setWeek: (week) => set({ currentWeek: week }),

  loadMatches: async (week, mode) => {
    set({ loading: true, error: null });
    try {
      // Load match cards from API
      const response = await apiClient.get(`/match-cards/week/${week}`);
      set({ matches: response.data, loading: false, currentWeek: week, mode });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  makePrediction: async (choice, userId) => {
    const { matches, currentMatchIndex, currentWeek, mode } = get();
    const currentMatch = matches[currentMatchIndex];

    if (!currentMatch) return;

    set({ loading: true, error: null });
    try {
      await predictionsApi.createPrediction({
        userId,
        fixtureId: currentMatch.fixtureId,
        choice,
        week: currentWeek,
        mode,
      });

      // Move to next match
      get().nextMatch();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  nextMatch: () => {
    const { currentMatchIndex, matches } = get();
    if (currentMatchIndex < matches.length - 1) {
      set({ currentMatchIndex: currentMatchIndex + 1, loading: false });
    }
  },

  resetGame: () => set({
    currentMatchIndex: 0,
    matches: [],
    loading: false,
    error: null,
  }),
}));
```

---

## Navigation

### Navigation Structure

**File:** `src/navigation/MainNavigator.tsx`

```typescript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import GiocaScreen from '@/screens/game/GiocaScreen';
import RisultatiScreen from '@/screens/results/RisultatiScreen';
import ProfiloScreen from '@/screens/profile/ProfiloScreen';

const Tab = createBottomTabNavigator();

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Gioca') {
            iconName = focused ? 'game-controller' : 'game-controller-outline';
          } else if (route.name === 'Risultati') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'Profilo') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName!} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Gioca" component={GiocaScreen} />
      <Tab.Screen name="Risultati" component={RisultatiScreen} />
      <Tab.Screen name="Profilo" component={ProfiloScreen} />
    </Tab.Navigator>
  );
}
```

---

## Styling & Theming

**File:** `src/theme/colors.ts`

```typescript
export const colors = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  background: '#ffffff',
  text: '#1f2937',
  border: '#e5e7eb',

  // Prediction colors
  home: '#4CAF50',
  draw: '#9E9E9E',
  away: '#F44336',
  skip: '#FFC107',
};
```

---

## Dependencies & Packages

### package.json

```json
{
  "name": "swipick-mobile",
  "version": "1.0.0",
  "main": "expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~51.0.0",
    "react": "18.3.1",
    "react-native": "0.74.5",

    "@react-navigation/native": "^6.1.18",
    "@react-navigation/stack": "^6.4.1",
    "@react-navigation/bottom-tabs": "^6.6.1",

    "firebase": "^10.13.0",
    "@react-native-firebase/app": "^20.4.0",
    "@react-native-firebase/auth": "^20.4.0",
    "@react-native-firebase/messaging": "^20.4.0",

    "axios": "^1.7.7",
    "@tanstack/react-query": "^5.56.2",

    "zustand": "^4.5.5",

    "react-native-gesture-handler": "~2.16.1",
    "react-native-reanimated": "~3.10.1",

    "@react-native-async-storage/async-storage": "1.23.1",

    "@expo/vector-icons": "^14.0.2",
    "expo-constants": "~16.0.2",
    "expo-linear-gradient": "~13.0.2",
    "expo-notifications": "~0.28.16",

    "react-hook-form": "^7.53.0",
    "zod": "^3.23.8",
    "@hookform/resolvers": "^3.9.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.2.79",
    "typescript": "~5.3.3"
  }
}
```

---

## Migration Phases

### Phase 1: Project Setup (Week 1)
- [ ] Initialize Expo project
- [ ] Configure TypeScript
- [ ] Setup Firebase (same project as web)
- [ ] Create base folder structure
- [ ] Configure environment variables
- [ ] Setup navigation skeleton

### Phase 2: Authentication (Week 2)
- [ ] Implement auth service
- [ ] Create login/register screens
- [ ] Setup auth state management
- [ ] Implement auth navigator
- [ ] Test Firebase auth flow

### Phase 3: Core Features - Gioca (Week 3-4)
- [ ] Build swipeable card component
- [ ] Create match card UI
- [ ] Implement game state management
- [ ] Connect predictions API
- [ ] Add progress tracking
- [ ] Build completion screen

### Phase 4: Results Screen (Week 5)
- [ ] Create results list view
- [ ] Build success meter component
- [ ] Implement reveal functionality
- [ ] Add week navigation
- [ ] Connect weekly stats API

### Phase 5: Profile & Settings (Week 6)
- [ ] Build profile screen
- [ ] Add settings screen
- [ ] Implement statistics views
- [ ] Add account management

### Phase 6: Polish & Testing (Week 7-8)
- [ ] Add loading states
- [ ] Error handling
- [ ] Offline support
- [ ] Push notifications
- [ ] Performance optimization
- [ ] End-to-end testing

### Phase 7: Deployment (Week 9)
- [ ] iOS App Store submission
- [ ] Android Play Store submission
- [ ] Beta testing via TestFlight/Play Console

---

## Testing Strategy

### Unit Tests
- Use Jest + React Native Testing Library
- Test business logic in services
- Test store actions

### Integration Tests
- Test API integration
- Test auth flows
- Test navigation

### E2E Tests
- Use Detox or Maestro
- Test critical user journeys
- Test on real devices

---

## Deployment

### iOS Deployment
1. Create Apple Developer account ($99/year)
2. Configure app in App Store Connect
3. Generate certificates via EAS
4. Build with `eas build --platform ios`
5. Submit via `eas submit --platform ios`

### Android Deployment
1. Create Google Play Developer account ($25 one-time)
2. Configure app in Play Console
3. Generate signing key via EAS
4. Build with `eas build --platform android`
5. Submit via `eas submit --platform android`

---

## Environment Configuration

### app.json
```json
{
  "expo": {
    "name": "Swipick",
    "slug": "swipick",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.swipick.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.swipick.app"
    },
    "extra": {
      "bffUrl": "https://your-production-bff.com",
      "firebaseApiKey": "YOUR_FIREBASE_API_KEY",
      "firebaseAuthDomain": "YOUR_FIREBASE_AUTH_DOMAIN",
      "firebaseProjectId": "YOUR_FIREBASE_PROJECT_ID",
      "firebaseStorageBucket": "YOUR_FIREBASE_STORAGE_BUCKET",
      "firebaseMessagingSenderId": "YOUR_FIREBASE_MESSAGING_SENDER_ID",
      "firebaseAppId": "YOUR_FIREBASE_APP_ID"
    }
  }
}
```

---

## Next Steps

1. **Review this plan** with the team
2. **Set up development environment** (Expo, Android Studio, Xcode)
3. **Create Firebase project** (or reuse existing)
4. **Initialize Expo project** with TypeScript template
5. **Start Phase 1** (Project Setup)

---

## Support & Resources

- **Expo Documentation**: https://docs.expo.dev
- **React Navigation**: https://reactnavigation.org
- **Firebase React Native**: https://rnfirebase.io
- **React Native Reanimated**: https://docs.swmansion.com/react-native-reanimated

---

**Document Version**: 1.0
**Last Updated**: October 19, 2025
**Author**: Development Team
