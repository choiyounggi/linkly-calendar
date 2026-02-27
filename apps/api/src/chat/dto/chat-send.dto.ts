import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum ChatMessageKind {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
}

export class ChatSendDto {
  @IsString()
  @IsNotEmpty()
  coupleId!: string;

  @IsString()
  @IsNotEmpty()
  senderUserId!: string;

  @IsEnum(ChatMessageKind)
  kind!: ChatMessageKind;

  @IsOptional()
  @IsString()
  @MinLength(1)
  text?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  clientMessageId?: string;

  @IsOptional()
  sentAtMs?: number;
}
