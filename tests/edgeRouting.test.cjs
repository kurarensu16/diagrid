const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/edgeRouting.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleState = { exports: {} };
vm.runInNewContext(outputText, {
  module: moduleState,
  exports: moduleState.exports,
  require(name) {
    if (name === './diagramExport') {
      return { getNodeDimensions: node => ({ width: node.width, height: node.height }) };
    }
    throw new Error(`Unexpected import: ${name}`);
  },
});
const { calculateEdgePath, getEdgeLabelPosition, getPortCoords } = moduleState.exports;

const card = (id, x, y, width = 210, height = 145) => ({ id, x, y, width, height, type: 'table' });
const pointsOf = route => [...route.matchAll(/[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)]
  .map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
const inward = (point, node) => point.x > node.x && point.x < node.x + node.width
  && point.y > node.y && point.y < node.y + node.height;

function assertConnectedAndClear(nodes, sourceHandle, targetHandle) {
  const edge = { source: nodes[0].id, target: nodes[1].id, sourceHandle, targetHandle };
  const points = pointsOf(calculateEdgePath(edge, nodes));
  assert.ok(points.length >= 2);
  const start = getPortCoords(nodes[0], sourceHandle);
  const end = getPortCoords(nodes[1], targetHandle);
  assert.equal(points[0].x, start.x);
  assert.equal(points[0].y, start.y);
  assert.equal(points.at(-1).x, end.x);
  assert.equal(points.at(-1).y, end.y);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    assert.ok(a.x === b.x || a.y === b.y, 'connector is orthogonal');
    for (const node of nodes) {
      // Check the midpoint and two interior samples, including on endpoint cards.
      for (const t of [0.1, 0.5, 0.9]) {
        assert.ok(!inward({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, node),
          `connector crosses ${node.id}: ${JSON.stringify(points)}`);
      }
    }
  }
}

test('ports stay connected when tables are aligned, offset, or face away from each other', () => {
  assertConnectedAndClear([card('users', 900, 500), card('projects', 900, 740)], 'bottom', 'top');
  assertConnectedAndClear([card('projects', 900, 740), card('diagrams', 1270, 500)], 'right', 'left');
  assertConnectedAndClear([card('users', 900, 500), card('profiles', 450, 690)], 'left', 'right');
  assertConnectedAndClear([card('users', 900, 500), card('table', 450, 295)], 'top', 'bottom');
  assertConnectedAndClear([card('left', 450, 500), card('right', 900, 500)], 'left', 'right');
});

test('routes around intervening cards without crossing the source or target', () => {
  assertConnectedAndClear([
    card('source', 100, 300), card('target', 800, 300), card('middle', 440, 270, 200, 200),
  ], 'right', 'left');
});

test('DFD connectors keep their ports when shapes are moved past the canvas origin', () => {
  const customer = { ...card('customer', -50, 70, 120, 56), type: 'dfd-entity' };
  const process = { ...card('process', 260, -50, 130, 64), type: 'dfd-process' };
  const payment = { ...card('payment', 520, 70, 120, 56), type: 'dfd-entity' };
  const store = { ...card('store', 260, 160, 140, 48), type: 'dfd-store' };
  assertConnectedAndClear([process, payment, customer, store], 'right', 'top');
  assertConnectedAndClear([process, store, customer, payment], 'bottom', 'top');
});

test('connector labels sit on the routed line when an edge bends around shapes', () => {
  const nodes = [card('invoice', 800, 700), card('customer', 100, 300), card('store', 470, 460, 170, 110)];
  const path = calculateEdgePath({
    source: 'invoice', target: 'customer', sourceHandle: 'left', targetHandle: 'bottom',
  }, nodes);
  const label = getEdgeLabelPosition(path);
  const points = pointsOf(path);
  assert.ok(points.slice(1).some((point, index) => {
    const previous = points[index];
    return previous.x === point.x
      ? label.x === point.x && label.y >= Math.min(previous.y, point.y) && label.y <= Math.max(previous.y, point.y)
      : label.y === point.y && label.x >= Math.min(previous.x, point.x) && label.x <= Math.max(previous.x, point.x);
  }));
});
