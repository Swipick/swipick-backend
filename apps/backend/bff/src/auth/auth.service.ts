import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IAuthUser, IAuthService } from '@swipick/common';

@Injectable()
export class AuthService implements IAuthService {
  // private firebaseApp!: admin.app.App;

  constructor(private configService: ConfigService) {
    // this.initializeFirebase();
  }

  // private initializeFirebase() {
  //   const privateKey = this.configService
  //     .get<string>('FIREBASE_PRIVATE_KEY')
  //     ?.replace(/\\n/g, '\n');

  //   this.firebaseApp = admin.initializeApp({
  //     credential: admin.credential.cert({
  //       projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
  //       privateKey,
  //       clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
  //     }),
  //   });
  // }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async verifyToken(_token: string): Promise<IAuthUser> {
    // try {
    //   const decodedToken = await admin.auth().verifyIdToken(token);

    //   return {
    //     id: decodedToken.uid,
    //     email: decodedToken.email || '',
    //     displayName: decodedToken.name,
    //     firebaseUid: decodedToken.uid,
    //   };
    // } catch {
    //   throw new UnauthorizedException('Invalid token');
    // }
    return {
      id: 'mock-user-id',
      email: 'mock-user@example.com',
      displayName: 'Mock User',
      firebaseUid: 'mock-user-id',
    };
  }

  async validateUser(payload: any): Promise<IAuthUser> {
    // This would typically involve database lookup
    // For now, we'll return the payload as user data
    return {
      id: payload.sub,
      email: payload.email,
      displayName: payload.name,
      firebaseUid: payload.sub,
    };
  }
}
