import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type Redis from 'ioredis';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';
import { CHAT_NAMESPACE, roomForCouple } from '../chat/chat.constants';

@WebSocketGateway({ namespace: CHAT_NAMESPACE })
@Injectable()
export class ChatGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private subscriber: Redis;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    this.subscriber = this.redis.duplicate();
  }

  async onModuleInit() {
    await this.subscriber.connect();
    await this.subscriber.psubscribe('chat:couple:*');

    this.subscriber.on('pmessage', (_: string, channel: string, payload: string) => {
      const coupleId = channel.split(':')[2];
      let messageId = payload;

      try {
        const parsed = JSON.parse(payload) as { messageId?: string };
        messageId = parsed.messageId ?? payload;
      } catch {
        // 무시: 원본 페이로드를 그대로 유지
      }

      this.server.to(roomForCouple(coupleId)).emit('chat:message', {
        messageId,
      });
    });
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { coupleId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const handshakeCoupleId =
      (client.handshake.auth as Record<string, unknown>)?.coupleId ??
      client.handshake.query?.coupleId;

    if (!handshakeCoupleId || handshakeCoupleId !== data.coupleId) {
      this.logger.warn(
        `Client ${client.id} tried to join room for couple ${data.coupleId} but handshake coupleId does not match.`,
      );
      return;
    }

    const room = roomForCouple(data.coupleId);
    void client.join(room);
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
  }
}
