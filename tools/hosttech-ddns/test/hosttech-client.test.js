import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HosttechClient, HosttechError } from '../src/hosttech-client.js';
import { fakeFetch, ZONE, A_RECORD } from './helpers.js';

const client = (fetchImpl, extra = {}) =>
  new HosttechClient({ token: 'test-token', fetchImpl, retryDelayMs: 0, ...extra });

test('findZoneId liefert die ID der passenden Zone', async () => {
  const fetchImpl = fakeFetch(() => ({ body: { data: [{ id: 1, name: 'other.ch' }, ZONE] } }));
  assert.equal(await client(fetchImpl).findZoneId('djjessejay.ch'), 42);
});

test('findZoneId wirft, wenn die Zone fehlt', async () => {
  const fetchImpl = fakeFetch(() => ({ body: { data: [] } }));
  await assert.rejects(client(fetchImpl).findZoneId('djjessejay.ch'), /nicht im Hosttech-Account/);
});

test('Requests senden Bearer-Token und Accept-Header', async () => {
  const fetchImpl = fakeFetch(() => ({ body: { data: [] } }));
  await client(fetchImpl).request('/user/v1/zones');
  const [call] = fetchImpl.calls;
  assert.equal(call.url, 'https://api.ns1.hosttech.eu/api/v1/user/v1/zones');
  assert.equal(call.headers.Authorization, 'Bearer test-token');
  assert.equal(call.headers.Accept, 'application/json');
});

test('503 wird wiederholt, bis eine Antwort erfolgreich ist', async () => {
  const fetchImpl = fakeFetch((_, n) => (n < 3 ? { status: 503, text: 'busy' } : { body: { data: [] } }));
  const json = await client(fetchImpl, { maxAttempts: 3 }).request('/user/v1/zones');
  assert.deepEqual(json, { data: [] });
  assert.equal(fetchImpl.calls.length, 3);
});

test('401 wird nicht wiederholt', async () => {
  const fetchImpl = fakeFetch(() => ({ status: 401, text: 'unauthorized' }));
  await assert.rejects(client(fetchImpl).request('/user/v1/zones'), (err) => {
    assert.ok(err instanceof HosttechError);
    assert.equal(err.status, 401);
    assert.equal(err.retryable, false);
    return true;
  });
  assert.equal(fetchImpl.calls.length, 1);
});

test('Nach maxAttempts wird der letzte Fehler geworfen', async () => {
  const fetchImpl = fakeFetch(() => ({ status: 500, text: 'boom' }));
  await assert.rejects(client(fetchImpl, { maxAttempts: 2 }).request('/x'), /HTTP 500/);
  assert.equal(fetchImpl.calls.length, 2);
});

test('Netzwerkfehler gelten als wiederholbar', async () => {
  let n = 0;
  const flaky = async (url, init) => {
    n += 1;
    if (n === 1) throw new TypeError('fetch failed');
    return fakeFetch(() => ({ body: { ok: true } }))(url, init);
  };
  const json = await client(flaky).request('/x');
  assert.deepEqual(json, { ok: true });
  assert.equal(n, 2);
});

test('listRecords folgt der Paginierung über meta.last_page', async () => {
  const fetchImpl = fakeFetch(({ url }) => {
    const page = Number(new URL(url).searchParams.get('page'));
    return {
      body: {
        data: page === 1 ? [{ id: 1 }] : [{ id: 2 }],
        meta: { current_page: page, last_page: 2 },
      },
    };
  });
  const records = await client(fetchImpl).listRecords(42);
  assert.deepEqual(records.map((r) => r.id), [1, 2]);
  assert.equal(fetchImpl.calls.length, 2);
});

test('updateRecord sendet PUT mit neuer IP und erhaltener TTL', async () => {
  const fetchImpl = fakeFetch(() => ({ body: { ok: true } }));
  await client(fetchImpl).updateRecord(42, A_RECORD, { value: '203.0.113.9' });
  const [call] = fetchImpl.calls;
  assert.equal(call.method, 'PUT');
  assert.equal(call.url.endsWith('/user/v1/zones/42/records/7'), true);
  assert.deepEqual(call.body, { name: '@', type: 'A', value: '203.0.113.9', ttl: 300 });
});
