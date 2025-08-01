export declare class LoginDto {
    email: string;
    password: string;
}
export declare class VerifyTokenDto {
    token: string;
}
export declare class AuthResponseDto {
    token: string;
    user: {
        id: string;
        email: string;
        displayName?: string;
    };
}
