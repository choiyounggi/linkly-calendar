import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatFetchQueryDto } from './dto/chat-fetch.dto';
import { ChatIdentityQueryDto } from './dto/chat-identity.dto';
import { ChatMessageKind, ChatSendDto } from './dto/chat-send.dto';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages')
  async sendMessage(@Body() payload: ChatSendDto) {
    this.ensurePayloadMatchesKind(payload);
    const message = await this.chatService.createMessage(payload);
    return { ok: true, message };
  }

  @Get('messages')
  async fetchMessages(@Query() query: ChatFetchQueryDto) {
    const messages = await this.chatService.fetchMessages(query);
    return { ok: true, messages };
  }

  @Get('identity')
  async fetchIdentity(@Query() query: ChatIdentityQueryDto) {
    const identity = await this.chatService.fetchIdentity(query.providerUserId);
    return { ok: true, identity };
  }

  private ensurePayloadMatchesKind(payload: ChatSendDto) {
    if (payload.kind === ChatMessageKind.TEXT && !payload.text) {
      throw new BadRequestException('Text message requires text.');
    }

    if (payload.kind === ChatMessageKind.IMAGE && !payload.imageUrl) {
      throw new BadRequestException('Image message requires imageUrl.');
    }
  }
}
