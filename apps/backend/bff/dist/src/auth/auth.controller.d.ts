import { AuthService } from './auth.service';
import { VerifyTokenDto } from '@swipick/common';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    verifyToken(verifyTokenDto: VerifyTokenDto): Promise<{
        success: boolean;
        user: any;
    }>;
    verifyFromHeader(authorization: string): Promise<{
        success: boolean;
        user: any;
    }>;
}
