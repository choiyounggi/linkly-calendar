import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import type Redis from 'ioredis';
import { redisConfig } from '../redis/redis.config';
import { CHAT_FANOUT_QUEUE, type ChatFanoutJob } from './chat-fanout.queue';

@Injectable()
export class ChatFanoutWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatFanoutWorker.name);
  private worker?: Worker<ChatFanoutJob>;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  onModuleInit() {
    this.worker = new Worker<ChatFanoutJob>(
      CHAT_FANOUT_QUEUE,
      async (job) => {
        const { coupleId, message } = job.data;
        await this.redis.publish(
          `chat:couple:${coupleId}`,
          JSON.stringify(message),
        );
      },
      {
        connection: redisConfig(),
        stalledInterval: 30_000,
      },
    );

    this.worker.on('failed', (job: { id?: string } | undefined, error: Error) => {
      this.logger.error(
        `Fanout job ${job?.id ?? 'unknown'} failed: ${error.message}`,
        error.stack,
      );
    });

    this.worker.on('stalled', (jobId: string) => {
      this.logger.warn(`Fanout job ${jobId} stalled — will be retried.`);
    });

    this.worker.on('error', (error: Error) => {
      this.logger.error(`Fanout worker error: ${error.message}`, error.stack);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
