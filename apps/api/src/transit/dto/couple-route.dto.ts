import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CoupleRouteDto {
  @IsString() @IsNotEmpty() eventId!: string;
  @IsString() @IsNotEmpty() userId!: string;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  forceRefresh?: boolean;
}
