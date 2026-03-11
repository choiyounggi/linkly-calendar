import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateEventDto {
  @IsString() @IsNotEmpty() coupleId!: string;
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsString() placeName?: string;
  @IsOptional() @IsString() placeAddress?: string;
  @IsOptional() @IsNumber() placeLat?: number;
  @IsOptional() @IsNumber() placeLng?: number;
  @IsOptional() @IsDateString() appointmentAt?: string;
  @IsOptional() @IsString() detail?: string;
}
