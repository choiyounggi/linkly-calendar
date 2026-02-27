import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
