"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FirebaseConfigService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseModule = exports.FirebaseConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const admin = require("firebase-admin");
let FirebaseConfigService = FirebaseConfigService_1 = class FirebaseConfigService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(FirebaseConfigService_1.name);
        this.firebaseApp = null;
        this.initializeFirebase();
    }
    initializeFirebase() {
        this.logger.log(`🔍 DEBUG: Starting Firebase initialization process`);
        this.logger.log(`🔍 DEBUG: admin.apps.length = ${admin.apps.length}`);
        this.logger.log(`🔍 DEBUG: isInitialized = ${FirebaseConfigService_1.isInitialized}`);
        this.logger.log(`🔍 DEBUG: isInitializing = ${FirebaseConfigService_1.isInitializing}`);
        try {
            if (FirebaseConfigService_1.isInitialized ||
                FirebaseConfigService_1.isInitializing) {
                if (admin.apps.length > 0) {
                    this.firebaseApp = admin.apps[0];
                    this.logger.log('🔍 DEBUG: Firebase Admin SDK already initialized, using existing app');
                }
                else {
                    this.firebaseApp = null;
                    this.logger.log('🔍 DEBUG: Firebase initialization in progress, waiting...');
                }
                return;
            }
            FirebaseConfigService_1.isInitializing = true;
            this.logger.log('🔍 DEBUG: Set isInitializing = true');
            const projectId = this.configService.get('FIREBASE_PROJECT_ID');
            const privateKeyRaw = this.configService.get('FIREBASE_PRIVATE_KEY');
            const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');
            this.logger.log(`🔍 DEBUG: Firebase config - projectId: ${!!projectId}, privateKey: ${!!privateKeyRaw}, clientEmail: ${!!clientEmail}`);
            if (!projectId || !privateKeyRaw || !clientEmail) {
                this.logger.warn('Firebase configuration missing. Running in development mode without Firebase Admin SDK.');
                this.firebaseApp = null;
                FirebaseConfigService_1.isInitializing = false;
                return;
            }
            if (admin.apps.length > 0) {
                this.firebaseApp = admin.apps[0];
                this.logger.log('Firebase Admin SDK already initialized during race condition, using existing app');
                FirebaseConfigService_1.isInitializing = false;
                FirebaseConfigService_1.isInitialized = true;
                return;
            }
            const config = {
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
            FirebaseConfigService_1.isInitialized = true;
            FirebaseConfigService_1.isInitializing = false;
            this.logger.log('Firebase Admin SDK initialized successfully');
        }
        catch (error) {
            FirebaseConfigService_1.isInitializing = false;
            this.logger.error('Failed to initialize Firebase Admin SDK', error);
            this.logger.warn('Continuing without Firebase Admin SDK. Some features may not work.');
        }
    }
    getAuth() {
        if (!this.firebaseApp) {
            this.logger.warn('Firebase Admin SDK not initialized. Cannot access Auth service.');
            return null;
        }
        return this.firebaseApp.auth();
    }
    getApp() {
        if (!this.firebaseApp) {
            this.logger.warn('Firebase Admin SDK not initialized. Cannot access App instance.');
            return null;
        }
        return this.firebaseApp;
    }
    async verifyIdToken(idToken) {
        try {
            const auth = this.getAuth();
            if (!auth) {
                throw new Error('Firebase Admin SDK non inizializzato');
            }
            const decodedToken = await auth.verifyIdToken(idToken);
            this.logger.debug(`Token verified successfully for user: ${decodedToken.uid}`);
            return decodedToken;
        }
        catch (error) {
            this.logger.error('Failed to verify Firebase ID token', error);
            throw new Error('Token di autenticazione non valido');
        }
    }
    async createUser(email, password, displayName) {
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
        }
        catch (error) {
            this.logger.error('Failed to create Firebase user', error);
            throw new Error("Errore durante la creazione dell'utente");
        }
    }
    async getUserByUid(uid) {
        try {
            const auth = this.getAuth();
            if (!auth) {
                throw new Error('Firebase Admin SDK non inizializzato');
            }
            return await auth.getUser(uid);
        }
        catch (error) {
            this.logger.error(`Failed to get Firebase user: ${uid}`, error);
            throw new Error('Utente non trovato');
        }
    }
    async updateUserDisplayName(uid, displayName) {
        try {
            const auth = this.getAuth();
            if (!auth) {
                throw new Error('Firebase Admin SDK non inizializzato');
            }
            return await auth.updateUser(uid, { displayName });
        }
        catch (error) {
            this.logger.error(`Failed to update Firebase user display name: ${uid}`, error);
            throw new Error("Errore durante l'aggiornamento del profilo");
        }
    }
    async deleteUser(uid) {
        try {
            const auth = this.getAuth();
            if (!auth) {
                throw new Error('Firebase Admin SDK non inizializzato');
            }
            await auth.deleteUser(uid);
            this.logger.log(`Firebase user deleted: ${uid}`);
        }
        catch (error) {
            this.logger.error(`Failed to delete Firebase user: ${uid}`, error);
            throw new Error("Errore durante l'eliminazione dell'utente");
        }
    }
    async generateEmailVerificationLink(email) {
        try {
            const auth = this.getAuth();
            if (!auth) {
                throw new Error('Firebase Admin SDK non inizializzato');
            }
            const actionCodeSettings = {
                url: `https://swipick-production.up.railway.app/loginVerified`,
                handleCodeInApp: false,
            };
            const link = await auth.generateEmailVerificationLink(email, actionCodeSettings);
            this.logger.log(`Email verification link generated for: ${email}`);
            return link;
        }
        catch (error) {
            this.logger.error('Failed to generate email verification link', error);
            throw new Error('Errore durante la generazione del link di verifica');
        }
    }
};
exports.FirebaseConfigService = FirebaseConfigService;
FirebaseConfigService.isInitializing = false;
FirebaseConfigService.isInitialized = false;
exports.FirebaseConfigService = FirebaseConfigService = FirebaseConfigService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FirebaseConfigService);
let FirebaseModule = class FirebaseModule {
};
exports.FirebaseModule = FirebaseModule;
exports.FirebaseModule = FirebaseModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [FirebaseConfigService],
        exports: [FirebaseConfigService],
    })
], FirebaseModule);
//# sourceMappingURL=firebase.config.js.map