import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="bar" aria-label="Main">
        <Link href="/" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG mark; next/image adds nothing */}
          <img src="/assets/brand/logo-mark.svg" alt="" width={32} height={32} className="brand__mark" />
          <span>MediConnect</span>
        </Link>
        <ul className="nav-links">
          <li><Link href="/search">Find a doctor</Link></li>
          <li><Link href="/clinics">Clinics</Link></li>
        </ul>
      </nav>
    </header>
  );
}
