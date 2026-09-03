const { test, expect } = require('@playwright/test');

test('aplikasi terbuka tanpa page error dan elemen utama tampil', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/inventory/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).toContainText(/Radja|Inventory|Stok/i);

  await page.waitForTimeout(2_000);
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});

test('asset lokal utama dapat dimuat', async ({ request }) => {
  for (const path of ['/inventory/index.html', '/inventory/manifest.json', '/inventory/service-worker.js', '/inventory/icon-192.png']) {
    const response = await request.get(path);
    expect(response.ok(), `${path}: ${response.status()}`).toBeTruthy();
  }
});

test('koneksi database uji dan navigasi utama berjalan', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/inventory/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#config-screen')).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('#loading-overlay')).toHaveCSS('display', 'none', { timeout: 20_000 });
  await expect(page.locator('#tab-stok')).toBeVisible();

  await page.getByRole('button', { name: 'Input Stok' }).click();
  await expect(page.locator('#tab-input')).toBeVisible();
  await page.locator('#rp-back-toggle').click();
  await expect(page.locator('#tab-stok')).toBeVisible();

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
