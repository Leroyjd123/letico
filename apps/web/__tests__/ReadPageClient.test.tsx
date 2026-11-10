import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PlanDayView } from '@lectio/types';
import { ReadPageClient } from '../app/read/ReadPageClient';

// ── Network + platform mocks (everything else is real) ──────────────────────
const api = {
  getMe: jest.fn(),
  getPlanToday: jest.fn(),
  getPlanDay: jest.fn(),
  updateUser: jest.fn(),
  getContinuePosition: jest.fn(),
};
jest.mock('../lib/api', () => ({
  getMe: (...a: unknown[]) => api.getMe(...a),
  getPlanToday: (...a: unknown[]) => api.getPlanToday(...a),
  getPlanDay: (...a: unknown[]) => api.getPlanDay(...a),
  updateUser: (...a: unknown[]) => api.updateUser(...a),
  getContinuePosition: (...a: unknown[]) => api.getContinuePosition(...a),
}));

const enqueue = jest.fn().mockResolvedValue({ id: 1, dropped: false });
jest.mock('../lib/offlineQueue', () => ({ enqueue: (...a: unknown[]) => enqueue(...a) }));

const flush = jest.fn().mockResolvedValue(undefined);
const auth = { type: 'guest' as const, guestToken: 'guest-1' };
jest.mock('../components/providers/AuthProvider', () => ({
  useAuthContext: () => ({
    auth,
    userKey: 'g:guest-1',
    isProvisioning: false,
    provisionFailed: false,
    retryProvision: jest.fn(),
  }),
  useSync: () => ({ hasPermanentFailure: false, flush }),
}));

let search = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => search }));

// ── Fixture: a day that crosses a book boundary ─────────────────────────────
function crossBookDay(overrides: Partial<PlanDayView> = {}): PlanDayView {
  return {
    planId: 'plan-1',
    dayNumber: 52,
    totalDays: 365,
    label: 'deuteronomy 34 · matthew 1',
    book: 'DEU',
    chapter: 34,
    startVerse: 1,
    endVerse: 3,
    startVerseId: 100,
    endVerseId: 105,
    totalVerses: 6,
    versesRead: 3,
    isToday: true,
    offsetFromToday: 0,
    chapters: [
      { chapterId: 34, chapterNumber: 34, book: 'DEU', bookName: 'Deuteronomy',
        verseIds: [100, 101, 102], verseNumbers: [1, 2, 3], readVerseIds: [100, 101, 102] },
      { chapterId: 900, chapterNumber: 1, book: 'MAT', bookName: 'Matthew',
        verseIds: [103, 104, 105], verseNumbers: [1, 2, 3], readVerseIds: [] },
    ],
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReadPageClient />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  search = new URLSearchParams();
  api.getMe.mockResolvedValue({ id: 'u', planId: 'plan-1', planStartDate: '2026-01-01' });
  api.getPlanToday.mockResolvedValue(crossBookDay());
  api.getPlanDay.mockResolvedValue(crossBookDay({ dayNumber: 10, isToday: false, offsetFromToday: -42 }));
  api.getContinuePosition.mockResolvedValue({
    bookUsfm: 'MAT', bookName: 'Matthew', chapterNumber: 1, verseNumber: 1, verseId: 103,
  });
});

describe('ReadPageClient', () => {
  it('shows every chapter of the day, including the second book', async () => {
    renderPage();
    expect(await screen.findByRole('group', { name: /deuteronomy chapters/i })).toBeInTheDocument();
    const matthew = screen.getByRole('group', { name: /matthew chapters/i });
    expect(within(matthew).getByRole('button', { name: /matthew 1, unread/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deuteronomy 34, read/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '50% complete' })).toBeInTheDocument();
  });

  it('marks a chapter read instantly (optimistic) and queues only its unread verses', async () => {
    renderPage();
    const tile = await screen.findByRole('button', { name: /matthew 1, unread/i });
    await userEvent.click(tile);
    expect(await screen.findByRole('button', { name: /matthew 1, read/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '100% complete' })).toBeInTheDocument();
    await waitFor(() => expect(enqueue).toHaveBeenCalledWith('mark', [103, 104, 105]));
    expect(flush).toHaveBeenCalled();
  });

  it('works from the keyboard (Enter on a tile)', async () => {
    renderPage();
    const tile = await screen.findByRole('button', { name: /matthew 1, unread/i });
    tile.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(enqueue).toHaveBeenCalledWith('mark', [103, 104, 105]));
  });

  it('tapping a read chapter undoes it', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /deuteronomy 34, read/i }));
    await waitFor(() => expect(enqueue).toHaveBeenCalledWith('unmark', [100, 101, 102]));
    expect(await screen.findByRole('button', { name: /deuteronomy 34, unread/i })).toBeInTheDocument();
  });

  it('"mark day complete" marks only this day\'s unread verses', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /mark day 52 complete/i }));
    await waitFor(() => expect(enqueue).toHaveBeenCalledWith('mark', [103, 104, 105]));
  });

  it('opens jw.org at the first unfinished chapter', async () => {
    renderPage();
    const link = await screen.findByRole('link', { name: /open matthew 1 in jw.org/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('bible=40001'));
  });

  it('honours ?day=N from the plan list', async () => {
    search = new URLSearchParams('day=10');
    renderPage();
    expect(await screen.findByText(/day 10 of 365/i)).toBeInTheDocument();
    expect(api.getPlanDay).toHaveBeenCalledWith('plan-1', 10, auth);
    expect(api.getPlanToday).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /back to today/i })).toHaveAttribute('href', '/read');
  });

  it('asks for a start date and can start today', async () => {
    api.getMe.mockResolvedValue({ id: 'u', planId: 'plan-1', planStartDate: null });
    api.updateUser.mockResolvedValue({ planId: 'plan-1', planStartDate: '2026-11-10' });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /start today/i }));
    await waitFor(() =>
      expect(api.updateUser).toHaveBeenCalledWith(
        { planStartDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
        auth,
      ),
    );
  });

  it('does not ask for a start date once one is set', async () => {
    renderPage();
    await screen.findByText(/day 52 of 365/i);
    expect(screen.queryByRole('button', { name: /start today/i })).not.toBeInTheDocument();
  });

  it('shows a retry instead of spinning forever when the day fails to load', async () => {
    api.getPlanToday.mockRejectedValue(new Error('down'));
    renderPage();
    expect(await screen.findByText(/this reading couldn.t load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
