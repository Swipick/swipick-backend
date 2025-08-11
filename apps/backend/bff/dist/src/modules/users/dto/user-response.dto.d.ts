import { AuthProvider } from '../../../entities/user.entity';
export declare class UserResponseDto {
    id: string;
    firebaseUid: string;
    email: string;
    name: string;
    nickname: string | null;
    authProvider: AuthProvider;
    googleProfileUrl?: string | null;
    isActive: boolean;
    emailVerified: boolean;
    profileCompleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    passwordHash?: string | null;
    get displayName(): string;
    get needsProfileCompletion(): boolean;
}
