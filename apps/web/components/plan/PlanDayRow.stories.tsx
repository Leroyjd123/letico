import type { Meta, StoryObj } from '@storybook/react';
import { PlanDayRow } from './PlanDayRow';

const meta: Meta<typeof PlanDayRow> = {
  title: 'Plan/PlanDayRow',
  component: PlanDayRow,
  args: { dayNumber: 42, label: 'genesis 12–14', completionPct: 0, isToday: false, offsetFromToday: 5, onClick: () => {} },
};
export default meta;
type Story = StoryObj<typeof PlanDayRow>;

export const Today: Story = { args: { isToday: true, completionPct: 60, offsetFromToday: 0 } };
export const Past: Story = { args: { completionPct: 100, offsetFromToday: -10 } };
export const Future: Story = { args: { completionPct: 0, offsetFromToday: 20 } };
