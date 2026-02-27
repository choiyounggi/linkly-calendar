import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConfig } from '../redis/redis.config';

export const CHAT_FANOUT_QUEUE = 'chat-fanout';

export type ChatFanoutJob = {
  coupleId: string;
  messageId: string;
};

@Injectable()
export class ChatFanoutQueue implements OnModuleDestroy {
  readonly queue = new Queue<ChatFanoutJob>(CHAT_FANOUT_QUEUE, {
    connection: redisConfig(),
  });

  async onModuleDestroy() {
    await this.queue.close();
  }
}
