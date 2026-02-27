import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatFanoutModule } from './chat-fanout/chat-fanout.module';
import { TransitModule } from './transit/transit.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [ChatFanoutModule, TransitModule, ChatModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
