// Mock of the public directory API for Playwright (test fixtures only, no real data).
// The site fetches on the server, so browser-side route mocks cannot reach it.
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_API_PORT ?? 3999);
const DOCTOR = '01a1ed01-0000-7000-8000-00000000d001';
const CLINIC = '01a1ec01-0000-7000-8000-00000000c001';
const LOCATION = '01a1ec01-0000-7000-8000-00000000l001';

const doctor = {
  id: DOCTOR, display_name: 'Dr. Ana Reyes', professional_title: 'MD', licence_verified: true, primary_specialty: 'Pediatrics',
  specialties: [{ specialty_id: 'sp1', name: 'Pediatrics', subspecialty: null, board_certified: true }], languages: ['en', 'fil'], years_experience: 8,
  practice_locations: [{ clinic_id: CLINIC, clinic_name: 'Santos Family Clinic', clinic_location_id: LOCATION, location_name: 'Makati branch', city: 'Makati' }],
  biography: 'Pediatrician caring for children in Makati.', medical_school: 'Example College of Medicine', gender: null, education: [],
};
const fee = (amount) => ({ amount, currency: 'PHP', formatted: `₱${(amount / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}` });
const services = [
  { id: 'sv1', name: 'Consultation', consultation_type: 'IN_PERSON', clinic_location_id: LOCATION, location_name: 'Makati branch', clinic_service_id: null, is_follow_up: false, duration_minutes: 20, buffer_minutes: 5, fee: fee(65000), is_hmo_eligible: false, status: 'ACTIVE', effective_from: '2026-11-19T02:00:00Z', effective_until: null },
  { id: 'sv2', name: 'Teleconsultation', consultation_type: 'ONLINE', clinic_location_id: null, location_name: null, clinic_service_id: null, is_follow_up: false, duration_minutes: 15, buffer_minutes: 0, fee: fee(50000), is_hmo_eligible: false, status: 'ACTIVE', effective_from: '2026-11-19T02:00:00Z', effective_until: null },
];
const clinic = {
  id: CLINIC, name: 'Santos Family Clinic', slug: 'santos-family-clinic', description: 'Family care in Makati.', organization_name: 'Santos Medical Group',
  locations: [{ id: LOCATION, name: 'Makati branch', address_line1: 'Mabini St', address_line2: null, barangay: 'Poblacion', city: 'Makati', province: null, postal_code: null, latitude: null, longitude: null, timezone: 'Asia/Manila', phone: null, hospital_name: null,
    operating_hours: [{ day_of_week: 1, opens_at: '08:00', closes_at: '12:00' }, { day_of_week: 1, opens_at: '13:00', closes_at: '17:00' }, { day_of_week: 3, opens_at: '08:00', closes_at: '12:00' }],
    services: [{ id: 'cs1', name: 'Laboratory', description: null }] }],
  upcoming_closures: [{ clinic_location_id: null, date: '2026-12-25', name: 'Christmas Day', is_closed: true, special_opens_at: null, special_closes_at: null }],
};
const page = (total) => ({ page: 1, per_page: 20, total, last_page: 1 });
const ok = (data, meta = {}) => ({ success: true, data, meta, message: null });

// Doctor search (3.6). Sentinel queries give the other states: nobody (empty), slow (degraded), broken (500), flood (429).
const hit = (overrides = {}) => ({
  doctor_id: DOCTOR, display_name: 'Dr. Ana Reyes', professional_title: 'MD', specialties: ['Pediatrics'], languages: ['en', 'fil'], years_experience: 8,
  is_verified: true, offers_online: true, fee_from: fee(50000),
  locations: [{ clinic_id: CLINIC, clinic_name: 'Santos Family Clinic', clinic_location_id: LOCATION, location_name: 'Makati branch', city: 'Makati', fee_min: 65000, fee_max: 65000, distance_km: null }],
  ...overrides,
});
const second = hit({ doctor_id: '01a1ed01-0000-7000-8000-00000000d002', display_name: 'Dr. Ben Cruz', specialties: ['Cardiology'], offers_online: false, fee_from: fee(80000) });
const searchMeta = (found, extra = {}) => ({ found, next_cursor: null, took_ms: 4, cache_hit: false, degraded: false, facets: {}, ...extra });
function searchDoctors(url) {
  const q = url.searchParams.get('q') ?? '';
  if (q === 'nobody') return [200, ok([], searchMeta(0))];
  if (q === 'slow') return [200, ok([hit()], searchMeta(1, { degraded: true }))];
  if (q === 'broken') return [500, { success: false, message: 'Server error.', errors: {}, code: 'SERVER_ERROR' }];
  if (q === 'flood') return [429, { success: false, message: 'Too many requests.', errors: {}, code: 'RATE_LIMITED' }];
  if (url.searchParams.has('lat')) return [200, ok([hit({ locations: [{ ...hit().locations[0], distance_km: 1.2 }] })], searchMeta(1))];
  if (url.searchParams.get('cursor') === 'page-2') return [200, ok([second], searchMeta(2))];
  return [200, ok([hit()], searchMeta(2, { next_cursor: 'page-2' }))];
}
const suggestions = [
  { specialty_id: 'sp1', id: 'sp1', name: 'Pediatrics', kind: 'SPECIALTY', parent_name: null, doctor_count: 1 },
  { specialty_id: 'sp1', id: 'sub-neo', name: 'Neonatology', kind: 'SUBSPECIALTY', parent_name: 'Pediatrics', doctor_count: 1 },
];

const routes = [
  [/^\/api\/v1\/doctors$/, (url) => (url.searchParams.get('filter[city]') === 'Nowhere' ? ok([], page(0)) : ok([doctor], page(1)))],
  [new RegExp(`^/api/v1/doctors/${DOCTOR}$`), () => ok(doctor)],
  [new RegExp(`^/api/v1/doctors/${DOCTOR}/services$`), () => ok(services)],
  [/^\/api\/v1\/clinics$/, () => ok([clinic], page(1))],
  [new RegExp(`^/api/v1/clinics/${CLINIC}$`), () => ok(clinic)],
  [new RegExp(`^/api/v1/clinics/${CLINIC}/doctors$`), () => ok([{ id: DOCTOR, display_name: 'Dr. Ana Reyes', professional_title: 'MD', primary_specialty: 'Pediatrics', location_ids: [LOCATION] }])],
  [/^\/api\/v1\/specialties$/, () => ok([{ id: 'sp1', name: 'Pediatrics', slug: 'pediatrics' }])],
  [/^\/api\/v1\/search\/doctors$/, searchDoctors],
  [/^\/api\/v1\/search\/specialties$/, () => ok(suggestions, searchMeta(2))],
];

// The browser calls search directly (the backend allows the site's origin the same way, config/cors.php).
const cors = { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Headers': 'Accept, Content-Type', Vary: 'Origin' };

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const match = routes.find(([pattern]) => pattern.test(url.pathname));
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  const answer = match ? match[1](url) : null;
  const [status, body] = Array.isArray(answer) ? answer : [match || url.pathname === '/health' ? 200 : 404, answer ?? { success: false, message: 'Not found.', errors: {}, code: 'NOT_FOUND' }];
  res.writeHead(status, { 'Content-Type': 'application/json', ...cors });
  res.end(JSON.stringify(body));
}).listen(PORT, '127.0.0.1');
