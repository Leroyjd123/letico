import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectSupabase } from '../supabase/inject-supabase.decorator';
import { SupabaseProvider } from '../supabase/supabase.provider';
import type { UpdateUserDto, UpdateUserResponseDto } from './users.types';

@Injectable()
export class UsersService {
  constructor(@InjectSupabase() private readonly supabase: SupabaseProvider) {}

  async updateUser(userId: string, dto: UpdateUserDto): Promise<UpdateUserResponseDto> {
    const db = this.supabase.getClient();

    const updateObj: Record<string, string | undefined> = {};
    if (dto.planId !== undefined) {
      updateObj['plan_id'] = dto.planId;
    }
    if (dto.planStartDate !== undefined) {
      updateObj['plan_start_date'] = dto.planStartDate;
    }

    const { data, error } = await db
      .from('users')
      .update(updateObj)
      .eq('id', userId)
      .is('archived_at', null)
      .select('plan_id, plan_start_date')
      .single();

    if (error || !data) {
      throw new NotFoundException({
        error: { code: 'USER_NOT_FOUND', message: 'user not found' },
      });
    }

    const row = data as { plan_id: string | null; plan_start_date: string | null };

    return {
      planId: row.plan_id,
      planStartDate: row.plan_start_date,
    };
  }
}
