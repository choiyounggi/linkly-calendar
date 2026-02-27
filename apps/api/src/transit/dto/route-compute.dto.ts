import {
  IsInt,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

type LocationPayload = Record<string, unknown>;

export class RouteComputeDto {
  @IsObject()
  @IsNotEmptyObject()
  origin!: LocationPayload;

  @IsObject()
  @IsNotEmptyObject()
  destination!: LocationPayload;

  @IsOptional()
  @IsString()
  arrivalTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  bucketMinutes?: number;
}
