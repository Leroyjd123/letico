import type { Meta, StoryObj } from '@storybook/react';
import { ChapterTile } from './ChapterTile';

const meta: Meta<typeof ChapterTile> = {
  title: 'Reader/ChapterTile',
  component: ChapterTile,
  args: { chapterNumber: 12, onTap: () => {}, onLongPress: () => {} },
  decorators: [(Story) => <div style={{ width: 80, height: 80 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof ChapterTile>;

export const Read: Story = { args: { readState: 'read' } };
export const Partial: Story = { args: { readState: 'partial' } };
export const Unread: Story = { args: { readState: 'unread' } };
export const Locked: Story = { args: { readState: 'locked' } };
