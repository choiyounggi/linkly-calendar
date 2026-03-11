import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lon!: number;
}

export class DeparturesComputeDto {
  @ValidateNested()
  @Type(() => LocationDto)
  originA!: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  originB!: LocationDto;

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
