import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class EventQueryDto {
  @IsString() @IsNotEmpty() coupleId!: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM format' }) month?: string;
  @IsString() @IsNotEmpty() userId!: string;
}
