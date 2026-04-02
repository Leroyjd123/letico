import type { Meta, StoryObj } from '@storybook/react';
import { ProgressGraph } from './ProgressGraph';

const TYPICAL = [
  { date: '2026-03-26', count: 45 },
  { date: '2026-03-27', count: 0 },
  { date: '2026-03-28', count: 82 },
  { date: '2026-03-29', count: 110 },
  { date: '2026-03-30', count: 67 },
  { date: '2026-03-31', count: 0 },
  { date: '2026-04-01', count: 93 },
];

const meta: Meta<typeof ProgressGraph> = {
  title: 'Analytics/ProgressGraph',
  component: ProgressGraph,
};
export default meta;
type Story = StoryObj<typeof ProgressGraph>;

export const TypicalWeek: Story = { args: { data: TYPICAL } };
export const Spike: Story = { args: { data: TYPICAL.map((d, i) => ({ ...d, count: i === 3 ? 950 : d.count })) } };
export const Empty: Story = { args: { data: [] } };
