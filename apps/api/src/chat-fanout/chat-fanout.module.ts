import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { ChatFanoutQueue } from './chat-fanout.queue';
import { ChatFanoutWorker } from './chat-fanout.worker';
import { ChatFanoutGateway } from './chat.gateway';

@Module({
  imports: [RedisModule],
  providers: [ChatFanoutQueue, ChatFanoutWorker, ChatFanoutGateway],
  exports: [ChatFanoutQueue],
})
export class ChatFanoutModule {}
