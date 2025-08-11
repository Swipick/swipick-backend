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

  // CORS configuration - Production ready with explicit origin setting
  const allowedOrigins = [
    'https://swipick-production.up.railway.app',
    'https://frontend-service-production.up.railway.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🔧 Allowed CORS origins:`, allowedOrigins);

  // Use a more explicit CORS configuration
  const corsConfig = {
    origin: true, // Allow all origins temporarily for debugging
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

  console.log(
    `🚀 CORS Configuration Applied:`,
    JSON.stringify(corsConfig, null, 2),
  );
  app.enableCors(corsConfig);

  // Add custom middleware to log CORS requests
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      console.log(`🔍 CORS Preflight Request:`, {
        method: req.method,
        origin: req.headers.origin,
        headers: req.headers,
        url: req.url,
      });
    }
    next();
  });

  const port = process.env.PORT || 9000;
  await app.listen(port);

  console.log(`🚀 BFF Service is running on: http://localhost:${port}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
}
bootstrap();
