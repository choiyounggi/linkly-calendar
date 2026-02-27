import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthProvider, type ChatMessage } from '@prisma/client';
import { ChatFanoutQueue } from '../chat-fanout/chat-fanout.queue';
import { PrismaService } from '../prisma/prisma.service';
import { ChatEncryptionService } from './chat-encryption.service';
import { ChatFetchQueryDto } from './dto/chat-fetch.dto';
import { ChatMessageKind, ChatSendDto } from './dto/chat-send.dto';

export type ChatMessageView = {
  id: string;
  coupleId: string;
  senderUserId: string;
  kind: ChatMessageKind;
  text: string | null;
  imageUrl: string | null;
  sentAtMs: number;
  createdAt: string;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: ChatEncryptionService,
    private readonly fanoutQueue: ChatFanoutQueue,
  ) {}

  async createMessage(payload: ChatSendDto): Promise<ChatMessageView> {
    await this.ensureCoupleMember(payload.coupleId, payload.senderUserId);
    this.ensurePayloadMatchesKind(payload);

    const encrypted = this.encryption.encrypt({
      text: payload.text ?? null,
      imageUrl: payload.imageUrl ?? null,
    });

    const record = await this.prisma.chatMessage.create({
      data: {
        coupleId: payload.coupleId,
        senderUserId: payload.senderUserId,
        kind: payload.kind,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        keyVersion: encrypted.keyVersion,
        thumbnailUrl: null,
        sentAtMs: BigInt(payload.sentAtMs ?? Date.now()),
      },
    });

    await this.fanoutQueue.queue.add('fanout', {
      coupleId: payload.coupleId,
      messageId: record.id,
    });

    return this.toView(record, payload.text ?? null, payload.imageUrl ?? null);
  }

  async fetchMessages(query: ChatFetchQueryDto) {
    await this.ensureCoupleMember(query.coupleId, query.userId);

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        coupleId: query.coupleId,
        ...(query.beforeMs
          ? {
              sentAtMs: {
                lt: BigInt(query.beforeMs),
              },
            }
          : {}),
      },
      orderBy: {
        sentAtMs: 'desc',
      },
      take: query.limit,
    });

    return messages.map((record) => this.decryptView(record));
  }

  async fetchIdentity(providerUserId = 'seed_user_1') {
    const user = await this.prisma.user.findFirst({
      where: {
        authProvider: AuthProvider.LOCAL,
        providerUserId,
      },
      select: {
        id: true,
        providerUserId: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Seed user not found.');
    }

    const membership = await this.prisma.coupleMember.findFirst({
      where: { userId: user.id },
      select: { coupleId: true },
    });

    if (!membership) {
      throw new BadRequestException('Seed user has no couple.');
    }

    return {
      userId: user.id,
      coupleId: membership.coupleId,
      providerUserId: user.providerUserId,
    };
  }

  private async ensureCoupleMember(coupleId: string, userId: string) {
    const member = await this.prisma.coupleMember.findUnique({
      where: {
        coupleId_userId: {
          coupleId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!member) {
      throw new ForbiddenException('User is not a member of this couple.');
    }
  }

  private ensurePayloadMatchesKind(payload: ChatSendDto) {
    if (payload.kind === ChatMessageKind.TEXT && !payload.text) {
      throw new BadRequestException('Text message requires text.');
    }

    if (payload.kind === ChatMessageKind.IMAGE && !payload.imageUrl) {
      throw new BadRequestException('Image message requires imageUrl.');
    }
  }

  private decryptView(record: ChatMessage): ChatMessageView {
    const decrypted = this.encryption.decrypt({
      ciphertext: record.ciphertext,
      iv: record.iv,
      tag: record.tag,
      keyVersion: record.keyVersion,
    });

    return this.toView(
      record,
      (decrypted.text as string | null | undefined) ?? null,
      (decrypted.imageUrl as string | null | undefined) ?? null,
    );
  }

  private toView(
    record: ChatMessage,
    text: string | null,
    imageUrl: string | null,
  ): ChatMessageView {
    return {
      id: record.id,
      coupleId: record.coupleId,
      senderUserId: record.senderUserId,
      kind: record.kind as ChatMessageKind,
      text,
      imageUrl,
      sentAtMs: Number(record.sentAtMs),
      createdAt: record.createdAt.toISOString(),
    };
  }
}
