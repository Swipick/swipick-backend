import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // DEPLOYMENT VERIFICATION LOGS
  console.log('🎯'.repeat(20));
  console.log('🎯 [BFF_STARTUP] DEPLOYMENT VERIFICATION OCT 6TH');
  console.log('🎯 [BFF_STARTUP] Version: PERCENTILE_ENDPOINTS_V1');
  console.log('🎯 [BFF_STARTUP] Timestamp:', new Date().toISOString());
  console.log('🎯 [BFF_STARTUP] Features: Proxying percentile and statistics endpoints');
  console.log('🎯'.repeat(20));

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
    '🔄 LOADING CORS UPDATE - Timestamp: 2025-08-13 v2.2 - FORCE REBUILD',
  );

  // CORS configuration - Production ready with explicit origin setting
  const defaultOrigins = [
    'https://swipick.com',
    'https://www.swipick.com',
    'https://swipick-frontend-production.up.railway.app',
    'https://frontend-service-production.up.railway.app',
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

  console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🔧 Raw CORS_ALLOWED_ORIGINS:`, process.env.CORS_ALLOWED_ORIGINS);
  console.log(`🔧 Allowed CORS origins:`, allowedOrigins);

  // Enhanced CORS configuration
  const corsConfig = {
    origin: (origin, callback) => {
      const normalizedOrigin = origin ? origin.replace(/\/$/, '') : origin;
      console.log(
        `🔍 CORS Origin Check: raw=${origin} normalized=${normalizedOrigin}`,
      );
      // Allow requests with no origin (mobile apps, etc.)
      if (!normalizedOrigin) return callback(null, true);

      // Temporary: Allow all Railway domains for debugging
      if (normalizedOrigin && normalizedOrigin.includes('.up.railway.app')) {
        console.log(`✅ CORS Origin Allowed (Railway): ${normalizedOrigin}`);
        return callback(null, true);
      }

      if (allowedOriginSet.has(normalizedOrigin)) {
        console.log(`✅ CORS Origin Allowed: ${normalizedOrigin}`);
        return callback(null, true);
      }

      console.log(`❌ CORS Origin Blocked: ${normalizedOrigin}`);
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
    const userAgent = req.headers['user-agent'] || 'unknown';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);

    console.log(
      `🔍 Request: ${req.method} ${req.url} | Origin: ${origin} | Mobile: ${isMobile}`,
    );

    if (req.method === 'OPTIONS') {
      console.log(`🔍 CORS Preflight Request:`, {
        method: req.method,
        origin: origin,
        url: req.url,
        userAgent: userAgent.substring(0, 100),
      });
    }

    // Log Google sync requests specifically
    if (req.url.includes('/sync-google')) {
      console.log(`🟣 [CORS Middleware] Google sync request detected!`);
      console.log(`🟣 [CORS Middleware] User-Agent: ${userAgent}`);
      console.log(`🟣 [CORS Middleware] Origin: ${origin}`);
      console.log(`🟣 [CORS Middleware] Method: ${req.method}`);
    }

    next();
  });

  const port = process.env.PORT || 9000;
  console.log(`🔧 Force rebuild verification - binding to 0.0.0.0:${port}`);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 BFF Service is running on: http://0.0.0.0:${port}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
}
bootstrap();
