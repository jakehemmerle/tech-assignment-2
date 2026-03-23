import { Type } from 'class-transformer';
import {
  IsNumber,
  IsString,
} from 'class-validator';

export class AdjustPointsDto {
  @IsString()
  playerId!: string;

  @Type(() => Number)
  @IsNumber()
  points!: number;

  @IsString()
  reason!: string;
}
