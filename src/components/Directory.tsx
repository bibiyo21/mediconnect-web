import Link from 'next/link';
import type { Page } from '@/lib/directory';

/** Previous / next links that keep the current filters. */
export function PageLinks({ meta, basePath, query }: { meta?: Page; basePath: string; query: Record<string, string | undefined> }) {
  if (!meta || meta.last_page <= 1) return null;
  const href = (page: number) => {
    const params = new URLSearchParams(Object.entries({ ...query, page: String(page) }).filter((e): e is [string, string] => !!e[1]));
    return `${basePath}?${params.toString()}`;
  };
  return (
    <nav className="page-links" aria-label="Pages">
      {meta.page > 1 ? <Link href={href(meta.page - 1)}>Previous page</Link> : <span />}
      <span className="muted">Page {meta.page} of {meta.last_page}</span>
      {meta.page < meta.last_page ? <Link href={href(meta.page + 1)}>Next page</Link> : <span />}
    </nav>
  );
}

export function DirectoryUnavailableNotice() {
  return <p className="notice notice--error" role="alert">The directory is not reachable right now. Please try again in a moment.</p>;
}

/** Honest status: browsing is live, booking is not (CLAUDE.md §32.8). */
export function BookingNotice() {
  return <p className="notice" role="note">Booking through MediConnect is not available yet. Contact the clinic directly to make an appointment.</p>;
}
