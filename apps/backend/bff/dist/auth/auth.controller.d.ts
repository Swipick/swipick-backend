import { AuthService } from './auth.service';
import { VerifyTokenDto } from '@swipick/common';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    verifyToken(verifyTokenDto: VerifyTokenDto): Promise<{
        success: boolean;
        user: import("@swipick/common").IAuthUser;
    }>;
    verifyFromHeader(authorization: string): Promise<{
        success: boolean;
        user: import("@swipick/common").IAuthUser;
    }>;
}
