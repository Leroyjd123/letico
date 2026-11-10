import { IsOptional, IsUUID, IsDateString, ValidateIf } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsUUID() planId?: string;

  /** YYYY-MM-DD, or null to clear the start date. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString({ strict: true })
  planStartDate?: string | null;
}

export interface UpdateUserResponseDto {
  planId: string | null;
  planStartDate: string | null;
}
