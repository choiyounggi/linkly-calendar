import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class PhotoQueryDto {
  @IsString() @IsNotEmpty() coupleId!: string;
  @IsString() @IsNotEmpty() userId!: string;

  /** cursor-based pagination: pass the last photo's id */
  @IsOptional() @IsString() cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  take?: number;
}
