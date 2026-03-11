import { IsBoolean, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class CoupleRouteDto {
  @IsString() @IsNotEmpty() eventId!: string;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  forceRefresh?: boolean;
}
