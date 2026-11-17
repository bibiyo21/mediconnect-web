import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="bar">
        <span>© {new Date().getFullYear()} MediConnect</span>
        <nav aria-label="Legal" style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/privacy">Privacy notice</Link>
          <Link href="/terms">Terms of use</Link>
        </nav>
      </div>
    </footer>
  );
}
