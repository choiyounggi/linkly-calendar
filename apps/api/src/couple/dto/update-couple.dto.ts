import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateCoupleDto {
  @IsOptional() @IsDateString() anniversaryDate?: string | null;
  @IsOptional() @IsString() myNickname?: string;
  @IsOptional() @IsString() partnerNickname?: string;
}
