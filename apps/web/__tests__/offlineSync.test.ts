import { isTransient } from '../hooks/useOfflineQueue';
import { ApiError } from '../lib/api';

jest.mock('../lib/supabase', () => ({}));

describe('offline sync error classification', () => {
  it('retries network failures, 5xx, 401, 408 and 429', () => {
    expect(isTransient(new TypeError('Failed to fetch'))).toBe(true);
    for (const status of [500, 502, 503, 401, 408, 429]) {
      expect(isTransient(new ApiError('X', status, 'x'))).toBe(true);
    }
  });

  it('drops requests the server rejects outright so they cannot block the queue', () => {
    for (const status of [400, 403, 404, 422]) {
      expect(isTransient(new ApiError('X', status, 'x'))).toBe(false);
    }
  });
});
