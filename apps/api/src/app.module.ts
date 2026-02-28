import path from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatFanoutModule } from './chat-fanout/chat-fanout.module';
import { TransitModule } from './transit/transit.module';
import { ChatModule } from './chat/chat.module';

const repoRoot = path.resolve(__dirname, '../../..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.join(repoRoot, '.env.local'),
        path.join(repoRoot, '.env'),
      ],
    }),
    ChatFanoutModule,
    TransitModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
