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

  // CORS configuration - More permissive for debugging
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [
            'https://swipick-production.up.railway.app',
            'https://frontend-service-production.up.railway.app',
          ]
        : true,
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
