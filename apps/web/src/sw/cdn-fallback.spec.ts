import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchFromCDNWithFallback,
  getAvailableCDNs,
  getCDNStatusReport,
  markCDNFailure,
  resetCDNStatus,
  setCDNPreference,
} from './cdn-fallback';

describe('cdn-fallback', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T00:00:00.000Z'));
    resetCDNStatus();
    await setCDNPreference(null);
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'caches', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(async () => {
    await setCDNPreference(null);
    resetCDNStatus();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('uses persisted preference to reorder available CDNs for the current version', async () => {
    await setCDNPreference({
      cdn: 'unpkg',
      latency: 18,
      timestamp: Date.now(),
      version: '1.2.3',
    });

    expect(getAvailableCDNs('1.2.3').map((item) => item.name)).toEqual([
      'unpkg',
      'jsdelivr',
    ]);
    expect(getAvailableCDNs('9.9.9').map((item) => item.name)).toEqual([
      'jsdelivr',
      'unpkg',
    ]);
  });

  it('prefers the selected CDN when fetching static resources', async () => {
    await setCDNPreference({
      cdn: 'unpkg',
      latency: 12,
      timestamp: Date.now(),
      version: '2.0.0',
    });

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('unpkg.com')) {
          return new Response('console.log("ok");', {
            status: 200,
            headers: {
              'Content-Type': 'application/javascript',
              'Content-Length': '200',
            },
          });
        }

        return new Response('not-found', { status: 404 });
      });

    const result = await fetchFromCDNWithFallback(
      'assets/index.js',
      '2.0.0',
      'https://origin.example.com'
    );

    expect(result?.source).toBe('unpkg');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('unpkg.com');
  });

  it('falls back to origin when all CDNs fail', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.startsWith('https://origin.example.com/')) {
          return new Response('body { color: black; }', {
            status: 200,
            headers: {
              'Content-Type': 'text/css',
              'Content-Length': '120',
            },
          });
        }

        return new Response('missing', { status: 404 });
      });

    const result = await fetchFromCDNWithFallback(
      'assets/index.css',
      '3.0.0',
      'https://origin.example.com'
    );

    expect(result?.source).toBe('local');
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain(
      'https://origin.example.com/assets/index.css'
    );
  });

  it('drops unhealthy CDN from candidates after repeated failures', () => {
    markCDNFailure('jsdelivr', 'timeout');
    markCDNFailure('jsdelivr', 'timeout');
    markCDNFailure('jsdelivr', 'timeout');

    expect(getAvailableCDNs('1.0.0').map((item) => item.name)).toEqual([
      'unpkg',
    ]);
  });

  it('extends cooldown after consecutive failures for backup CDN', () => {
    markCDNFailure('unpkg', 'timeout');
    markCDNFailure('unpkg', 'timeout');
    markCDNFailure('unpkg', 'timeout');

    expect(getAvailableCDNs('1.0.0').map((item) => item.name)).toEqual([
      'jsdelivr',
    ]);

    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(getAvailableCDNs('1.0.0').map((item) => item.name)).toEqual([
      'jsdelivr',
    ]);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(getAvailableCDNs('1.0.0').map((item) => item.name)).toEqual([
      'jsdelivr',
      'unpkg',
    ]);

    markCDNFailure('unpkg', 'timeout');
    expect(getAvailableCDNs('1.0.0').map((item) => item.name)).toEqual([
      'jsdelivr',
    ]);

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(getAvailableCDNs('1.0.0').map((item) => item.name)).toEqual([
      'jsdelivr',
    ]);

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(getAvailableCDNs('1.0.0').map((item) => item.name)).toEqual([
      'jsdelivr',
      'unpkg',
    ]);
  });

  it('includes fail count and cooldown info in status report', () => {
    markCDNFailure('unpkg', 'timeout');
    markCDNFailure('unpkg', 'timeout');
    markCDNFailure('unpkg', 'timeout');

    const unpkgStatus = getCDNStatusReport().find((item) => item.name === 'unpkg');

    expect(unpkgStatus).toMatchObject({
      preferred: false,
      cooldownMs: 10 * 60 * 1000,
      cooldownUntil: Date.now() + 10 * 60 * 1000,
      remainingCooldownMs: 10 * 60 * 1000,
      status: {
        failCount: 3,
        isHealthy: false,
        lastFailureReason: 'timeout',
      },
    });
  });
});
