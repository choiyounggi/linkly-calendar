import { Module } from '@nestjs/common';
import { ChatFanoutModule } from '../chat-fanout/chat-fanout.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatController } from './chat.controller';
import { ChatEncryptionService } from './chat-encryption.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [PrismaModule, ChatFanoutModule],
  controllers: [ChatController],
  providers: [ChatGateway, ChatEncryptionService, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
