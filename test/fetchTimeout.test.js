import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchWithTimeout } from '../src/lib/fetchTimeout.js';

// A server that accepts the connection but never answers — the failure mode
// that wedged the card: without an abort, the request holds its socket (and a
// slot in the browser's per-host pool) long after the UI gave up on it.
function hangingServer() {
  const sockets = new Set();
  const server = http.createServer(() => {
    /* never respond */
  });
  server.on('connection', (s) => sockets.add(s));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}/`,
        close: () => {
          for (const s of sockets) s.destroy();
          server.close();
        }
      });
    });
  });
}

test('fetchWithTimeout aborts a hung request instead of leaking it', async () => {
  const srv = await hangingServer();
  try {
    const started = Date.now();
    await assert.rejects(
      fetchWithTimeout(srv.url, {}, 150),
      (err) => err.name === 'AbortError' || /abort/i.test(err.message)
    );
    assert.ok(Date.now() - started < 2000, 'should abort promptly, not hang');
  } finally {
    srv.close();
  }
});

test('fetchWithTimeout passes a normal response through', async () => {
  const server = http.createServer((_, res) => res.end('{"ok":true}'));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const res = await fetchWithTimeout(`http://127.0.0.1:${server.address().port}/`, {}, 5000);
    assert.equal((await res.json()).ok, true);
  } finally {
    server.close();
  }
});
