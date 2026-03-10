import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsDateString() birthday?: string | null;
  @IsOptional() @IsNumber() homeLat?: number;
  @IsOptional() @IsNumber() homeLng?: number;
  @IsOptional() @IsString() homeAddress?: string;
}
