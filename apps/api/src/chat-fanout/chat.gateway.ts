import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type Redis from 'ioredis';
import { Server } from 'socket.io';
import { CHAT_EVENTS, CHAT_NAMESPACE, roomForCouple } from '../chat/chat.constants';

const CHANNEL_PREFIX = 'chat:couple:';

@WebSocketGateway({ namespace: CHAT_NAMESPACE })
@Injectable()
export class ChatFanoutGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(ChatFanoutGateway.name);
  private subscriber: Redis;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    this.subscriber = this.redis.duplicate();
  }

  async onModuleInit() {
    this.subscriber.on('error', (err: Error) => {
      this.logger.error(`Redis subscriber error: ${err.message}`, err.stack);
    });

    await this.subscriber.connect();
    await this.subscriber.psubscribe(`${CHANNEL_PREFIX}*`);

    this.subscriber.on('pmessage', (_: string, channel: string, payload: string) => {
      const coupleId = channel.slice(CHANNEL_PREFIX.length);

      if (!this.server) {
        this.logger.warn(`Server not ready, dropping fanout for couple ${coupleId}`);
        return;
      }

      try {
        const message = JSON.parse(payload) as Record<string, unknown>;
        this.server.to(roomForCouple(coupleId)).emit(CHAT_EVENTS.message, message);
      } catch {
        this.logger.warn(`Failed to parse fanout payload for couple ${coupleId}`);
      }
    });
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
  }
}
