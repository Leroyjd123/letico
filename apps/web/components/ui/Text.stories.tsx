import type { Meta, StoryObj } from '@storybook/react';
import { Text } from './Text';

const meta: Meta<typeof Text> = {
  title: 'UI/Text',
  component: Text,
  args: { children: 'sample text' },
};
export default meta;
type Story = StoryObj<typeof Text>;

export const Display: Story = { args: { variant: 'display', children: 'lectio' } };
export const Heading: Story = { args: { variant: 'heading', children: 'reading plan' } };
export const Subheading: Story = { args: { variant: 'subheading', children: 'genesis 1' } };
export const Body: Story = { args: { variant: 'body', children: 'your daily bible reading companion' } };
export const Label: Story = { args: { variant: 'label', children: 'day 42' } };
export const Caption: Story = { args: { variant: 'caption', color: 'muted', children: 'march 30, 2026' } };
export const Muted: Story = { args: { variant: 'body', color: 'muted', children: 'no reads yet' } };
