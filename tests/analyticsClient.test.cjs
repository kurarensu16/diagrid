const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function client(rpc, configured = true) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/analyticsService.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports,
    require: () => ({ isSupabaseConfigured: () => configured, supabase: { rpc } }),
  });
  return module.exports.getDiagramAnalytics;
}
const filters = { start: '', end: '', project: '', type: '', search: '  Research  ', bucket: 'month' };
test('V2 returns measured insights with the same normalized filter parameters', async () => {
  const calls = [], payload = { records: [], insights: { forecast: { status: 'insufficient_data' } } };
  const load = client(async (name, parameters) => { calls.push({ name, parameters }); return { data: payload, error: null }; });
  assert.equal(await load(filters), payload);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'get_diagram_analytics_v2');
  assert.equal(calls[0].parameters.search_text, 'Research');
  assert.equal(calls[0].parameters.start_date, null);
});
test('missing V2 falls back to the existing RPC without fabricating insights', async () => {
  const calls = [], payload = { records: [] };
  const load = client(async (name, parameters) => { calls.push({ name, parameters }); return name.endsWith('_v2') ? { error: { code: 'PGRST202', message: 'Missing function' } } : { data: payload, error: null }; });
  const result = await load(filters);
  assert.equal(result.insights, undefined);
  assert.deepEqual(calls.map(c => c.name), ['get_diagram_analytics_v2', 'get_diagram_analytics']);
  assert.equal(calls[0].parameters, calls[1].parameters);
});
test('authorization and database errors never trigger fallback', async () => {
  for (const code of ['42501', '500']) {
    let count = 0;
    const load = client(async () => { count++; return { error: { code, message: 'Access denied or unavailable' } }; });
    await assert.rejects(load(filters), /Access denied or unavailable/);
    assert.equal(count, 1);
  }
});
test('an unconfigured client does not issue a query', async () => {
  let count = 0;
  const load = client(async () => { count++; }, false);
  await assert.rejects(load(filters), /Connect Supabase/);
  assert.equal(count, 0);
});
