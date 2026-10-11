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
const edgeRouting = compile('../src/utils/edgeRouting.ts', {
  './diagramExport': {
    getNodeDimensions: node => ({ width: node.customWidth ?? (node.type === 'decision' ? 96 : 140), height: node.customHeight ?? (node.type === 'decision' ? 96 : 48) }),
  },
});
const moduleState = { exports: compile('../src/utils/codeToDiagram.ts', { './diagramSourceParser': sourceParser, './edgeRouting': edgeRouting }) };
const { parseCodeToDiagram, diagramToMermaid, CODE_PRESETS_LIST } = moduleState.exports;
const { detectDiagramSyntax, parseDiagramSource } = sourceParser;
const { generateStandaloneSvg } = compile('../src/utils/diagramExport.ts', {
  jspdf: { jsPDF: class {} },
  dompurify: { sanitize: markup => markup },
  './edgeRouting': { calculateEdgePath: () => '', getEdgeLabelPosition: () => ({ x: 0, y: 0 }) },
  './dfdHelpers': { parseDfdStoreLabel: label => ({ id: '', name: label }), parseDfdProcessLabel: label => ({ id: '', name: label }) },
});

const assertNoNodeOverlaps = (nodes) => {
  for (let left = 0; left < nodes.length; left++) {
    for (let right = left + 1; right < nodes.length; right++) {
      const a = nodes[left];
      const b = nodes[right];
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      assert.equal(overlaps, false, `${a.label} overlaps ${b.label}`);
    }
  }
};

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
  assert.equal(result.diagnostics[0].severity, 'error');
  assert.equal(result.diagnostics[0].source, 'unknown command');
  assert.equal(result.nodes.length, 2);
});

test('unsupported sequence constructs are errors instead of silently omitted', () => {
  const result = parseCodeToDiagram('sequenceDiagram\nparticipant A\nparticipant B\nloop Retry\nA->>B: Request\nend');
  assert.equal(result.edges.length, 1);
  assert.equal(result.diagnostics.filter(item => item.severity === 'error').length, 2);
});

test('flowchart connectors inside labels stay text while chains and groups retain all edges', () => {
  const code = `flowchart LR
    A["Send --> request & await"] -->|"accepted --> queued"| B["Parse & validate"] & C[Fallback]
    B -. retry .-> D[Done]
    C --- D`;
  const result = parseDiagramSource(code);
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.nodes.length, 4);
  assert.equal(result.edges.length, 4);
  assert.equal(result.nodes.find(node => node.id === 'A').label, 'Send --> request & await');
  assert.equal(result.nodes.find(node => node.id === 'B').label, 'Parse & validate');
  assert.deepEqual(Array.from(result.edges.slice(0, 2), edge => edge.label), ['accepted --> queued', 'accepted --> queued']);
  assert.equal(result.edges[2].style, 'dashed');
  assert.equal(result.edges[2].label, 'retry');
  assert.equal(result.edges[3].arrow, 'none');
});

test('chained connectors retain each distinct label and endpoint', () => {
  const result = parseDiagramSource('flowchart TD\nA -- Yes --> B --> C -. retry .-> A');
  assert.equal(result.diagnostics.length, 0);
  assert.deepEqual(Array.from(result.edges, edge => [edge.source, edge.target, edge.label, edge.style]), [
    ['A', 'B', 'Yes', 'solid'],
    ['B', 'C', undefined, 'solid'],
    ['C', 'A', 'retry', 'dashed'],
  ]);
});

test('flowchart headers reject unsupported extra content', () => {
  const result = parseDiagramSource('flowchart LR unexpected\nA --> B');
  assert.equal(result.edges.length, 1);
  assert.equal(result.diagnostics[0].code, 'invalid-header');
  assert.equal(result.diagnostics[0].severity, 'error');
});

test('an invalid node in a chain does not add partial edges', () => {
  const result = parseDiagramSource('flowchart LR\nA --> B[Broken --> C');
  assert.equal(result.edges.length, 0);
  assert.ok(result.diagnostics.some(item => item.severity === 'error'));
});

test('unsupported visual semantics and reverse directions produce blocking diagnostics', () => {
  const result = parseDiagramSource('flowchart RL\nsubgraph Group\nA --> B\nend\nstyle A fill:red');
  assert.deepEqual(Array.from(result.diagnostics, item => item.code), ['unsupported-direction', 'unsupported-style']);
  assert.equal(result.edges.length, 1);
});

