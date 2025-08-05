import { UsersService } from './users.service';
import { CreateUserDto, GoogleSyncUserDto, CompleteProfileDto, UserResponseDto } from './dto';
export declare class UsersController {
    private readonly usersService;
    private readonly logger;
    constructor(usersService: UsersService);
    register(createUserDto: CreateUserDto): Promise<{
        success: boolean;
        data: UserResponseDto;
        message: string;
    }>;
    syncGoogle(googleSyncDto: GoogleSyncUserDto): Promise<{
        success: boolean;
        data: UserResponseDto;
        message: string;
    }>;
    completeProfile(userId: string, completeProfileDto: CompleteProfileDto): Promise<{
        success: boolean;
        data: UserResponseDto;
        message: string;
    }>;
    getUserProfile(userId: string): Promise<{
        success: boolean;
        data: UserResponseDto;
    }>;
    getUserProfileByFirebaseUid(firebaseUid: string): Promise<{
        success: boolean;
        data: UserResponseDto;
    }>;
    health(): Promise<{
        status: string;
        timestamp: string;
        service: string;
    }>;
}
