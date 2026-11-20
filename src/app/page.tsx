import Link from 'next/link';

/* eslint-disable @next/next/no-img-element -- static SVG icons and a pre-sized WebP with srcset; no optimiser needed */

/**
 * Public home page. MediConnect is in development: nothing here offers a
 * search, booking or account action that does not exist yet. Each planned
 * feature is labelled Planned, or ready for launch once it is built
 * (development-roadmap.md has the phases).
 */
const FEATURES = [
  { icon: 'find-a-doctor', title: 'Search by HMO and time', body: 'Filter doctors by the HMO you use and by available dates and times.', phase: 'Planned' },
  { icon: 'book-appointment', title: 'Book an appointment', body: 'Reserve a clinic visit or an online consultation, with no double booking.', phase: 'Planned' },
  { icon: 'hospitals-clinics', title: 'Join a clinic queue', body: 'Register as a walk-in and follow your place in line.', phase: 'Planned' },
  { icon: 'video-consultation', title: 'Consult online', body: 'Private video rooms that fall back to audio on a weak connection.', phase: 'Planned' },
  { icon: 'hmo-coverage', title: 'Use your HMO', body: 'Save your membership. Coverage is confirmed by the clinic, never assumed.', phase: 'Planned' },
  { icon: 'family-dependents', title: 'Care for your family', body: 'Manage your children’s and parents’ profiles from one account.', phase: 'Ready for the app launch' },
] as const;

const TRUST = [
  { icon: 'verified-doctors', title: 'Licences checked by people', body: 'Doctors will be listed only after our reviewers check their PRC licence and documents.' },
  { icon: 'medical-records', title: 'Your records stay yours', body: 'Only you and the doctors caring for you will be able to open your records, and every access is logged.' },
  { icon: 'secure-payment', title: 'Payments checked before booking', body: 'GCash, Maya and card payments will be confirmed with the provider before a booking is. Card numbers never reach us.' },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__text">
          <p className="eyebrow">For patients in the Philippines</p>
          <h1 id="hero-title">Find doctors and clinics near you, and see them in person or online</h1>
          <p className="lead">
            MediConnect brings independent doctors and clinics into one place. Search verified doctors today. Soon you will be able to book, join a clinic queue or consult by video, and pay with GCash, Maya or a card.
          </p>
          <p className="notice" role="note">
            MediConnect is in development. You can search verified doctors and clinics; booking is not available yet.
          </p>
          <div className="hero__actions">
            <Link className="button" href="/search">Find a doctor</Link>
            <a className="button button--secondary" href="#features">See what is coming</a>
          </div>
        </div>
        <img
          className="hero__photo"
          src="/assets/brand/illustrations/hospital-exterior.webp"
          srcSet="/assets/brand/illustrations/hospital-exterior-800.webp 800w, /assets/brand/illustrations/hospital-exterior.webp 1600w"
          sizes="(min-width: 1024px) 50vw, 100vw"
          width={1600}
          height={900}
          alt="Illustration of a modern hospital entrance with staff walking in"
          fetchPriority="high"
        />
      </section>

      <section id="features" className="section" aria-labelledby="features-title">
        <h2 id="features-title">What you will be able to do</h2>
        <ul className="feature-grid">
          {FEATURES.map((f) => (
            <li key={f.title} className="feature">
              <img src={`/assets/brand/icons/${f.icon}.svg`} alt="" width={48} height={48} />
              <h3>{f.title}</h3>
              <p>{f.body}</p>
              <p className="feature__phase">{f.phase}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section section--surface" aria-labelledby="trust-title">
        <h2 id="trust-title">Our commitments to you</h2>
        <ul className="trust-grid">
          {TRUST.map((t) => (
            <li key={t.title} className="trust">
              <img src={`/assets/brand/icons/${t.icon}.svg`} alt="" width={40} height={40} />
              <div>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="emergency">In an emergency, call 911 or go to the nearest emergency room. MediConnect is not an emergency service.</p>
      </section>
    </>
  );
}
