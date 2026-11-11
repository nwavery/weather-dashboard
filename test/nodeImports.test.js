import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Another app imports src/lib and src/data straight from git, in plain Node
// with no bundler. So every module there must load with no JSX, no Vite
// import.meta.env, and no browser global touched at import time. The list is
// read from the directories, so a new module is covered the day it lands.
//
// Failure messages name the file only: src/lib/secretPlaces.js holds real
// coordinates, and an assertion that printed source text would leak them.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CODE = /\.(m?js|cjs|jsx|tsx?)$/;

function modulesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return modulesUnder(p);
    return CODE.test(e.name) ? [p] : [];
  });
}

// True when source text reads Vite's import.meta.env, however it is spaced or
// bracketed. `import.meta.env?.X` loads fine in Node and is silently undefined
// there, so loading alone cannot catch it.
function readsViteEnv(source) {
  return /import\.meta(\.|\[["'`])env\b/.test(source.replace(/\s+/g, ''));
}

const modules = ['src/lib', 'src/data'].flatMap((d) => modulesUnder(join(ROOT, d))).sort();

test('the walk finds the modules', () => {
  const names = modules.map((m) => relative(ROOT, m));
  for (const known of ['src/lib/conditions.js', 'src/lib/radar.js', 'src/data/weatherCodes.js']) {
    assert.ok(names.includes(known), `${known} not found`);
  }
});

for (const file of modules) {
  const name = relative(ROOT, file);
  test(`${name} imports in plain Node`, async () => {
    try {
      await import(pathToFileURL(file).href);
    } catch (err) {
      assert.fail(`${name} threw on import: ${err?.name}: ${err?.message?.split('\n')[0]}`);
    }
    assert.ok(!readsViteEnv(readFileSync(file, 'utf8')), `${name} reads import.meta.env`);
  });
}

test('readsViteEnv sees every spelling, and nothing else', () => {
  for (const s of ['import.meta.env.VITE_X', 'import.meta.env?.X', 'import . meta\n  .env', "import.meta['env']", 'import.meta["env"].X']) {
    assert.equal(readsViteEnv(s), true, s);
  }
  for (const s of ['import.meta.url', 'process.env.X', 'import.meta.environment']) {
    assert.equal(readsViteEnv(s), false, s);
  }
});
