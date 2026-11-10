import type { Meta, StoryObj } from '@storybook/react';
import { ContinuePill } from './ContinuePill';

const meta: Meta<typeof ContinuePill> = {
  title: 'Reader/ContinuePill',
  component: ContinuePill,
  args: { isLoading: false },
};
export default meta;
type Story = StoryObj<typeof ContinuePill>;

export const WithPosition: Story = {
  args: {
    position: { bookUsfm: 'GEN', bookName: 'Genesis', chapterNumber: 12, verseNumber: 1, verseId: 300 },
  },
};
export const Finished: Story = { args: { position: null } };
export const Loading: Story = { args: { position: null, isLoading: true } };
