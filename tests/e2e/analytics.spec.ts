import { expect, test } from '@playwright/test';

test('analytics keeps graphs and records together, handles filtering, pagination and errors', async ({ page }) => {
  test.setTimeout(60_000);
  const id = '40000000-0000-4000-8000-000000000001';
  const user = { id, aud: 'authenticated', role: 'authenticated', email: 'analytics@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const records = Array.from({ length: 12 }, (_, i) => ({ id: String(i), title: `Diagram ${i + 1}`, project_id: 'p1', project_name: 'Research', type: 'erd', created_at: new Date(Date.UTC(2026, 8, 10 + Math.floor(i / 3) * 7, 12)).toISOString(), updated_at: '2026-10-02T12:00:00Z' }));
  let fail = false;
  let lastParameters: Record<string, unknown> = {};
  await page.addInitScript(({ user }) => {
    localStorage.setItem('sb-diagrid-e2e-auth-token', JSON.stringify({ access_token: 'test-token', refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
  }, { user });
  await page.route('https://diagrid-e2e.supabase.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (path === '/auth/v1/user') { await route.fulfill({ json: user, headers }); return; }
    if (path === '/rest/v1/profiles') { await route.fulfill({ json: { ...user, role: 'admin', status: 'active', theme: 'blueprint' }, headers }); return; }
    if (path.endsWith('/rpc/get_diagram_analytics') || path.endsWith('/rpc/get_diagram_analytics_v2')) {
      if (fail) { await route.fulfill({ status: 500, json: { message: 'Analytics unavailable' }, headers }); return; }
      const filters = route.request().postDataJSON();
      lastParameters = filters;
      const matching = records.filter(r => !filters.search_text || r.title.toLowerCase().includes(filters.search_text.toLowerCase()));
      const count = matching.length;
      await route.fulfill({ headers, json: {
        total_diagrams: count, project_count: count ? 1 : 0, average_per_project: count,
        most_used_type: count ? 'erd' : null, most_used_count: count,
        types: count ? [{ label: 'erd', count }] : [], projects: count ? [{ id: 'p1', label: 'Research', count }] : [],
        series: [{ date: '2026-09-01', count: matching.filter(r => r.created_at.startsWith('2026-09')).length }, { date: '2026-10-01', count: matching.filter(r => r.created_at.startsWith('2026-10')).length }], records: matching,
        project_options: [{ id: 'p1', name: 'Research' }], type_options: ['erd'], timezone: 'UTC', bucket: filters.bucket,
        insights: {
          window_start: '2026-09-10', window_end: '2026-10-07', complete_history: count === 12,
          diagnostic: { recent_count: count === 12 ? 6 : count, previous_count: count === 12 ? 6 : 0, delta: 0, change_pct: count === 12 ? 0 : null, project_changes: [], type_changes: [] },
          forecast: count === 12 ? { status: 'available', estimate: 3, start: '2026-10-08', end: '2026-10-14', historical_projection: false, observed_weekly_min: 3, observed_weekly_max: 3, backtest_estimate: 3, backtest_actual: 3, backtest_absolute_error: 0, weekly_counts: [] } : { status: 'insufficient_data', reason: 'Select a range containing at least 28 completed days of matching history.', weekly_counts: [] },
          recommendations: count === 12 ? [{ id: 'concentration', title: 'Review the dominant project', detail: 'Check documentation coverage.', evidence: 'Research accounts for 100% of creations (review threshold: 60%).', project_id: 'p1' }] : [],
        },
      }}); return;
    }
    await route.fulfill({ json: [], headers });
  });
  await page.goto('/admin/analytics', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Diagrid Analytics' })).toBeVisible();
  await expect(page.getByText('12 matching records · dates in UTC', { exact: true })).toBeVisible();
  await expect(page.getByRole('img')).toHaveCount(3);
  const totalInfo = page.getByRole('button', { name: 'About Total diagrams', exact: true });
  await totalInfo.hover();
  await expect(page.getByRole('tooltip')).toContainText('Number of currently saved diagrams');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await totalInfo.click();
  await expect(page.getByRole('dialog', { name: 'Total diagrams', exact: true })).toContainText('12 matching records = 12 diagrams.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(totalInfo).toBeFocused();
  const averageInfo = page.getByRole('button', { name: 'About Average diagrams per project' });
  await averageInfo.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('12 ÷ 1 = 12.00');
  await page.getByRole('button', { name: 'Close metric information' }).click();
  await page.getByRole('button', { name: 'About Most-used diagram type' }).click();
  await expect(page.getByRole('dialog')).toContainText('ERD: 12 of 12 diagrams (100.0%).');
  await expect(page.getByRole('dialog')).toContainText('Ties are resolved alphabetically');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'What changed?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Seven-day baseline' })).toBeVisible();
  await expect(page.getByText('≈ 3.00 diagrams')).toBeVisible();
  await page.getByRole('button', { name: 'Focus on this project' }).click();
  await expect.poll(() => lastParameters.filter_project).toBe('p1');
  await expect(page.getByText('12 matching records · dates in UTC', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByPlaceholder('Diagram title, project, or type').fill('Diagram 12');
  await expect(page.getByText('1 matching records · dates in UTC', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText('ERD (1)', { exact: true })).toBeVisible();
  await expect(page.getByText('Select a range containing at least 28 completed days of matching history.')).toBeVisible();
  await expect(page.getByText('≈ 3.00 diagrams')).toHaveCount(0);
  await page.getByPlaceholder('Diagram title, project, or type').fill('missing');
  await expect(page.getByText('0 matching records · dates in UTC', { exact: true })).toBeVisible();
  await expect(page.getByText('No data', { exact: true })).toBeVisible();
  await averageInfo.click();
  await expect(page.getByRole('dialog')).toContainText('No matching projects: the average is 0.00.');
  await page.keyboard.press('Escape');
  fail = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Analytics unavailable');
  await expect(page.locator('table')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('table')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator('aside').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
  expect(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Diagram Records' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('12 matching records · dates in UTC', { exact: true })).toBeVisible();
  await page.locator('main').evaluate(el => { el.scrollTop = 0; });
  await averageInfo.click();
  await expect(page.getByRole('dialog')).toContainText('Time grouping changes chart buckets only');
  expect(await page.getByRole('dialog').evaluate(el => el.getBoundingClientRect().width <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/analytics-metric-help-mobile.png' });
  await page.getByRole('button', { name: 'Close metric information' }).click();
  await page.screenshot({ path: 'test-results/analytics-mobile.png' });
  await page.getByRole('heading', { name: 'Diagram types', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/analytics-mobile-charts.png' });
  await page.getByRole('heading', { name: 'Diagram Records' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/analytics-mobile-records.png' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await expect.poll(() => page.locator('aside').evaluate(el => el.getBoundingClientRect().left)).toBe(0);
  await page.locator('main').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: 'test-results/analytics-desktop.png' });
  await page.getByRole('heading', { name: 'Diagram Records' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/analytics-desktop-records.png' });
});
