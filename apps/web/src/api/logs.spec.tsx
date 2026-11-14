import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '../test/test-utils.js';
import { useCreateLog, useDeleteLog, useUpdateLog } from './logs.js';

const STATS_KEY = ['logs', 'stats', '2026-11'];

function setup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(STATS_KEY, {
    month: '2026-11',
    totalThisMonth: 1,
    totalAllTime: 1,
    loggedDates: ['2026-11-02'],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const isStatsInvalidated = () =>
    queryClient.getQueryState(STATS_KEY)?.isInvalidated ?? false;
  return { wrapper, isStatsInvalidated };
}

function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status, json: async () => body }),
  );
}

describe('Invalidasi query stats setelah mutasi logbook', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('membuat logbook meng-invalidasi stats', async () => {
    stubFetch({ id: 'log-1' }, 201);
    const { wrapper, isStatsInvalidated } = setup();
    const { result } = renderHook(() => useCreateLog(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ date: '2026-11-03', description: 'Tes' }),
    );

    expect(isStatsInvalidated()).toBe(true);
  });

  it('mengubah logbook meng-invalidasi stats', async () => {
    stubFetch({ id: 'log-1' });
    const { wrapper, isStatsInvalidated } = setup();
    const { result } = renderHook(() => useUpdateLog('log-1'), { wrapper });

    await act(() => result.current.mutateAsync({ date: '2026-11-04' }));

    expect(isStatsInvalidated()).toBe(true);
  });

  it('menghapus logbook meng-invalidasi stats', async () => {
    stubFetch(undefined, 204);
    const { wrapper, isStatsInvalidated } = setup();
    const { result } = renderHook(() => useDeleteLog(), { wrapper });

    await act(() => result.current.mutateAsync('log-1'));

    expect(isStatsInvalidated()).toBe(true);
  });
});
