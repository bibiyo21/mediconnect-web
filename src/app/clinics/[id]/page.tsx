import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingNotice, DirectoryUnavailableNotice } from '@/components/Directory';
import { DAYS, DirectoryUnavailable, getClinic, getClinicDoctors, isUuid } from '@/lib/directory';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const clinic = isUuid(id) ? await getClinic(id).catch(() => null) : null;
  return clinic ? { title: clinic.name, description: clinic.description ?? clinic.locations.map((l) => l.city).join(', ') } : { title: 'Clinic' };
}

export default async function ClinicPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  let clinic;
  let doctors: Awaited<ReturnType<typeof getClinicDoctors>> = [];
  try {
    [clinic, doctors] = await Promise.all([getClinic(id), getClinicDoctors(id)]);
  } catch (e) {
    if (!(e instanceof DirectoryUnavailable)) throw e;
    return (<><h1>Clinic</h1><DirectoryUnavailableNotice /></>);
  }
  if (!clinic) notFound();
  const closures = (clinic as { upcoming_closures?: { clinic_location_id: string | null; date: string; name: string; is_closed: boolean; special_opens_at: string | null; special_closes_at: string | null }[] }).upcoming_closures ?? [];

  return (
    <>
      <p><Link href="/clinics">← All clinics</Link></p>
      <h1>{clinic.name}</h1>
      <p className="lead">{clinic.description ?? clinic.organization_name}</p>
      <BookingNotice />

      {clinic.locations.map((l) => {
        const byDay = DAYS.map((day, i) => ({ day, ranges: l.operating_hours.filter((h) => h.day_of_week === i + 1).map((h) => `${h.opens_at}–${h.closes_at}`) }));
        const here = doctors.filter((d) => d.location_ids.includes(l.id));
        return (
          <section key={l.id} className="detail-section" aria-labelledby={`loc-${l.id}`}>
            <h2 id={`loc-${l.id}`}>{l.name}</h2>
            <p>{[l.address_line1, l.address_line2, l.barangay, l.city, l.province].filter(Boolean).join(', ')}</p>
            {l.phone ? <p>Phone: <a href={`tel:${l.phone}`}>{l.phone}</a></p> : null}
            <h3>Opening hours</h3>
            <dl className="facts">
              {byDay.map((d) => (<div key={d.day} className="facts__row"><dt>{d.day}</dt><dd>{d.ranges.length ? d.ranges.join(', ') : 'Closed'}</dd></div>))}
            </dl>
            {l.services.length > 0 ? (<><h3>Clinic services</h3><p>{l.services.map((s) => s.name).join(' · ')}</p></>) : null}
            <h3>Doctors here</h3>
            {here.length === 0 ? <p className="muted">No doctors listed at this branch yet.</p> : (
              <ul className="plain-list">
                {here.map((d) => <li key={d.id}><Link href={`/doctors/${d.id}`}>{d.display_name}</Link>{d.primary_specialty ? <span className="muted"> · {d.primary_specialty}</span> : null}</li>)}
              </ul>
            )}
          </section>
        );
      })}

      {closures.length > 0 ? (
        <section className="detail-section" aria-labelledby="closures">
          <h2 id="closures">Upcoming closures and special hours</h2>
          <ul className="plain-list">
            {closures.map((c) => <li key={`${c.date}-${c.name}`}>{c.date} · {c.name} · {c.is_closed ? 'Closed' : `${c.special_opens_at}–${c.special_closes_at}`}</li>)}
          </ul>
        </section>
      ) : null}
    </>
  );
}
