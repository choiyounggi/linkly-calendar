import {
  Inject,
  Injectable,
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

@WebSocketGateway()
@Injectable()
export class ChatGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  private readonly server!: Server;

  private subscriber: Redis;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    this.subscriber = this.redis.duplicate();
  }

  async onModuleInit() {
    await this.subscriber.connect();
    await this.subscriber.psubscribe('chat:couple:*');

    this.subscriber.on('pmessage', (_, channel, payload) => {
      const coupleId = channel.split(':')[2];
      let messageId = payload;

      try {
        const parsed = JSON.parse(payload) as { messageId?: string };
        messageId = parsed.messageId ?? payload;
      } catch {
        // noop - keep raw payload
      }

      this.server.to(`couple:${coupleId}`).emit('chat:message', {
        messageId,
      });
    });
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { coupleId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `couple:${data.coupleId}`;
    void client.join(room);
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
  }
}
