import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorSearch } from '@/components/DoctorSearch';
import { apiQuery, emptyFilters, filtersFromParams, latestOnly, pageUrl } from '@/lib/search';

describe('latestOnly', () => {
  it('aborts the request before when a new one starts', async () => {
    const runner = latestOnly();
    const signals: AbortSignal[] = [];
    void runner.run(async (s) => signals.push(s));
    void runner.run(async (s) => signals.push(s));
    expect(signals.map((s) => s.aborted)).toEqual([true, false]);
    runner.cancel();
    expect(signals[1].aborted).toBe(true);
  });
});

describe('search query and URL', () => {
  it('reads only known filters from the URL and never coordinates', () => {
    const f = filtersFromParams({ q: '  pedia ', mode: 'TELEPATHY', lat: '14.5', city: 'Makati' });
    expect(f).toEqual({ ...emptyFilters, q: 'pedia', city: 'Makati' });
    expect(pageUrl(f)).toBe('/search?q=pedia&city=Makati');
  });

  it('sends coordinates only for "near me", rounded to about 100 m', () => {
    expect(apiQuery({ ...emptyFilters, subspecialty: 'orphan' })).toEqual({}); // a subspecialty needs its specialty
    expect(apiQuery(emptyFilters, { coords: { lat: 14.55471, lng: 121.02441 } })).toEqual({ lat: 14.555, lng: 121.024, radius_km: 25, sort: 'distance' });
  });
});

const page = { doctors: [], found: 0, nextCursor: null, degraded: false };
const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('DoctorSearch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn(async () => reply({ success: true, data: [], meta: { found: 0, next_cursor: null, degraded: false } }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const urls = () => fetchMock.mock.calls.map(([u]) => new URL(String(u))).filter((u) => u.pathname.endsWith('/search/doctors'));

  it('does not repeat the server-rendered search, then sends one request per pause in typing', async () => {
    render(<DoctorSearch apiUrl="https://api.test/api/v1" specialties={[]} initialFilters={emptyFilters} initialPage={page} />);
    expect(urls()).toEqual([]);
    const field = screen.getByRole('combobox', { name: 'Search' });
    for (const value of ['r', 're', 'rey', 'reyes']) {
      fireEvent.change(field, { target: { value } });
      await act(async () => vi.advanceTimersByTime(100));
    }
    await act(async () => vi.advanceTimersByTime(300));
    expect(urls().map((u) => u.searchParams.get('q'))).toEqual(['reyes']);
  });

  it('uses the location only after the patient asks, keeps it out of the URL, and stops on request', async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) => ok({ coords: { latitude: 14.55471, longitude: 121.02441 } } as GeolocationPosition));
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
    render(<DoctorSearch apiUrl="https://api.test/api/v1" specialties={[]} initialFilters={emptyFilters} initialPage={page} />);
    expect(getCurrentPosition).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Doctors near me' })));
    const near = urls().at(-1)!;
    expect([near.searchParams.get('lat'), near.searchParams.get('lng'), near.searchParams.get('sort')]).toEqual(['14.555', '121.024', 'distance']);
    expect(window.location.href).not.toContain('14.5');
    expect(screen.getByText(/is not saved/)).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stop using my location' })));
    expect(urls().at(-1)!.searchParams.has('lat')).toBe(false);
  });
});
