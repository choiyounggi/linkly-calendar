import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { ChatFanoutQueue } from './chat-fanout.queue';
import { ChatFanoutWorker } from './chat-fanout.worker';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [RedisModule],
  providers: [ChatFanoutQueue, ChatFanoutWorker, ChatGateway],
  exports: [ChatFanoutQueue],
})
export class ChatFanoutModule {}
