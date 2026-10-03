import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';

const probePath = '/.well-known/appspecific/com.chrome.devtools.json';

for (const method of ['GET', 'HEAD']) {
  test(`Chrome DevTools ${method} probe gets an empty, uncached response`, async () => {
    const response = await middleware(new NextRequest(`http://localhost:3000${probePath}`, { method }));
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('x-middleware-next'), null);
  });
}

for (const request of [
  { path: probePath, method: 'POST' },
  { path: `${probePath}/other`, method: 'GET' },
]) {
  test(`DevTools handling does not intercept ${request.method} ${request.path}`, async () => {
    const response = await middleware(new NextRequest(`http://localhost:3000${request.path}`, { method: request.method }));
    assert.equal(response.headers.get('x-middleware-next'), '1');
  });
}
