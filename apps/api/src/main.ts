import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

function parseCorsOrigins(): string[] | true {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) {
    return process.env.NODE_ENV === 'development' ? true : [];
  }
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve uploaded photos as static files
  const uploadsDir = path.resolve(process.cwd(), '../../uploads/photos');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/photos' });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const corsOrigin = parseCorsOrigins();
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  const defaultPort = process.env.NODE_ENV === 'development' ? 3001 : 3000;
  await app.listen(process.env.PORT ?? defaultPort);
}
void bootstrap();
