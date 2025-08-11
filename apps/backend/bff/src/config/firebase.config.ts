import { Injectable, Logger, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

@Injectable()
export class FirebaseConfigService {
  private readonly logger = new Logger(FirebaseConfigService.name);
  private firebaseApp!: admin.app.App | null; // Use definite assignment assertion
  private static isInitializing = false; // Static flag to prevent race conditions
  private static isInitialized = false; // Static flag to track initialization status

  constructor(private configService: ConfigService) {
    this.firebaseApp = null; // Initialize explicitly
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      // Check if already initialized or currently initializing
      if (
        FirebaseConfigService.isInitialized ||
        FirebaseConfigService.isInitializing
      ) {
        if (admin.apps.length > 0) {
          this.firebaseApp = admin.apps[0];
          this.logger.log(
            'Firebase Admin SDK already initialized, using existing app',
          );
        } else {
          this.firebaseApp = null;
          this.logger.log('Firebase initialization in progress, waiting...');
        }
        return;
      }

      // Set the initializing flag
      FirebaseConfigService.isInitializing = true;

      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const privateKeyRaw = this.configService.get<string>(
        'FIREBASE_PRIVATE_KEY',
      );
      const clientEmail = this.configService.get<string>(
        'FIREBASE_CLIENT_EMAIL',
      );

      // Validate required config early
      if (!projectId || !privateKeyRaw || !clientEmail) {
        this.logger.warn(
          'Firebase configuration missing. Running in development mode without Firebase Admin SDK.',
        );
        this.firebaseApp = null;
        FirebaseConfigService.isInitializing = false;
        return;
      }

      // Double-check if Firebase app already exists (race condition protection)
      if (admin.apps.length > 0) {
        this.firebaseApp = admin.apps[0]; // Get the first (default) app
        this.logger.log(
          'Firebase Admin SDK already initialized during race condition, using existing app',
        );
        FirebaseConfigService.isInitializing = false;
        FirebaseConfigService.isInitialized = true;
        return;
      }

      // Now we know privateKeyRaw is not null/undefined
      const config: FirebaseConfig = {
        projectId,
        privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
        clientEmail,
      };

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.projectId,
          privateKey: config.privateKey,
          clientEmail: config.clientEmail,
        }),
        projectId: config.projectId,
      });

      // Mark as successfully initialized
      FirebaseConfigService.isInitialized = true;
      FirebaseConfigService.isInitializing = false;

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      FirebaseConfigService.isInitializing = false;
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
      this.logger.warn(
        'Continuing without Firebase Admin SDK. Some features may not work.',
      );
    }
  }

  getAuth(): admin.auth.Auth | null {
    if (!this.firebaseApp) {
      this.logger.warn(
        'Firebase Admin SDK not initialized. Cannot access Auth service.',
      );
      return null;
    }
    return this.firebaseApp.auth();
  }

  getApp(): admin.app.App | null {
    if (!this.firebaseApp) {
      this.logger.warn(
        'Firebase Admin SDK not initialized. Cannot access App instance.',
      );
      return null;
    }
    return this.firebaseApp;
  }

  /**
   * Verify Firebase ID token and return decoded token
   */
  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    try {
      const auth = this.getAuth();
      if (!auth) {
        throw new Error('Firebase Admin SDK non inizializzato');
      }

      const decodedToken = await auth.verifyIdToken(idToken);
      this.logger.debug(
        `Token verified successfully for user: ${decodedToken.uid}`,
      );
      return decodedToken;
    } catch (error) {
      this.logger.error('Failed to verify Firebase ID token', error);
      throw new Error('Token di autenticazione non valido');
    }
  }

  /**
   * Create a new Firebase user (for traditional registration)
   */
  async createUser(
    email: string,
    password: string,
    displayName: string,
  ): Promise<admin.auth.UserRecord> {
    try {
      const auth = this.getAuth();
      if (!auth) {
        throw new Error('Firebase Admin SDK non inizializzato');
      }

      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: false,
      });

      this.logger.log(`Firebase user created: ${userRecord.uid}`);
      return userRecord;
    } catch (error) {
      this.logger.error('Failed to create Firebase user', error);
      throw new Error("Errore durante la creazione dell'utente");
    }
  }

  /**
   * Get Firebase user by UID
   */
  async getUserByUid(uid: string): Promise<admin.auth.UserRecord> {
    try {
      const auth = this.getAuth();
      if (!auth) {
        throw new Error('Firebase Admin SDK non inizializzato');
      }

      return await auth.getUser(uid);
    } catch (error) {
      this.logger.error(`Failed to get Firebase user: ${uid}`, error);
      throw new Error('Utente non trovato');
    }
  }

  /**
   * Update Firebase user display name
   */
  async updateUserDisplayName(
    uid: string,
    displayName: string,
  ): Promise<admin.auth.UserRecord> {
    try {
      const auth = this.getAuth();
      if (!auth) {
        throw new Error('Firebase Admin SDK non inizializzato');
      }

      return await auth.updateUser(uid, { displayName });
    } catch (error) {
      this.logger.error(
        `Failed to update Firebase user display name: ${uid}`,
        error,
      );
      throw new Error("Errore durante l'aggiornamento del profilo");
    }
  }

  /**
   * Delete Firebase user
   */
  async deleteUser(uid: string): Promise<void> {
    try {
      const auth = this.getAuth();
      if (!auth) {
        throw new Error('Firebase Admin SDK non inizializzato');
      }

      await auth.deleteUser(uid);
      this.logger.log(`Firebase user deleted: ${uid}`);
    } catch (error) {
      this.logger.error(`Failed to delete Firebase user: ${uid}`, error);
      throw new Error("Errore durante l'eliminazione dell'utente");
    }
  }

  /**
   * Generate email verification link for a user
   * Note: This generates a link but doesn't send the email automatically
   */
  async generateEmailVerificationLink(email: string): Promise<string> {
    try {
      const auth = this.getAuth();
      if (!auth) {
        throw new Error('Firebase Admin SDK non inizializzato');
      }

      const actionCodeSettings = {
        url: `${this.configService.get<string>('FRONTEND_URL', 'https://frontend-service-production.up.railway.app')}/login?verified=true`,
        handleCodeInApp: false,
      };

      const link = await auth.generateEmailVerificationLink(
        email,
        actionCodeSettings,
      );
      this.logger.log(`Email verification link generated for: ${email}`);
      return link;
    } catch (error) {
      this.logger.error('Failed to generate email verification link', error);
      throw new Error('Errore durante la generazione del link di verifica');
    }
  }

  /**
   * Note: Password reset emails must be sent from client-side Firebase Auth
   * This is a Firebase security requirement - password reset links can only be generated client-side
   * Use sendPasswordResetEmail() from firebase/auth on the frontend
   */
}

@Global()
@Module({
  providers: [FirebaseConfigService],
  exports: [FirebaseConfigService],
})
export class FirebaseModule {}
