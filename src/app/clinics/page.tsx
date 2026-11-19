import type { Metadata } from 'next';
import Link from 'next/link';
import { BookingNotice, DirectoryUnavailableNotice, PageLinks } from '@/components/Directory';
import { DirectoryUnavailable, listClinics, type PublicClinic } from '@/lib/directory';

export const metadata: Metadata = { title: 'Clinics', description: 'Clinics in the Philippines with their locations, hours and doctors.' };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function ClinicsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const city = one(params.city);
  const page = Math.max(1, Number(one(params.page)) || 1);

  let clinics: PublicClinic[] = [];
  let meta;
  let unavailable = false;
  try {
    ({ clinics, meta } = await listClinics({ page, city }));
  } catch (e) {
    if (!(e instanceof DirectoryUnavailable)) throw e;
    unavailable = true;
  }

  return (
    <>
      <h1>Clinics</h1>
      <p className="lead">Clinics on MediConnect, with their branches, opening hours and doctors.</p>
      <BookingNotice />
      <form className="directory-filters" method="get" action="/clinics" role="search" aria-label="Filter clinics">
        <label>
          City
          <input name="city" defaultValue={city ?? ''} placeholder="For example Makati" />
        </label>
        <button className="button" type="submit">Show clinics</button>
      </form>
      {unavailable ? <DirectoryUnavailableNotice /> : null}
      {!unavailable && clinics.length === 0 ? <p className="empty">No clinics match yet.</p> : null}
      {clinics.length > 0 ? (
        <ul className="directory-list">
          {clinics.map((c) => (
            <li key={c.id} className="directory-card">
              <h2><Link href={`/clinics/${c.id}`}>{c.name}</Link></h2>
              <p className="muted">{c.locations.map((l) => `${l.name}, ${l.city}`).join(' · ')}</p>
              {c.description ? <p>{c.description}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <PageLinks meta={meta} basePath="/clinics" query={{ city }} />
    </>
  );
}
