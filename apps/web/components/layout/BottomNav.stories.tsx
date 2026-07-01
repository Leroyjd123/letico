import type { Meta, StoryObj } from '@storybook/react';
import { BottomNav } from './BottomNav';

// @storybook/nextjs automatically mocks next/navigation.
// Override usePathname via the nextjs parameter to simulate different active tabs.

const meta: Meta<typeof BottomNav> = {
  title: 'Layout/BottomNav',
  component: BottomNav,
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;
type Story = StoryObj<typeof BottomNav>;

export const ReadActive: Story = {
  parameters: {
    nextjs: { navigation: { pathname: '/read' } },
  },
};

export const PlanActive: Story = {
  parameters: {
    nextjs: { navigation: { pathname: '/plan' } },
  },
};

export const AnalyticsActive: Story = {
  parameters: {
    nextjs: { navigation: { pathname: '/analytics' } },
  },
};

export const SettingsActive: Story = {
  parameters: {
    nextjs: { navigation: { pathname: '/settings' } },
  },
};

export const HiddenOnLogin: Story = {
  parameters: {
    nextjs: { navigation: { pathname: '/login' } },
  },
};
