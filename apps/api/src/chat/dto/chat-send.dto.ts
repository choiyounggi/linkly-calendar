import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ChatMessageKind } from '@linkly/shared';
export { ChatMessageKind } from '@linkly/shared';

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sentAtMs?: number;
}
