import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { FirebaseConfigService } from '../../config/firebase.config';
import { User } from '../../entities/user.entity';

/**
 * Chi sei lo dice il token, non l'URL.
 *
 * Il resto del BFF prende lo userId dal path e si fida: va bene finché le
 * rotte toccano solo i dati di chi chiama. Le leghe no — iscrivono persone,
 * mostrano le classifiche di altri, rimuovono membri — quindi qui l'identità
 * arriva dal token Firebase che il client già allega a ogni richiesta
 * (`services/api/client.ts`, interceptor).
 *
 * Conseguenza voluta sul disegno delle rotte: nessun `userId` nei path.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly firebaseConfig: FirebaseConfigService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const header = request.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Token di accesso mancante');
    }

    let firebaseUid: string;
    try {
      const decoded = await this.firebaseConfig.verifyIdToken(token);
      firebaseUid = decoded.uid;
    } catch (err) {
      this.logger.warn(
        `Token rifiutato: ${err instanceof Error ? err.message : 'errore sconosciuto'}`,
      );
      throw new UnauthorizedException('Token di accesso non valido');
    }

    const user = await this.usersRepository.findOne({ where: { firebaseUid } });

    // Il token è buono ma l'utente non è ancora stato sincronizzato nel BFF:
    // è un 401, non un 404, perché per noi quella sessione non esiste.
    if (!user) {
      throw new UnauthorizedException('Utente non trovato');
    }

    request.user = user;
    return true;
  }
}

/** La richiesta dopo il guard: `user` c'è sempre. */
export interface AuthenticatedRequest extends Request {
  user: User;
}
