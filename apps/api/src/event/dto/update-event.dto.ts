import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateEventDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() placeName?: string | null;
  @IsOptional() @IsString() placeAddress?: string | null;
  @IsOptional() @IsNumber() placeLat?: number | null;
  @IsOptional() @IsNumber() placeLng?: number | null;
  @IsOptional() @IsDateString() appointmentAt?: string | null;
  @IsOptional() @IsString() detail?: string | null;
}
