import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// cardView.css ships in the dashboard's bundle too, so it can only stay out
// of the dashboard if every rule is under html.card-view (set by main.jsx for
// ?view=card alone). This scan fails on any selector that isn't, and on any
// at-rule it can't vouch for (@keyframes names, @font-face and @import are
// global whatever they sit next to).

const SCOPE = /^html\.card-view(?![\w-])/;
const NESTING_AT_RULES = /^@(media|supports|container)\b/;

// Selectors in `css` that are not scoped, plus anything the scan refuses.
function unscoped(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const bad = [];
  let i = 0;
  function block(depth) {
    while (i < src.length) {
      const open = src.indexOf('{', i);
      const close = src.indexOf('}', i);
      if (close !== -1 && (open === -1 || close < open)) {
        if (src.slice(i, close).trim()) bad.push(`stray text: ${src.slice(i, close).trim()}`);
        i = close + 1;
        if (depth > 0) return;
        bad.push('unbalanced }');
        continue;
      }
      if (open === -1) {
        if (src.slice(i).trim()) bad.push(`trailing text: ${src.slice(i).trim()}`);
        i = src.length;
        return;
      }
      const prelude = src.slice(i, open).replace(/\s+/g, ' ').trim();
      i = open + 1;
      if (prelude.startsWith('@')) {
        if (NESTING_AT_RULES.test(prelude)) {
          block(depth + 1);
        } else {
          // Refused whole: skip to its matching brace.
          bad.push(`at-rule: ${prelude}`);
          for (let open = 1; i < src.length && open > 0; i++) open += src[i] === '{' ? 1 : src[i] === '}' ? -1 : 0;
        }
        continue;
      }
      for (const sel of prelude.split(',')) if (!SCOPE.test(sel.trim())) bad.push(sel.trim() || '(empty selector)');
      // Skip the declarations, which hold no selectors.
      const end = src.indexOf('}', i);
      if (end === -1) {
        bad.push('unclosed rule');
        i = src.length;
        return;
      }
      i = end + 1;
    }
    if (depth > 0) bad.push('unclosed block');
  }
  block(0);
  return bad;
}

test('every rule in cardView.css is under html.card-view', () => {
  const css = readFileSync(new URL('../src/cardView.css', import.meta.url), 'utf8');
  assert.deepEqual(unscoped(css), []);
  assert.ok(css.includes('html.card-view .card'), 'the scan read the wrong file');
});

test('the scan catches every unscoped shape', () => {
  const cases = {
    '.card { color: red }': ['.card'],
    'html.card-view .a, .b { x: y }': ['.b'],
    'html.card-view .a,\n  .b\n{ x: y }': ['.b'],
    '@media (max-width: 400px) { html.card-view .ok { x: y } .c { x: y } }': ['.c'],
    '/* html.card-view */ .d { x: y }': ['.d'],
    'html.card-viewer .e { x: y }': ['html.card-viewer .e'],
    'html.card-view-x .f { x: y }': ['html.card-view-x .f'],
    ':root { --x: 1 }': [':root'],
    '* { x: y }': ['*'],
    'body.card-view { x: y }': ['body.card-view'],
    '@keyframes spin { from { x: y } } html.card-view .z { x: y }': ['at-rule: @keyframes spin'],
    '@font-face { font-family: x }': ['at-rule: @font-face'],
    "@import url('x.css');": ["trailing text: @import url('x.css');"]
  };
  for (const [css, want] of Object.entries(cases)) assert.deepEqual(unscoped(css), want, css);
  for (const ok of [
    'html.card-view .a { x: y }',
    'html.card-view { x: y }',
    'html.card-view.dark .a { x: y }',
    'html.card-view > body { x: y }',
    'html.card-view .a:hover, html.card-view .b::after { x: y }',
    '@media (min-width: 1px) { @supports (display: grid) { html.card-view .a { x: y } } }'
  ]) {
    assert.deepEqual(unscoped(ok), [], ok);
  }
});

test('the card never traps the wheel: no overscroll containment', () => {
  // A contained card with nothing to scroll swallows the wheel, so the page
  // around the frame can't be scrolled with the pointer over it. Checked in
  // a real browser for the change that removed it; this keeps it removed.
  const css = readFileSync(new URL('../src/cardView.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // A boolean, not doesNotMatch: a failure would print the whole stylesheet.
  const trapped = /overscroll-behavior(-[xy])?\s*:\s*(contain|none)/.test(css.replace(/\s+/g, ' '));
  assert.ok(!trapped, 'cardView.css sets overscroll-behavior: contain or none');
});
