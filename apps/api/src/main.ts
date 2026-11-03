import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');

  const corsOrigins = process.env.CORS_ORIGINS ?? 'http://localhost:5173';
  app.enableCors({
    origin: corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.use(cookieParser());
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
