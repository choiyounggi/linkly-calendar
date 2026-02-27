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
import { ChatService } from './chat.service';

type ChatSocketData = {
  coupleId?: string;
  userId?: string;
  lastSeenAtMs?: number;
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
  private readonly heartbeatIntervalMs = this.readEnvNumber(
    'CHAT_WS_PING_INTERVAL_MS',
    25000,
  );
  private readonly heartbeatTimeoutMs = this.readEnvNumber(
    'CHAT_WS_PONG_TIMEOUT_MS',
    60000,
  );
  private readonly heartbeatTimers = new Map<string, NodeJS.Timeout>();
  private readonly disconnectReasons = new Map<string, string>();
  private readonly disconnectReasonOverrides = new Map<string, string>();
  private readonly disconnectMetrics = new Map<string, number>();

  constructor(private readonly chatService: ChatService) {}

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
    client.data.lastSeenAtMs = Date.now();

    this.registerDisconnectHandlers(client);
    this.startHeartbeat(client);

    await client.join(roomForCouple(coupleId));

    client.emit(CHAT_EVENTS.connected, {
      coupleId,
      userId,
      ts: Date.now(),
    });

    this.logger.log(`Client ${client.id} connected to couple ${coupleId}`);
  }

  handleDisconnect(client: ChatSocket) {
    this.stopHeartbeat(client.id);
    const reason =
      this.disconnectReasonOverrides.get(client.id) ??
      this.disconnectReasons.get(client.id) ??
      'unknown';
    this.recordDisconnectMetric(reason);
    this.logger.warn(
      `Client ${client.id} disconnected (${reason}) for couple ${
        client.data.coupleId ?? 'unknown'
      }`,
    );
    this.disconnectReasons.delete(client.id);
    this.disconnectReasonOverrides.delete(client.id);
  }

  @SubscribeMessage(CHAT_EVENTS.ping)
  handlePing(@ConnectedSocket() client: ChatSocket) {
    this.touchHeartbeat(client);
    client.emit(CHAT_EVENTS.pong, { ts: Date.now() });
  }

  @SubscribeMessage(CHAT_EVENTS.pong)
  handlePong(@ConnectedSocket() client: ChatSocket) {
    this.touchHeartbeat(client);
  }

  @SubscribeMessage(CHAT_EVENTS.send)
  async handleSend(
    @MessageBody() payload: ChatSendDto,
    @ConnectedSocket() client: ChatSocket,
  ) {
    this.ensurePayloadMatchesClient(payload, client);
    this.touchHeartbeat(client);

    if (payload.kind === ChatMessageKind.TEXT && !payload.text) {
      throw new WsException('Text message requires text.');
    }

    if (payload.kind === ChatMessageKind.IMAGE && !payload.imageUrl) {
      throw new WsException('Image message requires imageUrl.');
    }

    const message = await this.chatService.createMessage(payload);

    this.server
      .to(roomForCouple(payload.coupleId))
      .emit(CHAT_EVENTS.message, { messageId: message.id });

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

  private registerDisconnectHandlers(client: ChatSocket) {
    client.on('disconnecting', (reason) => {
      this.disconnectReasons.set(client.id, reason ?? 'unknown');
    });
  }

  private startHeartbeat(client: ChatSocket) {
    const timer = setInterval(() => {
      const now = Date.now();
      const lastSeen = client.data.lastSeenAtMs ?? now;

      if (now - lastSeen > this.heartbeatTimeoutMs) {
        const timeoutMs = now - lastSeen;
        this.disconnectReasonOverrides.set(client.id, 'heartbeat-timeout');
        this.logger.warn(
          `Client ${client.id} heartbeat timeout after ${timeoutMs}ms; disconnecting.`,
        );
        client.disconnect(true);
        return;
      }

      client.emit(CHAT_EVENTS.ping, { ts: now });
    }, this.heartbeatIntervalMs);

    this.heartbeatTimers.set(client.id, timer);
  }

  private stopHeartbeat(clientId: string) {
    const timer = this.heartbeatTimers.get(clientId);
    if (timer) clearInterval(timer);
    this.heartbeatTimers.delete(clientId);
  }

  private touchHeartbeat(client: ChatSocket) {
    client.data.lastSeenAtMs = Date.now();
  }

  private readEnvNumber(key: string, fallback: number) {
    const raw = process.env[key];
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return value;
  }

  private recordDisconnectMetric(reason: string) {
    const current = this.disconnectMetrics.get(reason) ?? 0;
    const next = current + 1;
    this.disconnectMetrics.set(reason, next);
    this.logger.debug(`Disconnect count for ${reason}: ${next}`);
  }
}
