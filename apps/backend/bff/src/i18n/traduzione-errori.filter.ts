import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { linguaDaHeader } from './lingua';
import { traduciMessaggio } from './messaggi-en';

/**
 * Traduce il `message` degli errori HTTP nella lingua della richiesta.
 *
 * Il resto della risposta resta com'è (stato, `error`, `statusCode`): l'app
 * legge `message` e lo mostra così com'è, quindi basta tradurre quello. Senza
 * `Accept-Language: en` non cambia nulla, nemmeno per le versioni dell'app
 * uscite prima della traduzione.
 */
@Catch(HttpException)
export class TraduzioneErroriFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    const lingua = linguaDaHeader(req?.headers?.['accept-language']);

    const status = exception.getStatus();
    const corpo = exception.getResponse();
    const tradotto =
      typeof corpo === 'string'
        ? { statusCode: status, message: traduciMessaggio(corpo, lingua) }
        : {
            ...(corpo as Record<string, unknown>),
            ...('message' in (corpo as object)
              ? {
                  message: tradurre(
                    (corpo as { message: unknown }).message,
                    lingua,
                  ),
                }
              : {}),
          };

    res.status(status).json(tradotto);
  }
}

function tradurre(
  message: unknown,
  lingua: ReturnType<typeof linguaDaHeader>,
): unknown {
  if (typeof message === 'string') return traduciMessaggio(message, lingua);
  if (Array.isArray(message)) {
    return message.map((m) =>
      typeof m === 'string' ? traduciMessaggio(m, lingua) : m,
    );
  }
  return message;
}
