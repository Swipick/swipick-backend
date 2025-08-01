export interface IAuthUser {
    id: string;
    email: string;
    displayName?: string;
    firebaseUid: string;
}
export interface ITokenPayload {
    sub: string;
    email: string;
    iat: number;
    exp: number;
}
export interface IAuthService {
    verifyToken(token: string): Promise<IAuthUser>;
    validateUser(payload: ITokenPayload): Promise<IAuthUser>;
}
