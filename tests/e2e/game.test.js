import { expect, test } from '@playwright/test';

test('a static deployment starts Mexico without a project API', async ({ page }) => {
  const errors = [];
  const apiRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PAPER SHOOTER', exact: true })).toBeVisible();
  await page.locator('[data-map="mexico"]').click();
  await page.locator('#soloBtn').click();
  await expect
    .poll(() => page.evaluate(() => window.__game.inspect()))
    .toMatchObject({ state: 'play', map: 'mexico', wave: 1, hp: 120 });
  await page.keyboard.down('Digit2');
  await expect.poll(() => page.evaluate(() => window.__game.inspect().weapon)).toBe('shotgun');
  await page.keyboard.up('Digit2');
  expect(errors).toEqual([]);
  expect(apiRequests).toEqual([]);
});

test('solo can pause and resume with the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.locator('#soloBtn').click();
  await page.keyboard.down('Escape');
  await expect(page.getByRole('heading', { name: 'PAUSED' })).toBeVisible();
  await page.keyboard.up('Escape');
  await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => window.__game.inspect().state)).toBe('play');
  await page.keyboard.up('Space');
});

test('Paper settings survive a reload and inherit existing Doodle saves', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('doodle_map')) {
      localStorage.setItem('doodle_map', 'mexico');
      localStorage.setItem('doodle_best', '4321');
    }
  });
  await page.goto('/');
  await expect(page.locator('.beststat')).toContainText('4321');
  await expect(page.locator('[data-map="mexico"]')).toHaveClass(/on/);
  await page.locator('#setSens').evaluate((input) => {
    input.value = '150';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.reload();
  await expect(page.locator('#setSens')).toHaveValue('150');
});