test('shopping flow imports all subgraphs, nodes, edges, and styles', () => {
  const code = fs.readFileSync(path.join(__dirname, 'fixtures/shopping-flow.mmd'), 'utf8');
  const parsed = parseDiagramSource(code);
  assert.deepEqual(Array.from(parsed.diagnostics, item => `${item.code}: ${item.message}`), []);
  assert.equal(parsed.nodes.length, 61);
  assert.equal(parsed.edges.length, 80);
  const result = parseCodeToDiagram(code);
  assert.deepEqual(Array.from(result.diagnostics, item => `${item.code}: ${item.message}`), []);
  assert.equal(parsed.groups.length, 6);
  assert.equal(parsed.nodes.find(node => node.id === 'Auth').subgraph, 'AUTH');
  assert.equal(result.nodes.filter(node => node.type === 'subgraph').length, 6);
  assert.equal(result.nodes.length, parsed.nodes.length + 6);
  assert.equal(result.edges.length, parsed.edges.length);
  assertNoNodeOverlaps(result.nodes.filter(node => node.type !== 'subgraph'));
  assertNoNodeOverlaps(result.nodes.filter(node => node.type === 'subgraph'));
  const byLabel = new Map(result.nodes.map(node => [node.label, node]));
  const parsedById = new Map(parsed.nodes.map(node => [node.id, node]));
  const placedById = new Map(result.nodes.map(node => [node.id, node]));
  assert.deepEqual(Array.from(result.edges, edge => [
    placedById.get(edge.source).label, placedById.get(edge.target).label, edge.label || '',
  ]), Array.from(parsed.edges, edge => [
    parsedById.get(edge.source).label, parsedById.get(edge.target).label, edge.label || '',
  ]));
  assert.ok(byLabel.get('Calculate Final Total').customWidth > 140);
  assert.ok(byLabel.get('Stock Still Available?').customWidth > 120);
  assert.equal(byLabel.get('Calculate Final Total').customWidth, byLabel.get('Calculate Final Total').width);
  assert.equal(byLabel.get('Start').fillColor, '#166534');
  assert.equal(byLabel.get('Start').borderWidth, 2);
  assert.equal(byLabel.get('Authenticated?').borderWidth, 2);
  for (const group of parsed.groups) {
    const box = result.nodes.find(node => node.type === 'subgraph' && node.subgraphId === group.id);
    assert.ok(box, group.id);
    const members = parsed.nodes.filter(node => node.subgraph === group.id);
    assert.ok(members.length > 0, group.id);
    for (const member of members) {
      const placed = byLabel.get(member.label);
      assert.ok(placed.x >= box.x && placed.y >= box.y && placed.x + placed.width <= box.x + box.width && placed.y + placed.height <= box.y + box.height, `${member.label} outside ${group.id}`);
    }
  }
  const exported = diagramToMermaid(result.nodes, result.edges, 'TD');
  const reimported = parseCodeToDiagram(exported);
  assert.deepEqual(Array.from(reimported.diagnostics, item => `${item.code}: ${item.message}`), []);
  assert.equal(reimported.nodes.filter(node => node.type === 'subgraph').length, 6);
  assert.equal(reimported.nodes.length, result.nodes.length);
  assert.equal(reimported.edges.length, result.edges.length);
});

test('direction control overrides the source header in both orientations', () => {
  const code = 'flowchart TD\nA[Start] --> B[Middle] --> C[End]';
  const vertical = parseCodeToDiagram(code, 'TD');
  const horizontal = parseCodeToDiagram(code, 'LR');
  const v = new Map(vertical.nodes.map(node => [node.label, node]));
  const h = new Map(horizontal.nodes.map(node => [node.label, node]));
  assert.ok(v.get('Start').y < v.get('Middle').y && v.get('Middle').y < v.get('End').y);
  assert.ok(h.get('Start').x < h.get('Middle').x && h.get('Middle').x < h.get('End').x);
});

