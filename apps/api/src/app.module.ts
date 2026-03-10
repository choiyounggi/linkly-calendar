import { existsSync } from 'fs';
import path from 'path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransitModule } from './transit/transit.module';
import { ChatModule } from './chat/chat.module';
import { EventModule } from './event/event.module';
import { CoupleModule } from './couple/couple.module';
import { GalleryModule } from './gallery/gallery.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';

const envCandidates = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env.local'),
  path.resolve(process.cwd(), '../../.env'),
];

const envFilePath = envCandidates.filter((candidate) => existsSync(candidate));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePath.length ? envFilePath : envCandidates,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1000, limit: 10 },
        { name: 'medium', ttl: 60_000, limit: 100 },
      ],
    }),
    AuthModule,
    TransitModule,
    ChatModule,
    EventModule,
    CoupleModule,
    GalleryModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
