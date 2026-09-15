import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

const apiOrigin = 'https://diagrid-e2e.supabase.test';
const email = 'journey@example.test';
const password = 'test-password-123';
const userId = '00000000-0000-4000-8000-000000000001';

type Row = Record<string, unknown> & { id: string };

class MockAccount {
  projects = new Map<string, Row>();
  diagrams = new Map<string, Row>();
  failDiagramWrites = false;
  failedWrites = 0;
  diagramReads = 0;

  diagramHasLabel(id: string, label: string) {
    const content = this.diagrams.get(id)?.content;
    if (!content || typeof content !== 'object' || !('nodes' in content) || !Array.isArray(content.nodes)) return false;
    return content.nodes.some((node: { label?: string }) => node.label === label);
  }

  private readonly user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
  };

  async install(context: BrowserContext) {
    // An empty local database avoids sample-data migration. The second context
    // gets the same empty state, so it cannot pass by reading the first tab's copy.
    await context.addInitScript(() => {
      localStorage.setItem('diagrid_projects', '[]');
      localStorage.setItem('diagrid_diagrams', '[]');
    });
    await context.route(`${apiOrigin}/**`, route => this.respond(route));
  }

  private async respond(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-expose-headers': 'content-range',
    };
    const send = (status: number, body?: unknown, extraHeaders?: Record<string, string>) =>
      route.fulfill({ status, headers: { ...headers, ...extraHeaders },
        ...(body === undefined ? {} : { json: body }) });

    if (method === 'OPTIONS') return send(204);

    if (url.pathname === '/auth/v1/token' && method === 'POST') {
      const credentials = request.postDataJSON() as { email?: string; password?: string };
      if (credentials.email !== email || credentials.password !== password) {
        return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      }
      return send(200, {
        access_token: 'e2e-access-token',
        refresh_token: 'e2e-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: this.user,
      });
    }
    if (url.pathname === '/auth/v1/user' && method === 'GET') return send(200, this.user);

    if (url.pathname === '/rest/v1/profiles' && method === 'GET') {
      return send(200, {
        id: userId, email, role: 'user', name: 'Journey Tester',
        theme: 'blueprint', grid_style: 'lines', snap_to_grid: true,
      });
    }

    if (url.pathname === '/rest/v1/audit_logs' && method === 'POST') return send(201, []);

    if (url.pathname === '/rest/v1/projects') {
      if (method === 'HEAD') return send(200, undefined, { 'content-range': `*/${this.projects.size}` });
      if (method === 'POST') {
        const input = request.postDataJSON() as Row;
        const row = { ...this.projects.get(input.id), ...input };
        this.projects.set(row.id, row);
        return send(201, row);
      }
      if (method === 'GET') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        if (id) return this.projects.has(id) ? send(200, this.projects.get(id)) : send(406, { message: 'Project not found' });
        const rows = [...this.projects.values()].map(row => ({
          ...row,
          diagrams: [{ count: [...this.diagrams.values()].filter(diagram => diagram.project_id === row.id).length }],
        }));
        return send(200, rows);
      }
    }

    if (url.pathname === '/rest/v1/diagrams') {
      if (method === 'POST') {
        if (this.failDiagramWrites) {
          this.failedWrites += 1;
          return send(503, { code: 'E2E_SAVE_FAILED', message: 'Simulated account save failure' });
        }
        const input = request.postDataJSON() as Row;
        const row = { ...this.diagrams.get(input.id), ...input };
        this.diagrams.set(row.id, row);
        return send(201, row);
      }
      if (method === 'GET') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        if (id) {
          this.diagramReads += 1;
          return this.diagrams.has(id) ? send(200, this.diagrams.get(id)) : send(406, { message: 'Diagram not found' });
        }
        const projectId = url.searchParams.get('project_id')?.replace(/^eq\./, '');
        return send(200, [...this.diagrams.values()].filter(row => !projectId || row.project_id === projectId));
      }
    }

    // Other app data, such as optional settings, stays inside this fake host.
    return send(method === 'GET' ? 200 : 201, []);
  }
}

async function signIn(page: Page) {
  await page.goto('/auth');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('sign in, create and edit, recover a failed account save, then load the edit from the account', async ({ browser }) => {
  const account = new MockAccount();
  const firstContext = await browser.newContext();
  await account.install(firstContext);
  const page = await firstContext.newPage();

  try {
    await signIn(page);
    await page.getByRole('button', { name: 'create_project()' }).first().click();
    await page.getByPlaceholder('my-awesome-api').fill('Journey Project');
    await page.getByRole('button', { name: 'create', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Journey Project' })).toBeVisible();
    await expect.poll(() => account.projects.size).toBe(1);
    await page.getByRole('heading', { name: 'Journey Project' }).click();
    await expect(page).toHaveURL(/\/project\//);

    await page.getByRole('button', { name: 'create_diagram()' }).first().click();
    await page.getByPlaceholder('e.g. User Checkout Flow').fill('Journey Diagram');
    await page.getByRole('button', { name: 'create_diagram →' }).click();
    await expect(page).toHaveURL(/\/editor\//);
    const editorUrl = page.url();
    const diagramId = editorUrl.split('/').pop()!;
    await expect.poll(() => account.diagrams.has(diagramId)).toBe(true);

    account.failDiagramWrites = true;
    await page.getByText('users', { exact: true }).first().click();
    // The inspector's label and input share a parent, so select by proximity.
    const shapeLabel = page.getByText('SHAPE_LABEL', { exact: true }).last().locator('..').locator('input');
    await shapeLabel.fill('Customers');
    await expect(page.getByRole('status').filter({ hasText: 'account save failed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    await expect(page.getByText('Saved', { exact: true })).toHaveCount(0);
    expect(account.failedWrites).toBeGreaterThan(0);
    expect(account.diagramHasLabel(diagramId, 'Customers')).toBe(false);

    account.failDiagramWrites = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('status').getByText('Saved', { exact: true })).toBeVisible();
    await expect.poll(() => account.diagramHasLabel(diagramId, 'Customers')).toBe(true);

    const secondContext = await browser.newContext();
    await account.install(secondContext);
    const freshPage = await secondContext.newPage();
    try {
      await signIn(freshPage);
      const readsBefore = account.diagramReads;
      await freshPage.goto(editorUrl);
      await expect(freshPage.getByText('Customers', { exact: true }).first()).toBeVisible();
      expect(account.diagramReads).toBeGreaterThan(readsBefore);
    } finally {
      await secondContext.close();
    }
  } finally {
    await firstContext.close();
  }
});
