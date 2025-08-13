import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  console.log(
    '🔄 LOADING CORS UPDATE - Timestamp: 2025-08-13 v2.1 - Commit Verification',
  );

  // CORS configuration - Production ready with explicit origin setting
  const defaultOrigins = [
    'https://swipick-frontend-production.up.railway.app',
    'https://frontend-service-production.up.railway.app',
    'https://swipick-backend-production.up.railway.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:9000',
  ];

  // Add frontend URL from environment if available
  if (process.env.FRONTEND_URL) {
    defaultOrigins.push(process.env.FRONTEND_URL);
  }

  // Read allowed origins from environment variable or use defaults
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) =>
        origin.trim().replace(/['"]/g, ''),
      )
    : defaultOrigins;

  console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🔧 Raw CORS_ALLOWED_ORIGINS:`, process.env.CORS_ALLOWED_ORIGINS);
  console.log(`🔧 Allowed CORS origins:`, allowedOrigins);

  // Enhanced CORS configuration
  const corsConfig = {
    origin: (origin, callback) => {
      console.log(`🔍 CORS Origin Check: ${origin}`);
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        console.log(`✅ CORS Origin Allowed: ${origin}`);
        return callback(null, true);
      }

      console.log(`❌ CORS Origin Blocked: ${origin}`);
      console.log(`🔧 Allowed origins:`, allowedOrigins);
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

  console.log(`🚀 CORS Configuration Applied`);

  // Enable CORS with explicit configuration
  app.enableCors(corsConfig);

  // Add explicit middleware to handle CORS headers for debugging
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    console.log(
      `🔍 Request Origin: ${origin}, Method: ${req.method}, URL: ${req.url}`,
    );

    if (req.method === 'OPTIONS') {
      console.log(`🔍 CORS Preflight Request:`, {
        method: req.method,
        origin: origin,
        url: req.url,
        headers: req.headers,
      });
    }
    next();
  });

  const port = process.env.PORT || 9000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 BFF Service is running on: http://0.0.0.0:${port}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
}
bootstrap();
