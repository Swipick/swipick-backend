export declare enum AuthProvider {
    EMAIL = "email",
    GOOGLE = "google"
}
export declare class User {
    id: string;
    firebaseUid: string;
    email: string;
    name: string;
    nickname: string | null;
    passwordHash: string | null;
    authProvider: AuthProvider;
    googleProfileUrl: string | null;
    isActive: boolean;
    emailVerified: boolean;
    profileCompleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    isGoogleUser(): boolean;
    isEmailUser(): boolean;
    needsProfileCompletion(): boolean;
    getDisplayName(): string;
}
