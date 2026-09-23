const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/codeToDiagram.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleState = { exports: {} };
vm.runInNewContext(outputText, { module: moduleState, exports: moduleState.exports });
const { parseCodeToDiagram, diagramToMermaid, CODE_PRESETS_LIST } = moduleState.exports;

test('edge references do not overwrite explicit node labels', () => {
  const result = parseCodeToDiagram('flowchart LR\nA[Start] --> B[Finish]\nA --> B');
  assert.deepEqual(Array.from(result.nodes, node => node.label), ['Start', 'Finish']);
  assert.equal(result.edges.length, 2);
  assert.equal(result.diagnostics.length, 0);
});

test('unsupported statements report original source line numbers', () => {
  const result = parseCodeToDiagram('%% comment\nflowchart LR\nA[Start]\nunknown command\nA --> B');
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].line, 4);
  assert.equal(result.diagnostics[0].source, 'unknown command');
  assert.equal(result.nodes.length, 2);
});

test('export uses distinct Mermaid aliases for repeated labels and round-trips edges', () => {
  const result = parseCodeToDiagram('flowchart LR\nA[Task] --> B[Task]\nB --> C[Done]');
  const exported = diagramToMermaid(result.nodes, result.edges, 'LR');
  const imported = parseCodeToDiagram(exported);
  assert.equal(imported.diagnostics.length, 0);
  assert.equal(imported.nodes.length, 3);
  assert.equal(imported.edges.length, 2);
  assert.equal(imported.nodes.filter(node => node.label === 'Task').length, 2);
});

test('ER export keeps tables with repeated names distinct', () => {
  const source = parseCodeToDiagram('Table: Orders\n- id uuid pk\nTable: Items\n- id uuid pk');
  source.nodes[1].label = 'Orders';
  const exported = diagramToMermaid(source.nodes, [], 'LR', true);
  assert.match(exported, /Orders \{/);
  assert.match(exported, /Orders_2 \{/);
  assert.equal(parseCodeToDiagram(exported).nodes.length, 2);
});

test('built-in examples parse without silently dropping statements', () => {
  const expected = {
    flowchart: [7, 7], database: [4, 3], 'login-sequence': [4, 6],
    'dfd-flow': [4, 3], 'usecase-system': [5, 3], 'activity-workflow': [5, 5],
  };
  for (const preset of CODE_PRESETS_LIST) {
    const parsed = parseCodeToDiagram(preset.code, preset.direction);
    assert.equal(parsed.nodes.length, expected[preset.id][0], `${preset.id} shapes`);
    assert.equal(parsed.edges.length, expected[preset.id][1], `${preset.id} connections`);
    assert.equal(parsed.diagnostics.length, 0, `${preset.id}: ${JSON.stringify(parsed.diagnostics)}`);
  }
});
