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
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // Only log POST requests to /api/predictions to avoid spam.
    // Debug level: headers/body possono contenere token — non vanno nei log
    // di produzione di default.
    if (method === 'POST' && url.includes('/predictions')) {
      this.logger.debug(`Incoming ${method} ${url}`);
    }

    return next.handle();
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  logger.log('Starting gaming-services...');

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
  const corsOrigins = [
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:4200',
    'https://swipick.com',
    'https://www.swipick.com',
    'https://swipick-frontend.vercel.app',
    'https://swipick-frontend.up.railway.app',
    'https://mindful-sparkle-production.up.railway.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked request from origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
  new Logger('Bootstrap').error('Failed to start Gaming Services:', error);
  process.exit(1);
});
