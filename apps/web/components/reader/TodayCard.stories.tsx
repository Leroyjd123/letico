import type { Meta, StoryObj } from '@storybook/react';
import { TodayCard } from './TodayCard';

const meta: Meta<typeof TodayCard> = {
  title: 'Reader/TodayCard',
  component: TodayCard,
  args: {
    dayNumber: 42,
    label: 'genesis 12–14',
    completionPct: 0,
    isComplete: false,
    onMarkDayComplete: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof TodayCard>;

export const Unstarted: Story = { args: { completionPct: 0 } };
export const InProgress: Story = { args: { completionPct: 60 } };
export const Complete: Story = { args: { completionPct: 100, isComplete: true } };
