import type { components } from '@mediconnect/api-types';

/**
 * Server-side reads of the public directory (increment 2.11). Types come from
 * the generated OpenAPI schema (type-only import; the app does not bundle the
 * API client yet). Responses are cached for a minute; booking-critical data is
 * never trusted from here (Phase 4 revalidates against PostgreSQL).
 */
export type PublicDoctor = components['schemas']['PublicDoctorResource'];
export type PublicDoctorDetail = components['schemas']['PublicDoctorDetailResource'];
export type PublicClinicDetail = components['schemas']['PublicClinicDetailResource'];
export type PublicService = components['schemas']['DoctorServiceResource'];
export type PublicClinic = components['schemas']['PublicClinicResource'];
export type Page = { page: number; per_page: number; total: number; last_page: number };
export type ClinicDoctor = { id: string; display_name: string; professional_title: string | null; primary_specialty: string | null; location_ids: string[] };
export type Specialty = { id: string; name: string; slug: string };

const API_URL = process.env.MEDICONNECT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export class DirectoryUnavailable extends Error {}

type Envelope<T> = { success: boolean; data: T; meta?: Page };

/** GET a public endpoint. Returns null on 404; throws DirectoryUnavailable on anything else. */
async function get<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<Envelope<T> | null> {
  const url = new URL(API_URL.replace(/\/$/, '') + path);
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 60 } });
  } catch {
    throw new DirectoryUnavailable('The directory is unreachable.');
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new DirectoryUnavailable(`The directory answered ${response.status}.`);
  return (await response.json()) as Envelope<T>;
}

export async function listDoctors(filters: { page?: number; city?: string; specialty_id?: string; consultation_type?: string }) {
  const result = await get<PublicDoctor[]>('/doctors', { page: filters.page, 'filter[city]': filters.city, 'filter[specialty_id]': filters.specialty_id, 'filter[consultation_type]': filters.consultation_type });
  return { doctors: result?.data ?? [], meta: result?.meta };
}

export const getDoctor = async (id: string) => (await get<PublicDoctorDetail>(`/doctors/${encodeURIComponent(id)}`))?.data ?? null;
export const getDoctorServices = async (id: string) => (await get<PublicService[]>(`/doctors/${encodeURIComponent(id)}/services`))?.data ?? [];

export async function listClinics(filters: { page?: number; city?: string }) {
  const result = await get<PublicClinic[]>('/clinics', { page: filters.page, 'filter[city]': filters.city });
  return { clinics: result?.data ?? [], meta: result?.meta };
}

export const getClinic = async (id: string) => (await get<PublicClinicDetail>(`/clinics/${encodeURIComponent(id)}`))?.data ?? null;
export const getClinicDoctors = async (id: string) => (await get<ClinicDoctor[]>(`/clinics/${encodeURIComponent(id)}/doctors`))?.data ?? [];
export const listSpecialties = async () => (await get<Specialty[]>('/specialties'))?.data ?? [];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

const LANGUAGES: Record<string, string> = { en: 'English', fil: 'Filipino', ceb: 'Cebuano', ilo: 'Ilocano', hil: 'Hiligaynon', zh: 'Chinese', es: 'Spanish' };
export const languageName = (code: string) => LANGUAGES[code] ?? code.toUpperCase();

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
