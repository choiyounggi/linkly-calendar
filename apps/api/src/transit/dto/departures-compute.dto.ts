/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsInt,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

type LocationPayload = Record<string, unknown>;

export class DeparturesComputeDto {
  @IsObject()
  @IsNotEmptyObject()
  originA!: LocationPayload;

  @IsObject()
  @IsNotEmptyObject()
  originB!: LocationPayload;

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
