import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import serverless from 'serverless-http';

import { AppModule } from './src/app.module';

type ServerlessHandler = ReturnType<typeof serverless>;

let cachedHandler: ServerlessHandler | null = null;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Player-Id', 'X-Admin-Id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );
  await app.init();
  return serverless(app.getHttpAdapter().getInstance());
}

export const api = async (...args: Parameters<ServerlessHandler>) => {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }

  return cachedHandler(...args);
};
