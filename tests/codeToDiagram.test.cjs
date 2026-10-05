const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const compile = (relativePath, dependencies = {}) => {
  const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const moduleState = { exports: {} };
  vm.runInNewContext(outputText, {
    module: moduleState,
    exports: moduleState.exports,
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return moduleState.exports;
};

const sourceParser = compile('../src/utils/diagramSourceParser.ts');
const moduleState = { exports: compile('../src/utils/codeToDiagram.ts', { './diagramSourceParser': sourceParser }) };
const { parseCodeToDiagram, diagramToMermaid, CODE_PRESETS_LIST } = moduleState.exports;
const { detectDiagramSyntax, parseDiagramSource } = sourceParser;

test('detects supported source formats before parsing', () => {
  assert.equal(detectDiagramSyntax('flowchart TD\nA --> B'), 'flowchart');
  assert.equal(detectDiagramSyntax('sequenceDiagram\nA->>B: Hello'), 'sequence');
  assert.equal(detectDiagramSyntax('erDiagram\nUSER {\n string id\n}'), 'er');
  assert.equal(detectDiagramSyntax('Table: Users\n- id uuid pk'), 'table-shorthand');
});

test('malformed connectors include actionable source positions', () => {
  const result = parseDiagramSource('flowchart LR\n  A[Start]\n  A -->');
  const issue = result.diagnostics.find(item => item.code === 'invalid-connector');
  assert.ok(issue);
  assert.equal(issue.line, 3);
  assert.ok(issue.column > 2);
  assert.equal(issue.severity, 'error');
  assert.match(issue.suggestion, /A --> B/);
});

test('reports unclosed blocks and unsupported diagram families', () => {
  const er = parseDiagramSource('erDiagram\nUSER {\n string id');
  assert.equal(er.diagnostics.at(-1).code, 'unclosed-entity');
  assert.equal(er.diagnostics.at(-1).line, 2);
  const unsupported = parseDiagramSource('classDiagram\nA <|-- B');
  assert.equal(unsupported.syntax, 'unknown');
  assert.equal(unsupported.diagnostics[0].code, 'unsupported-diagram');
  assert.equal(unsupported.diagnostics[0].severity, 'error');
});

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

test('detects DFD, Use Case, and Activity syntaxes', () => {
  assert.equal(detectDiagramSyntax('dfdDiagram LR\nentity Client'), 'dfd');
  assert.equal(detectDiagramSyntax('usecaseDiagram\nactor User'), 'usecase');
  assert.equal(detectDiagramSyntax('activityDiagram TD\nstart --> action "Do"'), 'activity');
});

test('parses DFD diagram nodes and data flows', () => {
  const code = `dfdDiagram
    entity Customer as "Online Customer"
    process OrderProcess as "1.0 Process Order"
    store OrderStore as "D1 Orders DB"
    Customer --> OrderProcess : Place Order
    OrderProcess --> OrderStore : Record Sale`;
  const result = parseCodeToDiagram(code);
  assert.equal(result.nodes.length, 3);
  assert.equal(result.edges.length, 2);
  const types = result.nodes.map(n => n.type).sort();
  assert.equal(types.join(','), 'dfd-entity,dfd-process,dfd-store');
  assert.equal(result.edges[0].label, 'Place Order');
  assert.equal(result.edges[1].label, 'Record Sale');
});

test('parses Use Case actors, ovals, and boundaries', () => {
  const code = `usecaseDiagram
    actor Member
    boundary System as "Banking App"
    usecase Transfer as "Transfer Funds"
    Member --> Transfer`;
  const result = parseCodeToDiagram(code);
  assert.equal(result.nodes.length, 3);
  assert.equal(result.edges.length, 1);
  const types = result.nodes.map(n => n.type).sort();
  assert.equal(types.join(','), 'usecase-actor,usecase-boundary,usecase-oval');
});

test('parses Activity diagram elements and branching', () => {
  const code = `activityDiagram TD
    start
    action Step1 as "Prepare Data"
    decision Check as "Valid?"
    fork
    end Done
    start --> Step1
    Step1 --> Check
    Check -- Yes --> fork
    Check -- No --> Done`;
  const result = parseCodeToDiagram(code, 'TD');
  assert.equal(result.nodes.length, 5);
  assert.equal(result.edges.length, 4);
  const types = new Set(result.nodes.map(n => n.type));
  assert.ok(types.has('activity-start'));
  assert.ok(types.has('activity-action'));
  assert.ok(types.has('activity-decision'));
  assert.ok(types.has('activity-fork'));
  assert.ok(types.has('activity-end'));
});

test('applies color hints from :::color syntax to canvas nodes', () => {
  const code = `flowchart LR
    A[Submit]:::blue --> B{Check}:::green
    B --> C[Error]:::red`;
  const result = parseCodeToDiagram(code);
  assert.equal(result.nodes.length, 3);
  const nodeA = result.nodes.find(n => n.label === 'Submit');
  const nodeB = result.nodes.find(n => n.label === 'Check');
  assert.equal(nodeA?.fillColor, '#EFF6FF');
  assert.equal(nodeA?.shadowAccent, '#1E5C8C');
  assert.equal(nodeB?.fillColor, '#F0FDF4');
  assert.equal(nodeB?.shadowAccent, '#2E7D32');
  const nodeC = result.nodes.find(n => n.label === 'Error');
  assert.equal(nodeC?.fillColor, '#FEF2F2');
  assert.equal(nodeC?.shadowAccent, '#D45B33');
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


