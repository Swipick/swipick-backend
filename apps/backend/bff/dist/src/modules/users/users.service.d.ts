import { Repository, DataSource } from 'typeorm';
import { User } from '../../entities/user.entity';
import { FirebaseConfigService } from '../../config/firebase.config';
import { CreateUserDto, GoogleSyncUserDto, CompleteProfileDto, UserResponseDto } from './dto';
export interface GoogleUserData {
    uid: string;
    email: string;
    name: string;
    picture?: string;
    emailVerified: boolean;
}
export declare class UsersService {
    private userRepository;
    private dataSource;
    private firebaseConfig;
    private readonly logger;
    private readonly saltRounds;
    constructor(userRepository: Repository<User>, dataSource: DataSource, firebaseConfig: FirebaseConfigService);
    createUser(createUserDto: CreateUserDto): Promise<UserResponseDto>;
    syncGoogleUser(googleSyncDto: GoogleSyncUserDto): Promise<UserResponseDto>;
    completeProfile(userId: string, completeProfileDto: CompleteProfileDto): Promise<UserResponseDto>;
    getUserById(id: string): Promise<UserResponseDto>;
    getUserByFirebaseUid(firebaseUid: string): Promise<UserResponseDto>;
    private createGoogleUser;
    private extractGoogleUserData;
    private hashPassword;
    private checkEmailUniqueness;
    private checkNicknameUniqueness;
    private transformToResponse;
    sendPasswordReset(email: string): Promise<void>;
    syncPasswordReset(firebaseUid: string, email: string): Promise<void>;
    private handleRegistrationError;
}
