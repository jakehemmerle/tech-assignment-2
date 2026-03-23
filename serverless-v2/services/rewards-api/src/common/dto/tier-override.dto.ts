import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class TierOverrideDto {
  @IsString()
  playerId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  tierLevel!: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
