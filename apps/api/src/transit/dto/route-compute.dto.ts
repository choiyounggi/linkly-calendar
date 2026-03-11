import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lon!: number;
}

export class RouteComputeDto {
  @ValidateNested()
  @Type(() => LocationDto)
  origin!: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  destination!: LocationDto;

  @IsOptional()
  @IsString()
  arrivalTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  bucketMinutes?: number;
}