test('compact layout wraps the shopping flow without losing topology or overlapping stages', () => {
  const code = fs.readFileSync(path.join(__dirname, 'fixtures/shopping-flow.mmd'), 'utf8');
  const vertical = parseCodeToDiagram(code, 'TD');
  const horizontal = parseCodeToDiagram(code, 'LR');
  const compact = parseCodeToDiagram(code, 'COMPACT');
  const extent = nodes => ({
    width: Math.max(...nodes.map(node => node.x + node.width)) - Math.min(...nodes.map(node => node.x)),
    height: Math.max(...nodes.map(node => node.y + node.height)) - Math.min(...nodes.map(node => node.y)),
  });
  assert.deepEqual(Array.from(compact.diagnostics, item => item.code), []);
  assert.equal(compact.nodes.length, vertical.nodes.length);
  assert.equal(compact.edges.length, vertical.edges.length);
  assertNoNodeOverlaps(compact.nodes.filter(node => node.type !== 'subgraph'));
  assertNoNodeOverlaps(compact.nodes.filter(node => node.type === 'subgraph'));
  assert.ok(extent(compact.nodes).height < extent(vertical.nodes).height * 0.8);
  assert.ok(extent(compact.nodes).width < extent(horizontal.nodes).width * 0.8);
  const blockedSegments = [];
  const nodesById = new Map(compact.nodes.map(node => [node.id, node]));
  for (const edge of compact.edges) {
    const path = edgeRouting.calculateEdgePath(edge, compact.nodes, undefined, { skipSearch: true });
    const points = edgeRouting.getEdgePathPoints(path);
    for (let index = 1; index < points.length; index++) {
      if (edgeRouting.isSegmentBlocked(points[index - 1], points[index], compact.nodes, edge.source, edge.target)) blockedSegments.push(`${nodesById.get(edge.source).label} -> ${nodesById.get(edge.target).label}: ${path}`);
      if (index > 1 && edgeRouting.isSegmentIntersectingNode(points[index - 1], points[index], nodesById.get(edge.source))) blockedSegments.push(`${nodesById.get(edge.source).label} -> ${nodesById.get(edge.target).label}: route reenters source`);
      if (index < points.length - 1 && edgeRouting.isSegmentIntersectingNode(points[index - 1], points[index], nodesById.get(edge.target))) blockedSegments.push(`${nodesById.get(edge.source).label} -> ${nodesById.get(edge.target).label}: route crosses target before final segment`);
    }
  }
  assert.equal(blockedSegments.length, 0, `${blockedSegments.length} compact connector segments cross shapes: ${blockedSegments.join('; ')}`);
});

test('compact layout wraps a long ungrouped chain into multiple bands', () => {
  const code = `flowchart TD\n${Array.from({ length: 80 }, (_, index) => `N${index}`).join(' --> ')}`;
  const vertical = parseCodeToDiagram(code, 'TD');
  const compact = parseCodeToDiagram(code, 'COMPACT');
  assert.equal(compact.nodes.length, 80);
  assert.equal(compact.edges.length, 79);
  assertNoNodeOverlaps(compact.nodes);
  const height = nodes => Math.max(...nodes.map(node => node.y + node.height)) - Math.min(...nodes.map(node => node.y));
  assert.ok(height(compact.nodes) < height(vertical.nodes) / 2);
});

test('compact layout separates disconnected components', () => {
  const code = 'flowchart TD\nA --> B --> C\nD --> E --> F\nG --> H --> I';
  const result = parseCodeToDiagram(code, 'COMPACT');
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.nodes.length, 9);
  assert.equal(result.edges.length, 6);
  assertNoNodeOverlaps(result.nodes);
});

test('flowchart classes and direct styles preserve supported fill and border colors', () => {
  const code = `flowchart LR
    A[Start]:::urgent --> B[Done]
    classDef urgent fill:#fee,stroke:#a00,color:#111
    class B urgent
    style B fill:#00ff00,stroke:#123456,color:#fff`;
  const result = parseCodeToDiagram(code);
  assert.equal(result.diagnostics.length, 0);
  const byLabel = new Map(result.nodes.map(node => [node.label, node]));
  assert.equal(byLabel.get('Start').fillColor, '#fee');
  assert.equal(byLabel.get('Start').borderColor, '#a00');
  assert.equal(byLabel.get('Start').textColor, '#111');
  assert.equal(byLabel.get('Done').fillColor, '#00ff00');
  assert.equal(byLabel.get('Done').borderColor, '#123456');
  assert.equal(byLabel.get('Done').textColor, '#fff');
  const exported = diagramToMermaid(result.nodes, result.edges);
  const imported = parseCodeToDiagram(exported);
  assert.equal(imported.diagnostics.length, 0);
  const importedByLabel = new Map(imported.nodes.map(node => [node.label, node]));
  assert.equal(importedByLabel.get('Start').fillColor, '#fee');
  assert.equal(importedByLabel.get('Start').borderColor, '#a00');
  assert.equal(importedByLabel.get('Start').textColor, '#111');
  assert.equal(importedByLabel.get('Done').fillColor, '#00ff00');
  assert.equal(importedByLabel.get('Done').borderColor, '#123456');
  assert.equal(importedByLabel.get('Done').textColor, '#fff');
  const svg = generateStandaloneSvg(null, [byLabel.get('Start')], [], [], { background: 'white', includeGrid: false });
  assert.match(svg, /fill="#fee" stroke="#a00"/);
  assert.match(svg, /<text[^>]+fill="#111"/);
});

test('unsupported style properties and unknown classes are reported', () => {
  const result = parseDiagramSource('flowchart LR\nA:::missing --> B\nstyle A stroke-width:5px\nclass B other');
  assert.deepEqual(Array.from(result.diagnostics, item => item.code), ['unsupported-style', 'unknown-class', 'unknown-class']);
  assert.ok(result.diagnostics.every(item => item.severity === 'error'));
  assert.equal(result.diagnostics[1].line, 2);
});

