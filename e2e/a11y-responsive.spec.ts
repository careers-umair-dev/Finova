import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addWallet, openEntry, register } from './helpers';

const seriousViolations = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
};

test('login and register have no serious/critical WCAG A/AA violations', async ({ page }) => {
  for (const path of ['/login', '/register', '/forgot-password']) { await page.goto(path); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); expect(await seriousViolations(page), path).toEqual([]); }
});

test('dashboard (with data) and key pages have no serious/critical WCAG A/AA violations', async ({ page }) => {
  await register(page); await addWallet(page);
  const dlg = await openEntry(page, 'Receive', '250.00', 'Invoice 42'); await dlg.getByRole('button', { name: 'Record receive' }).click(); await expect(dlg).toBeHidden();
  await expect(page.getByRole('region', { name: 'Transaction history' })).toContainText('Invoice 42');
  await expect(page.getByRole('group', { name: /Net cash flow/ })).toBeVisible();
  expect(await seriousViolations(page), 'dashboard').toEqual([]);
  for (const path of ['/history', '/reports', '/contacts', '/documents', '/wallets', '/settings', '/notifications']) {
    await page.goto(path); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); expect(await seriousViolations(page), path).toEqual([]);
  }
});

test.describe('phone layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('bottom nav replaces the desktop nav, nothing overflows sideways, More sheet works', async ({ page }) => {
    await register(page); await addWallet(page);
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    await expect(page.getByRole('region', { name: 'Wallet' })).toContainText('$1,000.00');
    for (const path of ['/', '/history', '/reports', '/wallets', '/contacts']) {
      await page.goto(path); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `horizontal overflow on ${path}`).toBe(true);
    }
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings/);
  });
});

test('reduced-motion users get no entrance animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await register(page); await addWallet(page);
  const names = await page.evaluate(() => [...document.querySelectorAll('.stagger > *')].map((el) => getComputedStyle(el).animationName));
  expect(names.length).toBeGreaterThan(0); expect(names.every((n) => n === 'none')).toBe(true);
});
