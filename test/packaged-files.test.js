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
