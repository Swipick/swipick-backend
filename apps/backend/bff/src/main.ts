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

  // CORS configuration - Production ready
  const allowedOrigins = [
    'https://swipick-production.up.railway.app',
    'https://frontend-service-production.up.railway.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🔧 Allowed CORS origins:`, allowedOrigins);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log(`❌ CORS blocked origin: ${origin}`);
      return callback(
        new Error(`CORS policy violation: ${origin} not allowed`),
        false,
      );
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
  });

  const port = process.env.PORT || 9000;
  await app.listen(port);

  console.log(`🚀 BFF Service is running on: http://localhost:${port}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
}
bootstrap();
