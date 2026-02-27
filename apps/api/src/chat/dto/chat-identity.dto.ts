import { IsOptional, IsString } from 'class-validator';

export class ChatIdentityQueryDto {
  @IsOptional()
  @IsString()
  providerUserId?: string;
}
