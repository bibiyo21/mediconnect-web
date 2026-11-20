import type { Metadata } from 'next';
import { BookingNotice } from '@/components/Directory';
import { DoctorSearch } from '@/components/DoctorSearch';
import { DirectoryUnavailable, listSpecialties } from '@/lib/directory';
import { filtersFromParams, searchDoctors, type SearchPage } from '@/lib/search';

export const metadata: Metadata = {
  title: 'Find a doctor',
  description: 'Search doctors in the Philippines by name, specialty, condition, clinic or city. Every doctor listed had their PRC licence checked by MediConnect.',
};

// The server reads the API at its internal address; the browser uses the public one.
const SERVER_API = process.env.MEDICONNECT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Doctor search (increment 3.6): the first page is rendered here, later searches in the browser. */
export default async function SearchPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const filters = filtersFromParams(params);
  const cursor = typeof params.cursor === 'string' ? params.cursor : undefined;

  const [page, specialties] = await Promise.all([
    searchDoctors(SERVER_API, filters, { cursor, server: true }).catch((): SearchPage | null => null),
    listSpecialties().catch((e) => {
      if (e instanceof DirectoryUnavailable) return [];
      throw e;
    }),
  ]);

  return (
    <>
      <h1>Find a doctor</h1>
      <p className="lead">Every doctor listed here had their PRC licence and documents checked by a MediConnect reviewer.</p>
      <BookingNotice />
      <DoctorSearch apiUrl={PUBLIC_API} specialties={specialties.map((s) => ({ id: s.id, name: s.name }))} initialFilters={filters} initialPage={page} />
    </>
  );
}
