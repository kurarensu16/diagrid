const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/canvasLayering.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleState = { exports: {} };
vm.runInNewContext(outputText, {
  module: moduleState,
  exports: moduleState.exports,
  require(name) {
    if (name === '../types/canvas') return { getNodeDimensions: node => ({ width: node.customWidth ?? 100, height: node.customHeight ?? 60 }) };
    throw new Error(`Unexpected import: ${name}`);
  },
});
const { getDomNodeIdsForLayering } = moduleState.exports;
const renderable = new Set(['process', 'subgraph']);
const process = (id, x, y) => ({ id, type: 'process', x, y, customWidth: 100, customHeight: 60 });

test('large canvas diagrams keep overlapping selected shapes in one ordered layer', () => {
  const back = process('back', 0, 0);
  const front = process('front', 40, 20);
  const separate = process('separate', 300, 0);
  const nodeIds = getDomNodeIdsForLayering([back, front, separate], ['back'], undefined, renderable);
  assert.deepEqual([...nodeIds], ['back', 'front']);
  assert.deepEqual([back, front, separate].filter(node => nodeIds.has(node.id)).map(node => node.id), ['back', 'front']);
  assert.deepEqual([front, separate, back].filter(node => nodeIds.has(node.id)).map(node => node.id), ['front', 'back']);
});

test('section backgrounds render in the bitmap until selected, then share a layer with their members', () => {
  const group = { id: 'group', type: 'subgraph', x: 0, y: 0, customWidth: 300, customHeight: 200 };
  const member = process('member', 40, 40);
  assert.equal(getDomNodeIdsForLayering([group, member], [], undefined, renderable).size, 0);
  assert.deepEqual([...getDomNodeIdsForLayering([group, member], ['group'], undefined, renderable)], ['group', 'member']);
});

test('overlap promotion follows chains and preserves nonrenderable shape ordering', () => {
  const a = process('a', 0, 0);
  const b = process('b', 80, 0);
  const c = process('c', 160, 0);
  const other = { ...process('other', 500, 0), type: 'table' };
  const ids = getDomNodeIdsForLayering([a, b, c, other], ['a'], undefined, renderable);
  assert.deepEqual([...ids], ['a', 'other', 'b', 'c']);
});
