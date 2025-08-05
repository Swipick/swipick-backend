import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
export interface FirebaseConfig {
    projectId: string;
    privateKey: string;
    clientEmail: string;
}
export declare class FirebaseConfigService {
    private configService;
    private readonly logger;
    private firebaseApp;
    constructor(configService: ConfigService);
    private initializeFirebase;
    getAuth(): admin.auth.Auth | null;
    getApp(): admin.app.App | null;
    verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken>;
    createUser(email: string, password: string, displayName: string): Promise<admin.auth.UserRecord>;
    getUserByUid(uid: string): Promise<admin.auth.UserRecord>;
    updateUserDisplayName(uid: string, displayName: string): Promise<admin.auth.UserRecord>;
    deleteUser(uid: string): Promise<void>;
}
