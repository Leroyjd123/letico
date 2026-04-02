/**
 * plan.controller.ts — routing only, zero business logic.
 *
 * Note: AuthGuard is applied per-method rather than at the class level
 * because GET /plan/list is a public endpoint (no auth required).
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
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  /**
   * GET /api/plan/list — returns all available plans (public, no auth required).
   * Declared first to avoid collision with :planId param routes.
   */
  @Get('list')
  async listPlans() {
    const data = await this.planService.listPlans();
    return { data };
  }

  /** GET /api/plan/today — returns today's plan day for the authenticated user */
  @Get('today')
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
  async getAllDaysSummary(
    @Param('planId') planId: string,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.planService.getAllDaysSummary(planId, user.id);
    return { data };
  }

  /** GET /api/plan/:planId/day/:dayNumber — returns a specific plan day */
  @Get(':planId/day/:dayNumber')
  @UseGuards(AuthGuard)
  async getPlanDay(
    @Param('planId') planId: string,
    @Param('dayNumber', ParseIntPipe) dayNumber: number,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.planService.getPlanDay(planId, dayNumber, user.id);
    return { data };
  }
}
