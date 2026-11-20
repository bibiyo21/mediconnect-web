'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  DEGRADED_NOTICE,
  NEAR_ME_RADIUS_KM,
  failureMessage,
  isAbort,
  latestOnly,
  pageUrl,
  searchDoctors,
  suggestSpecialties,
  suggestionLabel,
  type Coords,
  type DoctorResult,
  type Mode,
  type SearchFilters,
  type SearchPage,
  type SpecialtySuggestion,
  SearchFailed,
} from '@/lib/search';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

type Specialty = { id: string; name: string };
type Status = 'idle' | 'loading' | 'error';
type Result = { key: string; page: SearchPage | null; doctors: DoctorResult[]; error: unknown };

interface Props {
  apiUrl: string;
  specialties: Specialty[];
  initialFilters: SearchFilters;
  /** The first page, rendered on the server; null when the server could not reach search. */
  initialPage: SearchPage | null;
  /** Shown when the URL names a subspecialty (the server cannot know its label). */
  initialSubspecialtyName?: string | null;
}

/**
 * The search box, filters and results (increment 3.6). Without JavaScript the
 * form is a plain GET to /search. With it, typing is debounced (300 ms), each
 * new search aborts the previous one, the URL follows the filters (never the
 * location), and specialties are suggested as an ARIA combobox.
 */
