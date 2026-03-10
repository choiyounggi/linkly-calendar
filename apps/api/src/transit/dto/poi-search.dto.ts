import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PoiSearchDto {
  @IsString() @IsNotEmpty() keyword!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}