test('default class colors apply before node-specific styles', () => {
  const result = parseCodeToDiagram('flowchart LR\nA --> B\nclassDef default fill:#eee,stroke:#333\nstyle B fill:#f00');
  assert.equal(result.diagnostics.length, 0);
  const byLabel = new Map(result.nodes.map(node => [node.label, node]));
  assert.equal(byLabel.get('A').fillColor, '#eee');
  assert.equal(byLabel.get('A').borderColor, '#333');
  assert.equal(byLabel.get('B').fillColor, '#f00');
  assert.equal(byLabel.get('B').borderColor, '#333');
});

test('large cyclic diagrams retain every connection with bounded finite layout', () => {
  const size = 500;
  const lines = ['flowchart LR'];
  for (let index = 0; index < size; index++) lines.push(`N${index}[Step ${index}] --> N${(index + 1) % size}`);
  const result = parseCodeToDiagram(lines.join('\n'));
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.nodes.length, size);
  assert.equal(result.edges.length, size);
  assert.ok(result.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)));
  assert.ok(Math.max(...result.nodes.map(node => node.x)) < 10000);
  assertNoNodeOverlaps(result.nodes);
});

test('large branching flowcharts preserve graph topology', () => {
  const count = 500;
  const lines = ['flowchart TD'];
  for (let index = 1; index < count; index++) lines.push(`N${Math.floor((index - 1) / 2)} --> N${index}`);
  const result = parseCodeToDiagram(lines.join('\n'));
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.nodes.length, count);
  assert.equal(result.edges.length, count - 1);
  const ids = new Set(result.nodes.map(node => node.id));
  assert.ok(result.edges.every(edge => ids.has(edge.source) && ids.has(edge.target)));
  assertNoNodeOverlaps(result.nodes);
});

test('disconnected groups occupy separate bands in both directions', () => {
  const source = 'A --> B\nC --> D\nE --> F';
  for (const direction of ['LR', 'TD']) {
    const result = parseCodeToDiagram(`flowchart ${direction}\n${source}`);
    assert.equal(result.diagnostics.length, 0);
    assertNoNodeOverlaps(result.nodes);
    const byLabel = new Map(result.nodes.map(node => [node.label, node]));
    const cross = node => direction === 'LR' ? node.y : node.x;
    const extent = node => cross(node) + (direction === 'LR' ? node.height : node.width);
    assert.ok(Math.max(extent(byLabel.get('A')), extent(byLabel.get('B'))) + 100 <= Math.min(cross(byLabel.get('C')), cross(byLabel.get('D'))));
    assert.ok(Math.max(extent(byLabel.get('C')), extent(byLabel.get('D'))) + 100 <= Math.min(cross(byLabel.get('E')), cross(byLabel.get('F'))));
    const repeated = parseCodeToDiagram(`flowchart ${direction}\n${source}`);
    assert.deepEqual(Array.from(repeated.nodes, node => [node.label, node.x, node.y]), Array.from(result.nodes, node => [node.label, node.x, node.y]));
  }
});

test('cycle connectors use sides matching their actual placement', () => {
  const result = parseCodeToDiagram('flowchart LR\nA --> B\nB --> C\nC --> D\nD --> A');
  const byId = new Map(result.nodes.map(node => [node.id, node]));
  const sameColumn = result.edges.find(edge => byId.get(edge.source).x === byId.get(edge.target).x && edge.source !== edge.target);
  const backEdge = result.edges.find(edge => byId.get(edge.source).x > byId.get(edge.target).x);
  assert.ok(sameColumn);
  assert.ok(backEdge);
  assert.equal(sameColumn.sourceHandle, 'bottom');
  assert.equal(sameColumn.targetHandle, 'top');
  assert.equal(backEdge.sourceHandle, 'left');
  assert.equal(backEdge.targetHandle, 'right');
});

test('layer ordering avoids an avoidable crossing', () => {
  const result = parseCodeToDiagram('flowchart LR\nA\nB\nC\nD\nA --> D\nB --> C');
  const byLabel = new Map(result.nodes.map(node => [node.label, node]));
  assert.ok(byLabel.get('A').y < byLabel.get('B').y);
  assert.ok(byLabel.get('D').y < byLabel.get('C').y);
  assertNoNodeOverlaps(result.nodes);
});

test('a long single-line flowchart chain imports completely', () => {
  const count = 500;
  const source = `flowchart LR\n${Array.from({ length: count }, (_, index) => `N${index}`).join(' --> ')}`;
  const result = parseCodeToDiagram(source);
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.nodes.length, count);
  assert.equal(result.edges.length, count - 1);
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


