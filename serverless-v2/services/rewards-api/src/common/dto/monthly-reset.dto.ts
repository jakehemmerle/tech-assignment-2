import {
  IsOptional,
  Matches,
} from 'class-validator';

export class MonthlyResetDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  monthKey?: string;
}
