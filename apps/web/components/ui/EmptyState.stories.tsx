import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';
import { RetryButton } from './RetryButton';

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const TitleOnly: Story = { args: { title: 'your reading history will appear here' } };
export const WithDescription: Story = { args: { title: 'unable to load today\'s passage', description: 'check your connection and try again' } };
export const WithRetry: Story = {
  args: {
    title: 'something went wrong',
    description: 'we could not load your progress',
    action: <RetryButton onRetry={() => {}} />,
  },
};
