import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class AwardPointsDto {
  @IsString()
  playerId!: string;

  @Type(() => Number)
  @IsNumber()
  bigBlind!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tableId?: number;

  @IsOptional()
  @IsString()
  tableStakes?: string;

  @IsOptional()
  @IsString()
  handId?: string;
}
