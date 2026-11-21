import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Doctor search (increment 3.6) against the mock API (test fixtures only). */
const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map((v) => `${v.id}: ${v.help}`);

const searches = (page: Page) => {
  const seen: URL[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/search/doctors')) seen.push(new URL(r.url()));
  });
  return seen;
};

test('the first page is rendered on the server, with one h1 and no WCAG 2.2 AA violations', async ({ page }) => {
  const seen = searches(page);
  await page.goto('/search?q=pedia');
  await expect(page.getByRole('heading', { level: 1, name: 'Find a doctor' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
  await expect(page.getByRole('link', { name: 'Dr. Ana Reyes' })).toBeVisible();
  await expect(page.getByText('₱500.00')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(await axe(page)).toEqual([]);
  expect(seen).toEqual([]); // the browser did not repeat the server's search
});

test('works without JavaScript as a plain form', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/search');
  await page.getByLabel('Search', { exact: true }).fill('nobody');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=nobody/);
  await expect(page.getByText('No doctors match. Try a different word, or remove a filter.')).toBeVisible();
  await context.close();
});

test('typing is debounced into one request, and the URL follows', async ({ page }) => {
  await page.goto('/search');
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
  const seen = searches(page);
  await page.getByLabel('Search', { exact: true }).pressSequentially('reyes', { delay: 40 });
  await expect(page).toHaveURL(/\/search\?q=reyes$/);
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
  await page.waitForTimeout(500);
  expect(seen.map((u) => u.searchParams.get('q'))).toEqual(['reyes']);
});

test('a newer search aborts the one still in flight', async ({ page }) => {
  await page.goto('/search');
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
  const failed: string[] = [];
  page.on('requestfailed', (r) => {
    if (r.url().includes('/search/doctors')) failed.push(new URL(r.url()).searchParams.get('q') ?? '');
  });
  // Hold the first answer back so the second search starts while it is open.
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route(/\/search\/doctors\?q=first/, async (route) => {
    await held;
    await route.continue().catch(() => {});
  });
  const field = page.getByLabel('Search', { exact: true });
  await field.fill('first');
  await page.waitForRequest((r) => r.url().includes('q=first'));
  await field.fill('nobody');
  await expect(page.getByText('No doctors match. Try a different word, or remove a filter.')).toBeVisible();
  release();
  await expect.poll(() => failed).toEqual(['first']);
  await expect(page.getByText('No doctors match. Try a different word, or remove a filter.')).toBeVisible();
});

test('clearing the box while a search is in flight returns to the full list, not the late answer', async ({ page }) => {
  await page.goto('/search');
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route(/\/search\/doctors\?q=nobody/, async (route) => {
    await held;
    await route.continue().catch(() => {});
  });
  const aborted: string[] = [];
  page.on('requestfailed', (r) => {
    if (r.url().includes('q=nobody')) aborted.push(r.failure()?.errorText ?? '');
  });
  const field = page.getByLabel('Search', { exact: true });
  await field.fill('nobody');
  await page.waitForRequest((r) => r.url().includes('q=nobody'));
  await field.fill('');
  await expect.poll(() => aborted.length).toBe(1); // aborted as soon as the box was cleared
  release();
  await page.waitForTimeout(500);
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
  await expect(page.getByText('No doctors match', { exact: false })).toHaveCount(0);
  await expect(page).toHaveURL(/\/search$/);
});

test('suggests specialties as a combobox, by keyboard, and filters by the one chosen', async ({ page }) => {
  await page.goto('/search');
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
  const field = page.getByRole('combobox', { name: 'Search' });
  await field.fill('neo');
  await expect(page.getByRole('listbox', { name: 'Specialties' })).toBeVisible();
  await expect(field).toHaveAttribute('aria-expanded', 'true');
  expect(await axe(page)).toEqual([]);
  const filtered = page.waitForRequest((r) => r.url().includes('/search/doctors') && r.url().includes('subspecialty=sub-neo'));
  await field.press('ArrowDown');
  await field.press('ArrowDown');
  await expect(page.getByRole('option', { name: /Neonatology \(Pediatrics\)/ })).toHaveAttribute('aria-selected', 'true');
  await field.press('Enter');
  const url = new URL((await filtered).url());
  expect(url.searchParams.get('specialty')).toBe('sp1');
  expect(url.searchParams.has('q')).toBe(false);
  await expect(page.getByLabel('Specialty')).toHaveValue('sp1');
  await expect(page.getByText('Subspecialty: Neonatology (Pediatrics)')).toBeVisible();
  await expect(page).toHaveURL(/specialty=sp1&subspecialty=sub-neo/);
});

test('shows more doctors by cursor', async ({ page }) => {
  await page.goto('/search');
  await page.getByRole('link', { name: 'Show more doctors' }).click();
  await expect(page.getByRole('link', { name: 'Dr. Ben Cruz' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dr. Ana Reyes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Show more doctors' })).toHaveCount(0);
});

test('says so when search is degraded, fails, or is rate limited', async ({ page }) => {
  await page.goto('/search?q=slow');
  await expect(page.getByText(/Search is running in a simpler mode/)).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.goto('/search?q=broken');
  await expect(page.locator('.notice--error')).toContainText('Search is not working right now.');
  expect(await axe(page)).toEqual([]);
  await page.getByLabel('Search', { exact: true }).fill('flood');
  await expect(page.locator('.notice--error')).toContainText('You searched very quickly.');
  await page.getByLabel('Search', { exact: true }).fill('pedia');
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
});

test('"near me" is opt-in, keeps the location out of the URL, and can be turned off', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 14.55471, longitude: 121.02441 });
  const response = await page.goto('/search');
  expect(response?.headers()['permissions-policy']).toContain('geolocation=(self)');
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
  const seen = searches(page);
  expect(seen).toEqual([]); // nothing asked for or sent until the patient chooses
  await page.getByRole('button', { name: 'Doctors near me' }).click();
  await expect(page.getByText('(1.2 km away)', { exact: false })).toBeVisible();
  const near = seen.at(-1)!;
  expect([near.searchParams.get('lat'), near.searchParams.get('lng'), near.searchParams.get('radius_km'), near.searchParams.get('sort')]).toEqual(['14.555', '121.024', '25', 'distance']);
  expect(page.url()).not.toContain('14.5');
  await expect(page.getByText('is not saved', { exact: false })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: 'Stop using my location' }).click();
  await expect(page.getByRole('button', { name: 'Doctors near me' })).toBeVisible();
  await expect.poll(() => seen.at(-1)!.searchParams.has('lat')).toBe(false);
});

test('"near me" refused by the patient falls back to the city filter without sending a location', async ({ page }) => {
  await page.goto('/search'); // no permission granted in this context
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
  const seen = searches(page);
  await page.getByRole('button', { name: 'Doctors near me' }).click();
  await expect(page.getByText('We could not get your location. You can search by city instead.')).toBeVisible();
  expect(seen.filter((u) => u.searchParams.has('lat'))).toEqual([]);
});

test('the header links to search', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Find a doctor' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Find a doctor' })).toBeVisible();
});

test('screenshot', async ({ page }, info) => {
  test.skip(!process.env.WIP_SHOTS, 'set WIP_SHOTS=1 to capture');
  test.skip(info.project.name === 'tablet', 'desktop + mobile only');
  const dir = `${info.config.rootDir}/../../docs/wip-screenshots/phase-3/search`;
  await page.goto('/search?q=pedia');
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
  await page.screenshot({ path: `${dir}/web-search-results-${info.project.name}.png`, fullPage: true });
  await page.getByRole('combobox', { name: 'Search' }).fill('neo');
  await expect(page.getByRole('listbox', { name: 'Specialties' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('2 doctors found');
  await page.screenshot({ path: `${dir}/web-search-suggestions-${info.project.name}.png`, fullPage: true });
  await page.goto('/search?q=slow');
  await page.screenshot({ path: `${dir}/web-search-degraded-${info.project.name}.png`, fullPage: true });
  await page.goto('/search?q=broken');
  await page.screenshot({ path: `${dir}/web-search-error-${info.project.name}.png`, fullPage: true });
});
