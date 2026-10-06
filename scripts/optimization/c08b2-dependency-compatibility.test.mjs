import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'apps/mobile/package.json'));
const parser = require('postcss-selector-parser');
const postcss = require('postcss');
const classes =
  'w-[44px] rounded-card bg-paper text-ink p-4 group-hover:peer-focus:bg-clay dark:bg-night data-[state=open]:bg-paper [&>span]:font-bold focus:before:text-ink';

async function compile(platform) {
  process.env.NATIVEWIND_OS = platform;
  const config = {
    ...require('./tailwind.config.js'),
    content: [{ raw: classes, extension: 'html' }],
  };
  return postcss([require('tailwindcss')(config)]).process(
    '@tailwind base; @tailwind components; @tailwind utilities;',
    { from: undefined },
  );
}

test('both real selector consumers resolve the reviewed fixed parser; no vulnerable lock copy remains', () => {
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json')));
  const copies = Object.entries(lock.packages).filter(([path]) =>
    path.endsWith('node_modules/postcss-selector-parser'),
  );
  assert.ok(copies.length > 0);
  for (const [, entry] of copies) assert.equal(entry.version, '7.1.6');
  for (const consumer of ['tailwindcss', 'postcss-nested']) {
    const consumerRequire = createRequire(require.resolve(consumer + '/package.json'));
    assert.equal(consumerRequire('postcss-selector-parser/package.json').version, '7.1.6');
  }
});

test('selector walking remains bounded when inserting before and after the current node', () => {
  const ast = parser().astSync('.a.b');
  const visited = [];
  ast.walkClasses((node) => {
    visited.push(node.value);
    assert.ok(visited.length <= 4, 'original nodes must not be revisited after insertion');
    if (!['a', 'b'].includes(node.value)) return;
    node.parent.insertBefore(node, parser.className({ value: 'before-' + node.value }));
    node.parent.insertAfter(node, parser.className({ value: 'after-' + node.value }));
  });
  assert.deepEqual(visited, ['a', 'after-a', 'b', 'after-b']);
  assert.equal(ast.toString(), '.before-a.a.after-a.before-b.b.after-b');
});

test('PostCSS nesting preserves parent alternatives, pseudo selectors, and nested media transforms', async () => {
  const result = await postcss([require('postcss-nested')]).process(
    '.card,.detail { &:is(.active,.ready) > .note { color:red } .group:hover & { display:flex } @media(min-width:375px) { & + & { margin:4px } } }',
    { from: undefined },
  );
  const selectors = [];
  result.root.walkRules((rule) => selectors.push(rule.selector));
  assert.deepEqual(selectors, [
    '.card:is(.active,.ready) > .note,.detail:is(.active,.ready) > .note',
    '.group:hover .card, .group:hover .detail',
    '.card + .card, .detail + .detail',
  ]);
  assert.equal(result.warnings().length, 0);
});

test('the real web NativeWind preset generates composed variants and app tokens', async () => {
  const result = await compile('web');
  assert.equal(result.warnings().length, 0);
  assert.match(result.css, /width: 44px/);
  assert.match(result.css, /border-radius: 24px/);
  assert.match(result.css, /group:hover/);
  assert.match(result.css, /peer:focus/);
  const attributes = [];
  result.root.walkRules((rule) =>
    parser()
      .astSync(rule.selector)
      .walkAttributes((node) => {
        attributes.push([node.attribute, node.value]);
      }),
  );
  assert.ok(attributes.some(([name, value]) => name === 'data-state' && value === 'open'));
  assert.match(result.css, /:is\(.dark/);
});

test('the real native NativeWind compiler retains representative layout and color values', async () => {
  const result = await compile('ios');
  const { cssToReactNativeRuntime } = require('react-native-css-interop/css-to-rn');
  const native = cssToReactNativeRuntime(result.css, {
    grouping: ['^group(/.*)?', '^peer(/.*)?'],
    inlineRem: 14,
  });
  const styles = (name) =>
    Object.assign({}, ...native.rules[name].n.flatMap((rule) => rule.d.flat()));
  assert.equal(styles('w-[44px]').width, 44);
  assert.equal(styles('rounded-card').borderRadius, 24);
  assert.equal(styles('bg-paper').backgroundColor, '#faf7f2');
  assert.equal(styles('text-ink').color, '#201b15');
  assert.equal(styles('p-4').padding, 14);
});
