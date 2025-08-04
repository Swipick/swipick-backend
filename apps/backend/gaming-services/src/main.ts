import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  const app = await NestFactory.create(AppModule);

  // Get configuration
  const configService = app.get(ConfigService);
  const port = configService.get("PORT", 3000);
  const nodeEnv = configService.get("NODE_ENV", "development");

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // CORS configuration
  app.enableCors({
    origin: nodeEnv === "production" ? false : true,
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix("api");

  // Start server
  await app.listen(port);

  logger.log(`🚀 Gaming Services running on port ${port} (${nodeEnv})`);
  logger.log(`📊 Health check: http://localhost:${port}/api/health`);
}

bootstrap().catch((error) => {
  console.error("Failed to start Gaming Services:", error);
  process.exit(1);
});
