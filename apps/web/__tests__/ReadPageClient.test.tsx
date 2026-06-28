'use client';

import { render, screen } from '@testing-library/react';
import { ReadPageClient } from '../app/read/ReadPageClient';

const mockUseQuery = jest.fn();
const mockUseAuthContext = jest.fn();
const mockUseOfflineQueue = jest.fn();
const mockUseVerseRead = jest.fn();
const mockUseContinueReading = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
}));

jest.mock('../components/providers/AuthProvider', () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock('../hooks/useOfflineQueue', () => ({
  useOfflineQueue: (...args: unknown[]) => mockUseOfflineQueue(...args),
}));

jest.mock('../hooks/useVerseRead', () => ({
  useVerseRead: (...args: unknown[]) => mockUseVerseRead(...args),
}));

jest.mock('../hooks/useContinueReading', () => ({
  useContinueReading: (...args: unknown[]) => mockUseContinueReading(...args),
}));

jest.mock('../components/reader/TodayCard', () => ({
  TodayCard: () => <div>today card</div>,
}));

jest.mock('../components/reader/ChapterGrid', () => ({
  ChapterGrid: () => <div>chapter grid</div>,
}));

jest.mock('../components/modals/VerseSelectorModal', () => ({
  VerseSelectorModal: () => <div>verse modal</div>,
}));

jest.mock('../components/reader/OpenInJWButton', () => ({
  OpenInJWButton: () => <div>open jw</div>,
}));

jest.mock('../components/reader/ContinuePill', () => ({
  ContinuePill: () => null,
}));

jest.mock('../components/reader/GuestBackupNudge', () => ({
  GuestBackupNudge: () => <div>guest backup</div>,
  shouldShowNudge: () => false,
}));

describe('ReadPageClient', () => {
  const auth = { type: 'bearer' as const, token: 'token-12345678' };
  const planDay = {
    dayNumber: 4,
    label: 'genesis 1-2',
    book: 'GEN',
    chapter: 1,
    startVerseId: 1,
    endVerseId: 10,
    startVerse: 1,
    endVerse: 10,
  };
  const chapters = [{ id: 1, number: 1, verseCount: 31 }];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthContext.mockReturnValue({ auth, isProvisioning: false });
    mockUseOfflineQueue.mockReturnValue({ hasPermanentFailure: false });
    mockUseVerseRead.mockReturnValue({
      markChapter: jest.fn(),
      markDayComplete: jest.fn(),
    });
    mockUseContinueReading.mockReturnValue(null);
  });

  function primeQueries(meResult: { planStartDate: string | null } | null) {
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'me') {
        return { data: meResult };
      }

      if (queryKey[0] === 'plan') {
        return { data: planDay, isLoading: false };
      }

      if (queryKey[0] === 'bible' && queryKey[1] === 'chapters') {
        return { data: chapters };
      }

      if (queryKey[0] === 'progress') {
        return { data: [] };
      }

      return { data: undefined };
    });
  }

  it('shows the start-date nudge when the profile is missing a planStartDate', () => {
    primeQueries({ planStartDate: null });

    render(<ReadPageClient />);

    expect(
      screen.getByRole('link', {
        name: /set your reading start date in settings to track your plan progress/i,
      }),
    ).toHaveAttribute('href', '/settings');
  });

  it('does not show the start-date nudge once the user has set a planStartDate', () => {
    primeQueries({ planStartDate: '2026-04-01' });

    render(<ReadPageClient />);

    expect(
      screen.queryByRole('link', {
        name: /set your reading start date in settings to track your plan progress/i,
      }),
    ).not.toBeInTheDocument();
  });
});
