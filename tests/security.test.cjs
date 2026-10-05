const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { TextEncoder, TextDecoder } = require('node:util');

const compile = (relativePath, dependencies = {}) => {
  const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const moduleState = { exports: {} };
  vm.runInNewContext(outputText, {
    module: moduleState,
    exports: moduleState.exports,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    console,
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return moduleState.exports;
};

const diagramSecurity = compile('../src/utils/diagramSecurity.ts');
const shareUtils = compile('../src/utils/shareUtils.ts', { './diagramSecurity': diagramSecurity });
const { parseAndValidateDiagramContent } = diagramSecurity;

const validContent = {
  nodes: [{ id: 'node-1', type: 'process', label: 'Safe', x: 10, y: 20 }],
  edges: [],
  drawings: [],
};

test('accepts bounded diagram content', () => {
  const result = parseAndValidateDiagramContent(JSON.stringify(validContent));
  assert.equal(result.ok, true);
  assert.equal(result.value.nodes.length, 1);
});

test('rejects SVG attribute injection in freehand paths', () => {
  const result = parseAndValidateDiagramContent(JSON.stringify({
    ...validContent,
    drawings: [{ id: 'draw-1', path: 'M 0 0" onload="alert(1)' }],
  }));
  assert.equal(result.ok, false);
  assert.match(result.error, /freehand path/);
});

test('rejects prototype keys and connections to unknown shapes', () => {
  const poisoned = parseAndValidateDiagramContent('{"nodes":[],"edges":[],"drawings":[],"__proto__":{"admin":true}}');
  assert.equal(poisoned.ok, false);
  assert.match(poisoned.error, /forbidden property/);

  const dangling = parseAndValidateDiagramContent(JSON.stringify({
    ...validContent,
    edges: [{ id: 'edge-1', source: 'node-1', target: 'missing' }],
  }));
  assert.equal(dangling.ok, false);
  assert.match(dangling.error, /unknown shape/);
});

test('share decoder rejects malformed and oversized payloads', () => {
  const malicious = Buffer.from(JSON.stringify({
    id: 'shared', title: 'Unsafe', type: 'flowchart',
    content: JSON.stringify({ ...validContent, drawings: [{ id: 'x', path: '<script>' }] }),
  })).toString('base64');
  assert.equal(shareUtils.decodeSharePayload(`#d=${malicious}`), null);
  assert.equal(shareUtils.decodeSharePayload(`#d=${'A'.repeat(256 * 1024 + 1)}`), null);
});
