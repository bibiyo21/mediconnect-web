import type { components, paths } from '@mediconnect/api-types';

/**
 * Doctor search (increment 3.6): GET /search/doctors and GET /search/specialties.
 * Used by the server for the first page and by the browser while typing.
 * Results are advisory; booking revalidates against PostgreSQL in later phases (§11.6).
 */
export type DoctorResult = components['schemas']['DoctorSearchResultResource'];
export type SpecialtySuggestion = components['schemas']['SpecialtySuggestionResource'];
type DoctorQuery = NonNullable<paths['/search/doctors']['get']['parameters']['query']>;

export type Mode = '' | 'IN_PERSON' | 'ONLINE';
export type Coords = { lat: number; lng: number };

export interface SearchFilters {
  q: string;
  city: string;
  mode: Mode;
  specialty: string;
  subspecialty: string;
}

export interface SearchPage {
  doctors: DoctorResult[];
  found: number;
  nextCursor: string | null;
  degraded: boolean;
}

/** Radius for "near me" (D-43). */
export const NEAR_ME_RADIUS_KM = 25;

export const emptyFilters: SearchFilters = { q: '', city: '', mode: '', specialty: '', subspecialty: '' };

const one = (v: string | string[] | null | undefined) => ((Array.isArray(v) ? v[0] : v) ?? '').trim();

/** Filters from a page URL. Coordinates are never read from or written to the URL. */
export function filtersFromParams(params: Record<string, string | string[] | undefined>): SearchFilters {
  const mode = one(params.mode);
  return {
    q: one(params.q).slice(0, 100),
    city: one(params.city),
    mode: mode === 'IN_PERSON' || mode === 'ONLINE' ? mode : '',
    specialty: one(params.specialty),
    subspecialty: one(params.subspecialty),
  };
}

/** The shareable page URL for a set of filters (no coordinates, no cursor). */
export function pageUrl(filters: SearchFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const query = params.toString();
  return query ? `/search?${query}` : '/search';
}

/** The API query: blank values left out; coordinates only when the patient chose "near me". */
export function apiQuery(filters: SearchFilters, options: { cursor?: string; coords?: Coords | null } = {}): DoctorQuery {
  const query: DoctorQuery = {};
  if (filters.q) query.q = filters.q.slice(0, 100);
  if (filters.city.length >= 2) query.city = filters.city;
  if (filters.mode) query.consultation_type = filters.mode;
  if (filters.specialty) query.specialty = filters.specialty;
  if (filters.specialty && filters.subspecialty) query.subspecialty = filters.subspecialty;
  if (options.coords) {
    query.lat = Number(options.coords.lat.toFixed(3));
    query.lng = Number(options.coords.lng.toFixed(3));
    query.radius_km = NEAR_ME_RADIUS_KM;
    query.sort = 'distance';
  }
  if (options.cursor) query.cursor = options.cursor;
  return query;
}

export class SearchFailed extends Error {
  constructor(readonly status: number) {
    super(`Search answered ${status}.`);
  }
}

function url(base: string, path: string, query: Record<string, string | number | boolean | null | undefined>): URL {
  const u = new URL(base.replace(/\/$/, '') + path);
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  return u;
}

async function getJson(target: URL, init: RequestInit): Promise<{ data: unknown; meta: unknown }> {
  let response: Response;
  try {
    response = await fetch(target, { ...init, headers: { Accept: 'application/json' }, credentials: 'omit' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new SearchFailed(0);
  }
  if (!response.ok) throw new SearchFailed(response.status);
  return (await response.json()) as { data: unknown; meta: unknown };
}

/** meta is typed loosely by the generator (`string | {...}`); read only what we need. */
function readMeta(meta: unknown): Omit<SearchPage, 'doctors'> {
  const m = typeof meta === 'object' && meta !== null ? (meta as Record<string, unknown>) : {};
  return { found: Number(m.found ?? 0) || 0, nextCursor: typeof m.next_cursor === 'string' ? m.next_cursor : null, degraded: m.degraded === true };
}

export async function searchDoctors(base: string, filters: SearchFilters, options: { cursor?: string; coords?: Coords | null; signal?: AbortSignal; server?: boolean } = {}): Promise<SearchPage> {
  // Free-text queries are not cached by Next on the server: the keys are unbounded (the API caches in Redis).
  const body = await getJson(url(base, '/search/doctors', apiQuery(filters, options)), { signal: options.signal, ...(options.server ? { cache: 'no-store' as const } : {}) });
  return { doctors: (body.data as DoctorResult[]) ?? [], ...readMeta(body.meta) };
}

export async function suggestSpecialties(base: string, q: string, signal?: AbortSignal): Promise<SpecialtySuggestion[]> {
  const body = await getJson(url(base, '/search/specialties', { q: q.trim(), limit: 6 }), { signal });
  return (body.data as SpecialtySuggestion[]) ?? [];
}

export const suggestionLabel = (s: SpecialtySuggestion) => (s.kind === 'SUBSPECIALTY' && s.parent_name ? `${s.name} (${s.parent_name})` : s.name);

/** What the patient sees when a search fails: never raw server detail. */
export function failureMessage(error: unknown): string {
  if (error instanceof SearchFailed && error.status === 429) return 'You searched very quickly. Wait a moment, then try again.';
  if (error instanceof SearchFailed && error.status === 0) return 'We could not reach MediConnect. Check your connection and try again.';
  return 'Search is not working right now. Please try again in a moment.';
}

export const DEGRADED_NOTICE = 'Search is running in a simpler mode right now, so results may be less complete. Check spelling, or try again in a few minutes.';

/**
 * Runs one request at a time: starting a new one aborts the one before, so a
 * slow, stale answer can never replace a newer one.
 */
export function latestOnly() {
  let current: AbortController | null = null;
  return {
    run<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T> {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      return task(controller.signal);
    },
    cancel() {
      current?.abort();
      current = null;
    },
  };
}

export const isAbort = (e: unknown) => (e as Error | undefined)?.name === 'AbortError';
