import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const DOCTOR = '01a1ed01-0000-7000-8000-00000000d001';
const CLINIC = '01a1ec01-0000-7000-8000-00000000c001';
const pages = ['/', '/privacy', '/terms', '/search', `/doctors/${DOCTOR}`, '/clinics', `/clinics/${CLINIC}`];

for (const path of pages) {
  test.describe(path, () => {
    test('renders one h1, a skip link and no horizontal scroll', async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('link', { name: 'Skip to content' })).toBeAttached();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('has no detectable WCAG 2.2 AA violations', async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });

    test('screenshot', async ({ page }, info) => {
      test.skip(!process.env.SHOTS, 'set SHOTS=1 (pnpm e2e:shots) to capture');
      await page.goto(path);
      await page.screenshot({ path: `test-results/shots/${info.project.name}${path === '/' ? '-home' : path.replace(/\/[0-9a-f-]{36}$/, '-detail').replace('/', '-')}.png`, fullPage: true });
    });
  });
}

test('keyboard focus is visible on the first tab stop', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
  expect(outline).not.toBe('none');
});

test('search links a doctor to their profile, fees and clinic', async ({ page }) => {
  await page.goto('/search');
  await page.getByRole('link', { name: 'Dr. Ana Reyes' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dr. Ana Reyes' })).toBeVisible();
  await expect(page.getByText('PRC licence checked by MediConnect')).toBeVisible();
  await expect(page.getByText('₱650.00')).toBeVisible();
  await expect(page.getByText('Booking through MediConnect is not available yet', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Santos Family Clinic' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Santos Family Clinic' })).toBeVisible();
  await expect(page.getByText('08:00–12:00, 13:00–17:00')).toBeVisible();
});

test('the old doctor list redirects to search, keeping its filters', async ({ page }) => {
  await page.goto('/doctors?city=Makati&page=2');
  await expect(page).toHaveURL(/\/search\?city=Makati$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Find a doctor' })).toBeVisible();
});

test('an unknown or invalid doctor id is a 404', async ({ page }) => {
  expect((await page.goto('/doctors/not-a-uuid'))?.status()).toBe(404);
  expect((await page.goto('/doctors/01a1ed01-0000-7000-8000-000000000999'))?.status()).toBe(404);
});
