import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, headers } = request;

    // Only log POST requests to /api/predictions to avoid spam
    if (method === 'POST' && url.includes('/predictions')) {
      console.log('🌐 [GLOBAL_INTERCEPTOR] === INCOMING REQUEST ===');
      console.log('🌐 [GLOBAL_INTERCEPTOR] Method:', method);
      console.log('🌐 [GLOBAL_INTERCEPTOR] URL:', url);
      console.log(
        '🌐 [GLOBAL_INTERCEPTOR] Headers:',
        JSON.stringify(headers, null, 2),
      );
      console.log(
        '🌐 [GLOBAL_INTERCEPTOR] Body:',
        JSON.stringify(body, null, 2),
      );
      console.log('🌐 [GLOBAL_INTERCEPTOR] === END REQUEST ===');
    }

    return next.handle();
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // SANITY CHECK: Verify Gaming Services startup
  console.log('🚀🚀🚀 [GAMING_SERVICES_STARTUP] ='.repeat(35));
  console.log(
    '🚀🚀🚀 [GAMING_SERVICES_STARTUP] *** GAMING SERVICES STARTING UP ***',
  );
  console.log(
    '🚀🚀🚀 [GAMING_SERVICES_STARTUP] Timestamp:',
    new Date().toISOString(),
  );
  console.log(
    '🚀🚀🚀 [GAMING_SERVICES_STARTUP] Version: LIVE_MODE_FIXES_COMPLETE',
  );
  console.log(
    '🚀🚀🚀 [GAMING_SERVICES_STARTUP] Contains all fixes: Firebase UID validation, fixtureId handling, comprehensive logging',
  );
  console.log('🚀🚀🚀 [GAMING_SERVICES_STARTUP] ='.repeat(35));

  const app = await NestFactory.create(AppModule);

  // Get configuration
  const configService = app.get(ConfigService);
  const port = configService.get('PORT', 3000);
  const nodeEnv = configService.get('NODE_ENV', 'development');

  // Global interceptors for logging
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: nodeEnv === 'production' ? false : true,
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Start server
  await app.listen(port);

  logger.log(`🚀 Gaming Services running on port ${port} (${nodeEnv})`);
  logger.log(`📊 Health check: http://localhost:${port}/api/health`);

  // Log all registered routes for debugging
  const server = app.getHttpServer();
  const router = server._events.request._router;
  if (router && router.stack) {
    logger.log('📍 [ROUTE_DEBUG] Registered routes:');
    router.stack.forEach((layer: any) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods);
        logger.log(
          `📍 [ROUTE_DEBUG] ${methods.join(',').toUpperCase()} ${layer.route.path}`,
        );
      }
    });
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start Gaming Services:', error);
  process.exit(1);
});
