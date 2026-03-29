/**
 * plan.controller.ts — routing only, zero business logic.
 */
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlanService } from './plan.service';

@Controller('plan')
@UseGuards(AuthGuard)
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  /** GET /api/plan/today — returns today's plan day for the authenticated user */
  @Get('today')
  async getPlanToday(@CurrentUser() user: { id: string }) {
    const data = await this.planService.getPlanToday(user.id);
    return { data };
  }

  /**
   * GET /api/plan/:planId/days/summary
   * Returns completion % for all 365 days in one request.
   * Must be declared before :planId/day/:dayNumber to avoid param collision.
   */
  @Get(':planId/days/summary')
  async getAllDaysSummary(
    @Param('planId') planId: string,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.planService.getAllDaysSummary(planId, user.id);
    return { data };
  }

  /** GET /api/plan/:planId/day/:dayNumber — returns a specific plan day */
  @Get(':planId/day/:dayNumber')
  async getPlanDay(
    @Param('planId') planId: string,
    @Param('dayNumber', ParseIntPipe) dayNumber: number,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.planService.getPlanDay(planId, dayNumber, user.id);
    return { data };
  }
}
