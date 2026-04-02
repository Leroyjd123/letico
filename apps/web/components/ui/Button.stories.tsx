import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  args: { children: 'mark day complete' },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'open in jw.org' } };
export const TextVariant: Story = { args: { variant: 'text', children: 'cancel' } };
export const Disabled: Story = { args: { variant: 'primary', disabled: true } };
export const FullWidth: Story = { args: { variant: 'primary', fullWidth: true } };
