import { expect, test } from '@playwright/test';
import { addWallet, PASSWORD, register } from './helpers';

test('protected routes redirect, bad logins are refused, sign-out and sign-in round-trip', async ({ page }) => {
  await page.goto('/history');
  await expect(page).toHaveURL(/\/login/);

  const { email } = await register(page);
  await page.getByRole('button', { name: 'Profile menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/history');                                                           // signed out: still protected
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('wrong-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect email or password');

  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/history/);                                             // returns to where they were headed
});

test("one user can never read or write another user's wallet", async ({ page, browser }) => {
  await register(page); await addWallet(page, { name: 'Alice private' });
  const wallets = await (await page.request.get('/api/v1/wallets')).json();
  const walletId: string = wallets.data.wallets[0].id;

  const ctx = await browser.newContext(); const other = await ctx.newPage();
  await register(other, 'Bob Other');
  const h = { 'X-Requested-With': 'finova' };
  expect((await other.request.get(`/api/v1/wallets/${walletId}`)).status()).toBe(404);
  expect((await other.request.post('/api/v1/transactions', { headers: h, data: { walletId, type: 'income', amount: '1.00' } })).status()).toBe(404);
  expect((await other.request.patch(`/api/v1/wallets/${walletId}`, { headers: h, data: { name: 'pwned' } })).status()).toBe(404);
  await expect(other.getByText('Alice private')).toHaveCount(0);
  await ctx.close();
});

test('state-changing API calls without the CSRF header are rejected', async ({ page }) => {
  await register(page);
  const res = await page.request.post('/api/v1/wallets', { data: { name: 'x', currency: 'USD' } }); // no X-Requested-With
  expect(res.status()).toBe(403);
});
