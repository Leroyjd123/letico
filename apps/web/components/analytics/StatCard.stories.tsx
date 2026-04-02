import type { Meta, StoryObj } from '@storybook/react';
import { StatCard } from './StatCard';

const meta: Meta<typeof StatCard> = {
  title: 'Analytics/StatCard',
  component: StatCard,
};
export default meta;
type Story = StoryObj<typeof StatCard>;

export const Completion: Story = { args: { label: 'completed', value: '12.5%' } };
export const Streak: Story = { args: { label: 'day streak', value: 7 } };
export const LargeNumber: Story = { args: { label: 'verses read', value: 9842 } };
