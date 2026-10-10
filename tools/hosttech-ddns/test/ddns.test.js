import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/ddns.js';
import { loadConfig } from '../src/config.js';
import { fakeFetch, ZONE, A_RECORD } from './helpers.js';

const BASE_ENV = { HOSTTECH_TOKEN: 'test-token', HOSTTECH_DOMAIN: 'djjessejay.ch' };

test('loadConfig verlangt Token und Domain', () => {
  assert.throws(() => loadConfig({ HOSTTECH_DOMAIN: 'x.ch' }), /HOSTTECH_TOKEN fehlt/);
  assert.throws(() => loadConfig({ HOSTTECH_TOKEN: 'x' }), /HOSTTECH_DOMAIN fehlt/);
});

test('loadConfig setzt Defaults', () => {
  const cfg = loadConfig(BASE_ENV);
  assert.equal(cfg.recordName, '@');
  assert.equal(cfg.recordType, 'A');
  assert.equal(cfg.staticIp, null);
  assert.equal(cfg.ipCheckUrl, 'https://api4.ipify.org');
  assert.equal(cfg.timeoutMs, 10_000);
  assert.equal(cfg.dryRun, false);
});

test('loadConfig erkennt DDNS_DRY_RUN und lehnt ungültige Werte ab', () => {
  assert.equal(loadConfig({ ...BASE_ENV, DDNS_DRY_RUN: 'yes' }).dryRun, true);
  assert.equal(loadConfig({ ...BASE_ENV, DDNS_DRY_RUN: '0' }).dryRun, false);
  assert.throws(() => loadConfig({ ...BASE_ENV, HTTP_TIMEOUT_MS: '-5' }), /positive ganze Zahl/);
  assert.throws(() => loadConfig({ ...BASE_ENV, HOSTTECH_RECORD_TYPE: 'AAAA' }), /nicht unterstützt/);
});

test('run aktualisiert den Record mit der ermittelten IP', async () => {
  const fetchImpl = fakeFetch(({ url, method }) => {
    if (url === 'https://api4.ipify.org') return { text: '203.0.113.9' };
    if (method === 'PUT') return { body: { ok: true } };
    if (url.includes('/records')) return { body: { data: [A_RECORD] } };
    return { body: { data: [ZONE] } };
  });
  const logs = [];
  const result = await run(BASE_ENV, { fetchImpl, log: (m) => logs.push(m) });

  assert.equal(result.changed, true);
  assert.equal(fetchImpl.calls.filter((c) => c.method === 'PUT').length, 1);
  assert.match(logs[0], /djjessejay\.ch: 185\.101\.92\.1 -> 203\.0\.113\.9/);
});

test('run überspringt IP-Abfrage, wenn HOSTTECH_IP gesetzt ist', async () => {
  const fetchImpl = fakeFetch(({ url, method }) => {
    if (method === 'PUT') return { body: { ok: true } };
    if (url.includes('/records')) return { body: { data: [{ ...A_RECORD, value: '198.51.100.7' }] } };
    return { body: { data: [ZONE] } };
  });
  const result = await run({ ...BASE_ENV, HOSTTECH_IP: '198.51.100.7' }, { fetchImpl, log: () => {} });
  assert.equal(result.changed, false);
  assert.ok(!fetchImpl.calls.some((c) => c.url.includes('ipify')));
});
