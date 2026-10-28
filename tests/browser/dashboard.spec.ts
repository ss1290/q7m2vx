import { test, expect } from '@playwright/test';

// Exercise user outcomes against the real Python service and bundled snapshot.
test('dashboard filters, navigation, audit table and CSV work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('744 of 744 delivery hours matched')).toBeVisible();
  await page.screenshot({ path: 'artifacts/overview.png', fullPage: true });
  await page.getByLabel('Chart decision day').selectOption('2026-01-15');
  await expect(page.getByText('Hourly wind generation · MW · delivery 16 Jan')).toBeVisible();
  await page.getByRole('button', { name: 'Data explorer', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('Showing 48 of 744 hours')).toBeVisible();
  await page.getByRole('button', { name: 'Show more hours' }).click();
  await expect(page.getByText('Showing 144 of 744 hours')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('windward-analysis.csv');
  await page.getByRole('button', { name: 'Methodology', exact: true }).click();
  await expect(page.getByText('From publication to purchasing context.')).toBeVisible();
  await page.getByRole('button', { name: 'Forecast accuracy', exact: true }).click();
  await expect(page.getByText('What the metrics tell you')).toBeVisible();
  await page.getByLabel('Decision start date').fill('2026-01-31');
  await expect(page.getByText('24 of 24 delivery hours matched')).toBeVisible();
  await page.getByLabel('Decision cutoff London time').fill('12:00');
  await expect(page.getByText('24 of 24 delivery hours matched')).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile navigation and chart remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('744 of 744 delivery hours matched')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByLabel('Toggle navigation').click();
  await page.getByRole('button', { name: 'Data explorer', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('Toggle navigation').click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
});
