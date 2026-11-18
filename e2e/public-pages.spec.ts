import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = ['/', '/privacy', '/terms'];

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
      await page.screenshot({ path: `test-results/shots/${info.project.name}${path === '/' ? '-home' : path.replace('/', '-')}.png`, fullPage: true });
    });
  });
}

test('keyboard focus is visible on the first tab stop', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
  expect(outline).not.toBe('none');
});
