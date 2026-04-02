import type { Meta, StoryObj } from '@storybook/react';
import { StatusCard } from './StatusCard';

const meta: Meta<typeof StatusCard> = {
  title: 'Analytics/StatusCard',
  component: StatusCard,
};
export default meta;
type Story = StoryObj<typeof StatusCard>;

export const Ahead: Story = { args: { aheadBehindVerses: 255 } };
export const Behind: Story = { args: { aheadBehindVerses: -170 } };
export const OnTrack: Story = { args: { aheadBehindVerses: 0 } };
export const NoPlan: Story = { args: { aheadBehindVerses: null } };
