import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const content = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
for (const line of content.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  console.log(k, 'len=' + v.length, 'prefix=' + v.slice(0, 10), 'suffix=' + v.slice(-4));
}
