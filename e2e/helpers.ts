import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'correct-horse-battery';
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function register(page: Page, name = 'Umair Demo') {
  const email = `e2e-${uid()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Welcome Back/ })).toBeVisible();
  return { email, name };
}

export async function addWallet(page: Page, o: { name?: string; currency?: string; opening?: string } = {}) {
  await page.getByRole('button', { name: 'Add New Wallet' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add new wallet' });
  await dlg.getByLabel('Wallet name').fill(o.name ?? 'Everyday wallet');
  await dlg.getByLabel('Currency').selectOption(o.currency ?? 'USD');
  await dlg.getByLabel('Opening balance').fill(o.opening ?? '1000.00');
  await dlg.getByRole('button', { name: 'Create wallet' }).click();
  await expect(dlg).toBeHidden();
}

/** Opens the Send/Receive dialog from the Balance card and fills it; the caller submits. */
export async function openEntry(page: Page, kind: 'Send' | 'Receive', amount: string, description?: string) {
  await page.getByRole('region', { name: 'Balance' }).getByRole('button', { name: new RegExp(`^${kind}`) }).click();
  const dlg = page.getByRole('dialog', { name: `${kind} funds` });
  await dlg.getByLabel('Amount').fill(amount);
  if (description) await dlg.getByLabel('Description (optional)').fill(description);
  return dlg;
}

export const goto = (page: Page, label: string) => page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: label }).click();
