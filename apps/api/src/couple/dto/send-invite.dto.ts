import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SendInviteDto {
  @IsString() @IsNotEmpty() userId!: string;
  @IsEmail() inviteeEmail!: string;
}
