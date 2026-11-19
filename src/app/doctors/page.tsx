import type { Metadata } from 'next';
import Link from 'next/link';
import { BookingNotice, DirectoryUnavailableNotice, PageLinks } from '@/components/Directory';
import { DirectoryUnavailable, listDoctors, listSpecialties, type PublicDoctor } from '@/lib/directory';

export const metadata: Metadata = {
  title: 'Doctors',
  description: 'Browse doctors in the Philippines whose PRC licence was checked by MediConnect.',
};

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function DoctorsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const city = one(params.city);
  const specialty = one(params.specialty);
  const mode = one(params.mode);
  const page = Math.max(1, Number(one(params.page)) || 1);

  let doctors: PublicDoctor[] = [];
  let meta;
  let specialties: Awaited<ReturnType<typeof listSpecialties>> = [];
  let unavailable = false;
  try {
    [{ doctors, meta }, specialties] = await Promise.all([listDoctors({ page, city, specialty_id: specialty, consultation_type: mode }), listSpecialties()]);
  } catch (e) {
    if (!(e instanceof DirectoryUnavailable)) throw e;
    unavailable = true;
  }

  return (
    <>
      <h1>Doctors</h1>
      <p className="lead">Every doctor listed here had their PRC licence and documents checked by a MediConnect reviewer.</p>
      <BookingNotice />
      <form className="directory-filters" method="get" action="/doctors" role="search" aria-label="Filter doctors">
        <label>
          Specialty
          <select name="specialty" defaultValue={specialty ?? ''}>
            <option value="">Any specialty</option>
            {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>
          City
          <input name="city" defaultValue={city ?? ''} placeholder="For example Makati" />
        </label>
        <label>
          Consultation
          <select name="mode" defaultValue={mode ?? ''}>
            <option value="">In person or online</option>
            <option value="IN_PERSON">In person</option>
            <option value="ONLINE">Online</option>
          </select>
        </label>
        <button className="button" type="submit">Show doctors</button>
      </form>

      {unavailable ? <DirectoryUnavailableNotice /> : null}
      {!unavailable && doctors.length === 0 ? <p className="empty">No doctors match these filters yet.</p> : null}
      {doctors.length > 0 ? (
        <ul className="directory-list">
          {doctors.map((d) => (
            <li key={d.id} className="directory-card">
              <h2><Link href={`/doctors/${d.id}`}>{d.display_name}</Link></h2>
              <p className="muted">{[d.professional_title, d.primary_specialty].filter(Boolean).join(' · ') || 'Doctor'}</p>
              {d.licence_verified ? <p className="badge">PRC licence checked</p> : null}
              {d.practice_locations.length > 0 ? <p>{d.practice_locations.map((l) => `${l.clinic_name}, ${l.city}`).join(' · ')}</p> : <p className="muted">Online consultations</p>}
            </li>
          ))}
        </ul>
      ) : null}
      <PageLinks meta={meta} basePath="/doctors" query={{ city, specialty, mode }} />
    </>
  );
}
