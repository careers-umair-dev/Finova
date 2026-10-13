import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { addWallet, goto, openEntry, register } from './helpers';

test('register → wallet → transaction → dashboard → history → report → filter & export', async ({ page }) => {
  // 1. registration lands on an honest empty dashboard (no fabricated balances)
  await register(page, 'Umair Demo');
  await expect(page.getByText('No wallets yet').first()).toBeVisible();

  // 2. create a wallet
  await addWallet(page, { name: 'Everyday wallet', opening: '1000.00' });
  await expect(page.getByRole('region', { name: 'Wallet' })).toContainText('$1,000.00');

  // 3. add a transaction (Receive)
  const dlg = await openEntry(page, 'Receive', '250.00', 'Invoice 42');
  await dlg.getByRole('button', { name: 'Record receive' }).click();
  await expect(dlg).toBeHidden();

  // 4. the dashboard updates: wallet card, balance card, recent transactions
  await expect(page.getByRole('region', { name: 'Balance' })).toContainText('$1,250.00');
  await expect(page.getByRole('region', { name: 'Wallet' })).toContainText('$1,250.00');
  await expect(page.getByRole('region', { name: 'Transaction history' })).toContainText('Invoice 42');

  // 5. it appears in History
  await goto(page, 'History');
  await expect(page).toHaveURL(/\/history/);
  await expect(page.getByRole('row', { name: /Invoice 42/ })).toContainText('+$250.00');

  // 6. the report chart and totals reflect it
  await goto(page, 'Reports');
  await expect(page.getByRole('img', { name: /Monthly income and expenses/ })).toBeVisible();
  await expect(page.getByText('$250.00').first()).toBeVisible();

  // 7. filter and export
  await goto(page, 'History');
  await page.getByRole('searchbox', { name: 'Search' }).fill('Invoice');
  await page.getByLabel('Status').selectOption('completed');
  await expect(page.getByRole('row', { name: /Invoice 42/ })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search' }).fill('no-such-thing');
  await expect(page.getByText('No matching transactions')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search' }).fill('Invoice');
  await expect(page.getByRole('row', { name: /Invoice 42/ })).toBeVisible(); // filters are debounced; the export link must carry them
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Export CSV' }).click()]);
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv.split('\r\n')[0]).toBe('Date,Wallet,Counterparty,Type,Status,Amount,Currency,Description,Category');
  expect(csv).toContain('Invoice 42'); expect(csv).toContain('250.00');
});

test('a pending send can be completed from the details dialog, and overdrafts are refused', async ({ page }) => {
  await register(page); await addWallet(page, { opening: '100.00' });

  let dlg = await openEntry(page, 'Send', '500.00');
  await dlg.getByRole('button', { name: 'Record send' }).click();
  await expect(dlg.getByRole('alert')).toContainText(/not have enough balance/i);       // server-side rule surfaced in the UI
  await dlg.getByLabel('Amount').fill('40.00');
  await dlg.getByLabel('Status').selectOption('pending');
  await dlg.getByRole('button', { name: 'Record send' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.getByRole('region', { name: 'Balance' })).toContainText('$100.00');  // pending doesn't move the balance

  await page.getByRole('row', { name: /Sent funds/ }).click();
  dlg = page.getByRole('dialog', { name: /\$40\.00/ });
  await dlg.getByRole('button', { name: 'Mark completed' }).click();
  await expect(page.getByRole('region', { name: 'Balance' })).toContainText('$60.00');
});
