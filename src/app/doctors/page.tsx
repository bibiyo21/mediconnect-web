import { redirect } from 'next/navigation';

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * The 2.11 doctor list is replaced by search (increment 3.6). Old links keep
 * their filters (city, specialty, mode share their names with /search); the
 * profile pages under /doctors/[id] stay.
 */
export default async function DoctorsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const keep = new URLSearchParams();
  for (const key of ['city', 'specialty', 'mode']) {
    const value = params[key];
    const one = (Array.isArray(value) ? value[0] : value)?.trim();
    if (one) keep.set(key, one);
  }
  redirect(keep.size ? `/search?${keep.toString()}` : '/search');
}
