import type { Meta, StoryObj } from '@storybook/react';
import { RetryButton } from './RetryButton';

const meta: Meta<typeof RetryButton> = {
  title: 'UI/RetryButton',
  component: RetryButton,
  args: { onRetry: () => {} },
};
export default meta;
type Story = StoryObj<typeof RetryButton>;

export const Default: Story = {};
export const Retrying: Story = { args: { isRetrying: true } };
export const CustomLabel: Story = { args: { label: 'reload plan' } };
