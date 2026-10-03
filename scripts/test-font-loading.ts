import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const layout = readFileSync(resolve('src/app/layout.tsx'), 'utf8');
const styles = readFileSync(resolve('src/app/globals.css'), 'utf8');

const fonts = [
  { name: 'plusJakartaSans', family: 'plus-jakarta-sans', variable: '--font-plus-jakarta-sans', weight: '200 800' },
  { name: 'outfit', family: 'outfit', variable: '--font-outfit', weight: '100 900' },
  { name: 'jetbrainsMono', family: 'jetbrains-mono', variable: '--font-jetbrains-mono', weight: '100 800' },
];

test('root layout uses local fonts without Google download requests', () => {
  assert.doesNotMatch(layout, /next\/font\/google|fonts\.googleapis\.com/);
  assert.match(layout, /import localFont from 'next\/font\/local'/);
});

for (const font of fonts) {
  test(`${font.family} uses its packaged Latin variable font`, () => {
    const config = layout.match(new RegExp(`const ${font.name} = localFont\\(\\{([\\s\\S]*?)\\}\\);`))?.[1];
    assert.ok(config, `Missing local font configuration for ${font.family}`);
    assert.ok(config.includes(`src: '../../node_modules/@fontsource-variable/${font.family}/files/${font.family}-latin-wght-normal.woff2'`));
    assert.ok(config.includes(`weight: '${font.weight}'`));
    assert.ok(config.includes(`variable: '${font.variable}'`));
    assert.ok(config.includes("display: 'swap'"));
    assert.ok(layout.includes(`${font.name}.variable`));
    assert.ok(styles.includes(`var(${font.variable},`));
  });
}

test('semantic font stacks have fallbacks and no circular variable references', () => {
  for (const variable of ['--font-sans', '--font-display', '--font-mono']) {
    const value = styles.match(new RegExp(`${variable}:\\s*([^;]+);`))?.[1];
    assert.ok(value, `Missing ${variable}`);
    assert.ok(!value.includes(`var(${variable}`), `${variable} references itself`);
    assert.match(value, /sans-serif|monospace/);
  }
});
