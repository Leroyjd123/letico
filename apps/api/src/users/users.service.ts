import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectSupabase } from '../supabase/inject-supabase.decorator';
import { SupabaseProvider } from '../supabase/supabase.provider';
import { dbError } from '../common/db-errors';
import { getPlanTotalDays } from '../common/user-plan';
import type { UpdateUserDto, UpdateUserResponseDto } from './users.types';

@Injectable()
export class UsersService {
  constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}

  async updateUser(userId: string, dto: UpdateUserDto): Promise<UpdateUserResponseDto> {
    const db = this.supabase.getClient();

    const updateObj: Record<string, string | null> = {};
    if (dto.planId !== undefined) {
      // A plan without days would leave the reader with a broken "today".
      if ((await getPlanTotalDays(db, dto.planId)) === 0) {
        throw new BadRequestException({
          error: { code: 'PLAN_NOT_FOUND', message: 'that reading plan is not available' },
        });
      }
      updateObj['plan_id'] = dto.planId;
    }
    if (dto.planStartDate !== undefined) {
      updateObj['plan_start_date'] = dto.planStartDate === null ? null : dto.planStartDate.slice(0, 10);
    }
    if (Object.keys(updateObj).length === 0) {
      throw new BadRequestException({
        error: { code: 'NOTHING_TO_UPDATE', message: 'provide planId and/or planStartDate' },
      });
    }

    const { data, error } = await db
      .from('users')
      .update(updateObj)
      .eq('id', userId)
      .is('archived_at', null)
      .select('plan_id, plan_start_date')
      .maybeSingle();
    if (error) dbError('USER_UPDATE_FAILED', error);
    if (!data) {
      throw new NotFoundException({ error: { code: 'USER_NOT_FOUND', message: 'user not found' } });
    }

    const row = data as { plan_id: string | null; plan_start_date: string | null };
    return { planId: row.plan_id, planStartDate: row.plan_start_date };
  }
}
