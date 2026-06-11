import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration - Production ready with explicit origin setting
  const defaultOrigins = [
    'https://swipick.com',
    'https://www.swipick.com',
    'https://mindful-sparkle-production.up.railway.app',
    'https://frontend-service-production.up.railway.app',
    // Pro account Railway URLs
    'https://swipick-backend-production-2650.up.railway.app',
    'https://web-production-89230.up.railway.app',
    // Legacy URLs (keep for backward compatibility)
    'https://swipick-backend-production.up.railway.app',
    // Add potential Railway domain variations
    'https://swipick-frontend.up.railway.app',
    'https://frontend-service.up.railway.app',
    'https://swipick.up.railway.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:9000',
  ];

  // Add frontend URL from environment if available
  if (process.env.FRONTEND_URL) {
    defaultOrigins.push(process.env.FRONTEND_URL);
  }

  // Read allowed origins from environment variable or use defaults
  const allowedOrigins = (
    process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',')
      : defaultOrigins
  )
    .map((o) => o.trim().replace(/['"]/g, ''))
    .filter((o) => !!o)
    .map((o) => o.replace(/\/$/, '')); // strip trailing slash for comparison

  const allowedOriginSet = new Set(allowedOrigins);

  logger.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);

  // Enhanced CORS configuration
  const corsConfig = {
    origin: (origin, callback) => {
      const normalizedOrigin = origin ? origin.replace(/\/$/, '') : origin;
      // Allow requests with no origin (mobile apps, etc.)
      if (!normalizedOrigin) return callback(null, true);

      // Temporary: Allow all Railway domains for debugging
      if (normalizedOrigin && normalizedOrigin.includes('.up.railway.app')) {
        return callback(null, true);
      }

      if (allowedOriginSet.has(normalizedOrigin)) {
        return callback(null, true);
      }

      logger.warn(`CORS origin blocked: ${normalizedOrigin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };

  // Enable CORS with explicit configuration
  app.enableCors(corsConfig);

  // Request logging (debug level: enable via logger config when troubleshooting)
  const requestLogger = new Logger('HTTP');
  app.use((req, res, next) => {
    requestLogger.debug(
      `${req.method} ${req.url} | Origin: ${req.headers.origin ?? '-'}`,
    );
    next();
  });

  const port = process.env.PORT || 9000;
  await app.listen(port, '0.0.0.0');

  logger.log(`BFF service running on http://0.0.0.0:${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV}`);
}
bootstrap();
