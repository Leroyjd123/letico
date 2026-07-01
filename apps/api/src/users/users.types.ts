import { IsOptional, IsUUID, IsDateString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsUUID() planId?: string;
  @IsOptional() @IsDateString() planStartDate?: string;
}

export interface UpdateUserResponseDto {
  planId: string | null;
  planStartDate: string | null;
}
