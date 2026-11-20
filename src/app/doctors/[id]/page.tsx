import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingNotice, DirectoryUnavailableNotice } from '@/components/Directory';
import { DirectoryUnavailable, getDoctor, getDoctorServices, isUuid, languageName } from '@/lib/directory';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const doctor = isUuid(id) ? await getDoctor(id).catch(() => null) : null;
  if (!doctor) return { title: 'Doctor' };
  return { title: doctor.display_name, description: [doctor.primary_specialty, ...doctor.practice_locations.map((l) => l.city)].filter(Boolean).join(' · ') || undefined };
}

export default async function DoctorPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  let doctor;
  let services: Awaited<ReturnType<typeof getDoctorServices>> = [];
  try {
    [doctor, services] = await Promise.all([getDoctor(id), getDoctorServices(id)]);
  } catch (e) {
    if (!(e instanceof DirectoryUnavailable)) throw e;
    return (<><h1>Doctor</h1><DirectoryUnavailableNotice /></>);
  }
  if (!doctor) notFound();

  const online = services.filter((s) => s.consultation_type === 'ONLINE');
  return (
    <>
      <p><Link href="/search">← Find a doctor</Link></p>
      <h1>{doctor.display_name}</h1>
      <p className="lead">{[doctor.professional_title, doctor.primary_specialty].filter(Boolean).join(' · ')}</p>
      {doctor.licence_verified ? <p className="badge">PRC licence checked by MediConnect</p> : null}
      <BookingNotice />

      <section className="detail-section" aria-labelledby="about">
        <h2 id="about">About</h2>
        {doctor.biography ? <p>{doctor.biography}</p> : <p className="muted">No biography yet.</p>}
        <dl className="facts">
          {doctor.specialties.length > 0 ? (<><dt>Specialties</dt><dd>{doctor.specialties.map((s) => `${s.name}${s.subspecialty ? ` (${s.subspecialty})` : ''}${s.board_certified ? ', board certified' : ''}`).join('; ')}</dd></>) : null}
          {doctor.languages.length > 0 ? (<><dt>Languages</dt><dd>{doctor.languages.map(languageName).join(', ')}</dd></>) : null}
          {doctor.years_experience !== null && doctor.years_experience !== undefined ? (<><dt>Experience</dt><dd>{doctor.years_experience} years</dd></>) : null}
          {doctor.medical_school ? (<><dt>Medical school</dt><dd>{doctor.medical_school}</dd></>) : null}
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="where">
        <h2 id="where">Where to see {doctor.display_name}</h2>
        {doctor.practice_locations.length === 0 && online.length === 0 ? <p className="muted">No clinics or services listed yet.</p> : null}
        <ul className="directory-list">
          {doctor.practice_locations.map((l) => {
            const here = services.filter((s) => s.clinic_location_id === l.clinic_location_id);
            return (
              <li key={l.clinic_location_id} className="directory-card">
                <h3><Link href={`/clinics/${l.clinic_id}`}>{l.clinic_name}</Link></h3>
                <p className="muted">{l.location_name}, {l.city}</p>
                <ServiceList services={here} />
              </li>
            );
          })}
          {online.length > 0 ? (
            <li className="directory-card">
              <h3>Online consultation</h3>
              <ServiceList services={online} />
            </li>
          ) : null}
        </ul>
        <p className="muted small">Fees are set by the doctor. HMO coverage is confirmed by the clinic, never assumed.</p>
      </section>
    </>
  );
}

function ServiceList({ services }: { services: Awaited<ReturnType<typeof getDoctorServices>> }) {
  if (services.length === 0) return <p className="muted small">No services listed here yet.</p>;
  return (
    <ul className="services">
      {services.map((s) => (
        <li key={s.id}><span>{s.name} · {s.duration_minutes} min</span><strong>{s.fee.amount === 0 ? 'Free' : s.fee.formatted}</strong></li>
      ))}
    </ul>
  );
}
