import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { SupabaseProvider } from '../supabase/supabase.provider';
import { mockSupabase, mockProvider, type MockResult, type RecordedQuery } from '../testing/mock-supabase';

async function build(from: (q: RecordedQuery) => MockResult) {
  const db = mockSupabase({ from });
  const mod = await Test.createTestingModule({
    providers: [UsersService, { provide: SupabaseProvider, useValue: mockProvider(db.client) }],
  }).compile();
  return { service: mod.get(UsersService), db };
}

describe('UsersService.updateUser', () => {
  it('updates the start date', async () => {
    const { service, db } = await build(() => ({ data: { plan_id: 'p', plan_start_date: '2026-04-01' } }));
    await expect(service.updateUser('u', { planStartDate: '2026-04-01' })).resolves.toEqual({
      planId: 'p',
      planStartDate: '2026-04-01',
    });
    expect(db.queries[0]!.argsOf('update')[0]).toEqual({ plan_start_date: '2026-04-01' });
  });

  it('can clear the start date', async () => {
    const { service, db } = await build(() => ({ data: { plan_id: 'p', plan_start_date: null } }));
    await service.updateUser('u', { planStartDate: null });
    expect(db.queries[0]!.argsOf('update')[0]).toEqual({ plan_start_date: null });
  });

  it('rejects a plan with no days (PLAN_NOT_FOUND, not USER_NOT_FOUND)', async () => {
    const { service } = await build((q) => (q.table === 'plan_days' ? { count: 0 } : {}));
    await expect(service.updateUser('u', { planId: 'empty' })).rejects.toThrow(BadRequestException);
  });

  it('accepts a plan with days', async () => {
    const { service } = await build((q) =>
      q.table === 'plan_days' ? { count: 365 } : { data: { plan_id: 'p1', plan_start_date: null } },
    );
    await expect(service.updateUser('u', { planId: 'p1' })).resolves.toEqual({
      planId: 'p1',
      planStartDate: null,
    });
  });

  it('rejects an empty update', async () => {
    const { service } = await build(() => ({}));
    await expect(service.updateUser('u', {})).rejects.toThrow(BadRequestException);
  });

  it('returns USER_NOT_FOUND when no row matches', async () => {
    const { service } = await build(() => ({ data: null }));
    await expect(service.updateUser('u', { planStartDate: '2026-01-01' })).rejects.toThrow(NotFoundException);
  });
});
