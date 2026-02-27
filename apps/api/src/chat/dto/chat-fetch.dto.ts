import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ChatFetchQueryDto {
  @IsString()
  @IsNotEmpty()
  coupleId!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beforeMs?: number;
}
