export declare class CreateUserDto {
    email: string;
    displayName?: string;
    preferences?: Record<string, any>;
}
export declare class UpdateUserDto {
    displayName?: string;
    preferences?: Record<string, any>;
}
export declare class UserResponseDto {
    id: string;
    email: string;
    displayName?: string;
    createdAt: Date;
    updatedAt: Date;
}
