import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsNumber() homeLat?: number;
  @IsOptional() @IsNumber() homeLng?: number;
  @IsOptional() @IsString() homeAddress?: string;
}
