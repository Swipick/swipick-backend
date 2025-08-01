import { ConfigService } from '@nestjs/config';
import { IAuthUser, IAuthService } from '@swipick/common';
export declare class AuthService implements IAuthService {
    private configService;
    constructor(configService: ConfigService);
    verifyToken(token: string): Promise<IAuthUser>;
    validateUser(payload: any): Promise<IAuthUser>;
}
