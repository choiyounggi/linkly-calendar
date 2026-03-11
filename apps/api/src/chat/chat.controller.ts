import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatService } from './chat.service';
import { ChatFetchQueryDto } from './dto/chat-fetch.dto';
import { ChatIdentityQueryDto } from './dto/chat-identity.dto';
import { ChatSendDto } from './dto/chat-send.dto';

@UseGuards(JwtAuthGuard)
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
  async sendMessage(@CurrentUser('id') userId: string, @Body() payload: ChatSendDto) {
    payload.senderUserId = userId;
    const message = await this.chatService.createMessage(payload);
    return { ok: true, message };
  }

  @Get('messages')
  async fetchMessages(@CurrentUser('id') userId: string, @Query() query: ChatFetchQueryDto) {
    query.userId = userId;
    const messages = await this.chatService.fetchMessages(query);
    return { ok: true, messages };
  }

  @Get('identity')
  async fetchIdentity(@Query() query: ChatIdentityQueryDto) {
    const identity = await this.chatService.fetchIdentity(query.providerUserId);
    return { ok: true, identity };
  }
}
