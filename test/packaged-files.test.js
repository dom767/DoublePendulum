import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
test('HTML local resources exist and all test files are discovered',()=>{
  const html=readFileSync('index.html','utf8');
  for(const match of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) {
    if(!match[1].startsWith('https:')) assert.ok(existsSync(match[1]),match[1]);
  }
  assert.equal(JSON.parse(readFileSync('package.json','utf8')).scripts.test,'node --experimental-vm-modules --test test');
});

test('packageBuild emits versioned bundles and consent.js', async () => {
  const { mkdtempSync, rmSync, readFileSync: read, existsSync: exists } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { packageBuild, assertVersioned } = await import('../actions/lib/build.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'pendulum-pkg-'));
  try {
    const version = '0.0.99';
    await packageBuild({ dir, version });
    assert.ok(exists(join(dir, 'app.bundle.min.js')));
    assert.ok(exists(join(dir, 'app.bundle.min.css')));
    const html = read(join(dir, 'index.html'), 'utf8');
    assert.match(html, new RegExp(`/consent\\.js\\?v=${version.replace(/\./g, '\\.')}`));
    assert.match(html, /__DOUBLE_PENDULUM_ASSET_VERSION__ = "0\.0\.99"/);
    assert.match(html, /app\.bundle\.min\.js\?v=0\.0\.99/);
    assert.match(html, /app\.bundle\.min\.css\?v=0\.0\.99/);
    assert.equal(html.includes('src/main.js'), false);
    assert.equal(html.includes('styles.css'), false);
    assertVersioned(dir, version);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

