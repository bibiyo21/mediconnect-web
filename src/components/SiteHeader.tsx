import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="bar" aria-label="Main">
        <Link href="/" className="brand">MediConnect</Link>
      </nav>
    </header>
  );
}
