import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';

type ChatSocketData = {
  coupleId?: string;
  userId?: string;
};

type ChatSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  ChatSocketData
>;
import { CHAT_EVENTS, CHAT_NAMESPACE, roomForCouple } from './chat.constants';
import { ChatMessageKind, ChatSendDto } from './dto/chat-send.dto';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@WebSocketGateway({
  namespace: CHAT_NAMESPACE,
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  async handleConnection(client: ChatSocket) {
    const { coupleId, userId } = this.readHandshake(client);

    if (!coupleId || !userId) {
      client.emit(CHAT_EVENTS.error, {
        message: 'Missing coupleId or userId in websocket handshake.',
      });
      client.disconnect(true);
      return;
    }

    client.data.coupleId = coupleId;
    client.data.userId = userId;
    await client.join(roomForCouple(coupleId));

    client.emit(CHAT_EVENTS.connected, {
      coupleId,
      userId,
      ts: Date.now(),
    });

    this.logger.log(`Client ${client.id} connected to couple ${coupleId}`);
  }

  handleDisconnect(client: ChatSocket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage(CHAT_EVENTS.ping)
  handlePing(@ConnectedSocket() client: ChatSocket) {
    client.emit(CHAT_EVENTS.pong, { ts: Date.now() });
  }

  @SubscribeMessage(CHAT_EVENTS.send)
  handleSend(
    @MessageBody() payload: ChatSendDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    this.ensurePayloadMatchesClient(payload, client);

    if (payload.kind === ChatMessageKind.TEXT && !payload.text) {
      throw new WsException('Text message requires text.');
    }

    if (payload.kind === ChatMessageKind.IMAGE && !payload.imageUrl) {
      throw new WsException('Image message requires imageUrl.');
    }

    const message = {
      id: payload.clientMessageId ?? `tmp-${Date.now()}`,
      coupleId: payload.coupleId,
      senderUserId: payload.senderUserId,
      kind: payload.kind,
      text: payload.text ?? null,
      imageUrl: payload.imageUrl ?? null,
      sentAtMs: payload.sentAtMs ?? Date.now(),
    };

    this.server
      .to(roomForCouple(payload.coupleId))
      .emit(CHAT_EVENTS.message, message);

    return { ok: true, message };
  }

  private readHandshake(client: ChatSocket) {
    const auth = client.handshake.auth ?? {};
    const query = client.handshake.query ?? {};

    const coupleId = this.coerceString(auth.coupleId ?? query.coupleId);
    const userId = this.coerceString(auth.userId ?? query.userId);

    return { coupleId, userId };
  }

  private coerceString(value: unknown) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0].trim();
    }
    return undefined;
  }

  private ensurePayloadMatchesClient(payload: ChatSendDto, client: ChatSocket) {
    if (client.data.coupleId && payload.coupleId !== client.data.coupleId) {
      throw new WsException('Payload coupleId does not match connection.');
    }

    if (client.data.userId && payload.senderUserId !== client.data.userId) {
      throw new WsException('Payload senderUserId does not match connection.');
    }
  }
}