export function DoctorSearch({ apiUrl, specialties, initialFilters, initialPage, initialSubspecialtyName = null }: Props) {
  const ids = { listbox: useId(), status: useId() };
  const [text, setText] = useState(initialFilters.q);
  const [cityText, setCityText] = useState(initialFilters.city);
  const [mode, setMode] = useState<Mode>(initialFilters.mode);
  const [specialty, setSpecialty] = useState(initialFilters.specialty);
  const [sub, setSub] = useState<{ id: string; name: string } | null>(initialFilters.subspecialty ? { id: initialFilters.subspecialty, name: initialSubspecialtyName ?? 'Selected subspecialty' } : null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);

  const [suggested, setSuggested] = useState<{ q: string; list: SpecialtySuggestion[] }>({ q: '', list: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Typing waits for the debounce; clearing a field applies at once.
  const typedQ = useDebouncedValue(text.trim());
  const typedCity = useDebouncedValue(cityText.trim());
  const q = text.trim() === '' ? '' : typedQ;
  const city = cityText.trim() === '' ? '' : typedCity;
  const [submitted, setSubmitted] = useState<{ q: string; city: string } | null>(null);
  const effective = submitted ?? { q, city };

  const filters = useMemo<SearchFilters>(
    () => ({ q: effective.q, city: effective.city, mode, specialty, subspecialty: specialty && sub ? sub.id : '' }),
    [effective.q, effective.city, mode, specialty, sub],
  );

  // Each result remembers the request it answers; status is derived, never set in an effect.
  const requestKey = JSON.stringify([filters, coords, retry]);
  const [result, setResult] = useState<Result>(() => ({
    key: requestKey,
    page: initialPage,
    doctors: initialPage?.doctors ?? [],
    error: initialPage ? null : new SearchFailed(503),
  }));
  const status: Status = result.key !== requestKey ? 'loading' : result.error ? 'error' : 'idle';
  const { page, doctors, error } = result;

  const searches = useRef(latestOnly());
  const suggests = useRef(latestOnly());
  const answered = result.key === requestKey;

  // The URL follows the filters (never the location), only when they change.
  const lastUrl = useRef(pageUrl(initialFilters));
  useEffect(() => {
    const next = pageUrl(filters);
    if (next === lastUrl.current) return;
    lastUrl.current = next;
    window.history.replaceState(window.history.state, '', next);
  }, [filters]);

  useEffect(() => {
    // Already answered (the server's first page, or a search that finished): any request still
    // in flight is for filters the patient has left, so abort it rather than let it land late.
    if (answered) {
      searches.current.cancel();
      return;
    }
    searches.current
      .run((signal) => searchDoctors(apiUrl, filters, { coords, signal }))
      .then((next) => setResult({ key: requestKey, page: next, doctors: next.doctors, error: null }))
      .catch((e) => {
        if (!isAbort(e)) setResult({ key: requestKey, page: null, doctors: [], error: e });
      });
  }, [answered, filters, coords, requestKey, apiUrl]);

  useEffect(() => () => {
    searches.current.cancel();
    suggests.current.cancel();
  }, []);

  // Specialty suggestions for the debounced text (combobox).
  const wantSuggestions = !specialty && q.length >= 2;
  useEffect(() => {
    if (!wantSuggestions) {
      suggests.current.cancel();
      return;
    }
    suggests.current
      .run((signal) => suggestSpecialties(apiUrl, q, signal))
      .then((list) => {
        setSuggested({ q, list });
        setActive(-1);
      })
      .catch((e) => {
        if (!isAbort(e)) setSuggested({ q, list: [] }); // suggestions are optional; search still works
      });
  }, [q, wantSuggestions, apiUrl]);

  const suggestions = wantSuggestions && suggested.q === q ? suggested.list : [];
  const showList = open && suggestions.length > 0;

  function choose(s: SpecialtySuggestion) {
    setSpecialty(s.specialty_id);
    setSub(s.kind === 'SUBSPECIALTY' ? { id: s.id, name: suggestionLabel(s) } : null);
    setText('');
    setSubmitted(null);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showList) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setOpen(false);
    setSubmitted({ q: text.trim(), city: cityText.trim() }); // search now, without waiting for the debounce
  }

  function nearMe() {
    setLocationError(null);
    if (!('geolocation' in navigator)) {
      setLocationError('Your browser cannot share its location. Search by city instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setLocating(false);
        setLocationError('We could not get your location. You can search by city instead.');
      },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  }

  async function loadMore(e: React.MouseEvent) {
    if (!page?.nextCursor) return;
    e.preventDefault();
    setLoadingMore(true);
    try {
      const key = requestKey;
      const next = await searches.current.run((signal) => searchDoctors(apiUrl, filters, { coords, cursor: page.nextCursor ?? undefined, signal }));
      setResult((r) => (r.key !== key ? r : { ...r, page: next, doctors: [...r.doctors, ...next.doctors.filter((d) => !r.doctors.some((x) => x.doctor_id === d.doctor_id))] }));
    } catch (err) {
      if (!isAbort(err)) setResult((r) => ({ ...r, error: err }));
    } finally {
      setLoadingMore(false);
    }
  }

  const typing = text.trim() !== effective.q || cityText.trim() !== effective.city;
  const busy = status === 'loading' || (typing && submitted === null);
  const found = page?.found ?? 0;
  const statusText = busy ? 'Searching…' : status === 'error' ? '' : found === 0 ? 'No doctors match. Try a different word, or remove a filter.' : `${found} ${found === 1 ? 'doctor' : 'doctors'} found${coords ? ` within ${NEAR_ME_RADIUS_KM} km` : ''}`;
  const nextHref = page?.nextCursor ? `${pageUrl(filters)}${pageUrl(filters).includes('?') ? '&' : '?'}cursor=${encodeURIComponent(page.nextCursor)}` : null;

  return (
    <>
      <form className="search-form" method="get" action="/search" role="search" aria-label="Search doctors" onSubmit={onSubmit}>
        <div className="search-form__query">
          <label htmlFor="search-q">Search</label>
          <div className="combobox">
            <input
              id="search-q"
              name="q"
              type="search"
              value={text}
              maxLength={100}
              autoComplete="off"
              placeholder="For example pedia, heart doctor or Dr. Santos"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showList}
              aria-controls={ids.listbox}
              aria-activedescendant={showList && active >= 0 ? `${ids.listbox}-${active}` : undefined}
              aria-describedby="search-q-hint"
              onChange={(e) => {
                setText(e.target.value);
                setSubmitted(null);
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
            />
            <ul id={ids.listbox} role="listbox" aria-label="Specialties" className="combobox__list" hidden={!showList}>
              {suggestions.map((s, i) => (
                <li
                  key={s.id}
                  id={`${ids.listbox}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="combobox__option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s)}
                >
                  <span>{suggestionLabel(s)}</span>
                  <span className="muted small">{s.doctor_count} {s.doctor_count === 1 ? 'doctor' : 'doctors'}</span>
                </li>
              ))}
            </ul>
          </div>
          <p id="search-q-hint" className="muted small">A name, specialty, condition, service or clinic. Specialty suggestions appear as you type.</p>
        </div>
        <div className="directory-filters search-form__filters">
          <label>
            Specialty
            <select
              name="specialty"
              value={specialty}
              onChange={(e) => {
                setSpecialty(e.target.value);
                setSub(null);
              }}
            >
              <option value="">Any specialty</option>
              {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>
            City
            <input name="city" value={cityText} onChange={(e) => { setCityText(e.target.value); setSubmitted(null); }} placeholder="For example Makati" autoComplete="address-level2" />
          </label>
          <label>
            Consultation
            <select name="mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="">In person or online</option>
              <option value="IN_PERSON">In person</option>
              <option value="ONLINE">Online</option>
            </select>
          </label>
          {specialty && sub ? <input type="hidden" name="subspecialty" value={sub.id} /> : null}
          <button className="button" type="submit">Search</button>
        </div>
      </form>

      {specialty && sub ? (
        <p className="search-chip">
          <span>Subspecialty: {sub.name}</span>
          <button type="button" className="button button--secondary" onClick={() => setSub(null)}>Remove subspecialty</button>
        </p>
      ) : null}

      <div className="near-me">
        {coords ? (
          <>
            <p className="small">Showing doctors within {NEAR_ME_RADIUS_KM} km of you, nearest first. Your location is used for this search only and is not saved.</p>
            <button type="button" className="button button--secondary" onClick={() => setCoords(null)}>Stop using my location</button>
          </>
        ) : (
          <button type="button" className="button button--secondary" onClick={nearMe} disabled={locating}>
            {locating ? 'Getting your location…' : 'Doctors near me'}
          </button>
        )}
        {locationError ? <p className="small" role="alert">{locationError}</p> : null}
      </div>

      {page?.degraded ? <p className="notice notice--warning" role="note">{DEGRADED_NOTICE}</p> : null}
      <p id={ids.status} className="search-status" role="status" aria-live="polite">{statusText}</p>
      {status === 'error' ? (
        <div className="notice notice--error" role="alert">
          <p>{failureMessage(error)}</p>
          <button type="button" className="button button--secondary" onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      ) : null}

      {doctors.length > 0 ? (
        <ul className="directory-list" aria-describedby={ids.status} aria-busy={busy}>
          {doctors.map((d) => <ResultCard key={d.doctor_id} doctor={d} />)}
        </ul>
      ) : null}

      {nextHref ? (
        <p className="page-links">
          <a className="button button--secondary" href={nextHref} onClick={loadMore} aria-disabled={loadingMore}>
            {loadingMore ? 'Loading more doctors…' : 'Show more doctors'}
          </a>
        </p>
      ) : null}
    </>
  );
}

function ResultCard({ doctor: d }: { doctor: DoctorResult }) {
  return (
    <li className="directory-card">
      <h2><Link href={`/doctors/${d.doctor_id}`}>{d.display_name}</Link></h2>
      <p className="muted">{[d.professional_title, d.specialties.join(', ')].filter(Boolean).join(' · ') || 'Doctor'}</p>
      {d.is_verified ? <p className="badge">PRC licence checked</p> : null}
      {d.locations.length > 0 ? (
        <p>
          {d.locations.map((l) => `${l.clinic_name}, ${l.city}${l.distance_km !== null ? ` (${l.distance_km.toFixed(1)} km away)` : ''}`).join(' · ')}
        </p>
      ) : null}
      {d.offers_online ? <p className="muted">Online consultations</p> : null}
      {d.fee_from ? <p>From <strong>{d.fee_from.formatted}</strong></p> : null}
    </li>
  );
}
