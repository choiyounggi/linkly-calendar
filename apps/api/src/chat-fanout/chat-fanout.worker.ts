import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import type Redis from 'ioredis';
import { redisConfig } from '../redis/redis.config';
import { CHAT_FANOUT_QUEUE, type ChatFanoutJob } from './chat-fanout.queue';

@Injectable()
export class ChatFanoutWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<ChatFanoutJob>;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  onModuleInit() {
    this.worker = new Worker<ChatFanoutJob>(
      CHAT_FANOUT_QUEUE,
      async (job) => {
        const { coupleId, messageId } = job.data;
        await this.redis.publish(
          `chat:couple:${coupleId}`,
          JSON.stringify({ messageId }),
        );
      },
      { connection: redisConfig() },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
