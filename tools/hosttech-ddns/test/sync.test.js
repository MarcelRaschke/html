import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HosttechClient } from '../src/hosttech-client.js';
import { detectPublicIp, isValidIPv4, syncRecord } from '../src/sync.js';
import { fakeFetch, ZONE, A_RECORD } from './helpers.js';

const zoneAndRecords = (records) =>
  fakeFetch(({ url, method }) => {
    if (method === 'PUT') return { body: { ok: true } };
    if (url.includes('/records')) return { body: { data: records } };
    return { body: { data: [ZONE] } };
  });

const sync = (fetchImpl, overrides = {}) =>
  syncRecord({
    client: new HosttechClient({ token: 't', fetchImpl, retryDelayMs: 0 }),
    domain: 'djjessejay.ch',
    recordName: '@',
    ip: '203.0.113.9',
    ...overrides,
  });

const putCalls = (fetchImpl) => fetchImpl.calls.filter((c) => c.method === 'PUT');

test('isValidIPv4 akzeptiert gültige und verwirft ungültige Adressen', () => {
  assert.equal(isValidIPv4('185.101.92.15'), true);
  assert.equal(isValidIPv4('0.0.0.0'), true);
  assert.equal(isValidIPv4('256.1.1.1'), false);
  assert.equal(isValidIPv4('1.2.3'), false);
  assert.equal(isValidIPv4('1.2.3.4.5'), false);
  assert.equal(isValidIPv4('<html>'), false);
  assert.equal(isValidIPv4(undefined), false);
});

test('syncRecord schreibt nicht, wenn der Record bereits stimmt', async () => {
  const fetchImpl = zoneAndRecords([{ ...A_RECORD, value: '203.0.113.9' }]);
  const result = await sync(fetchImpl);
  assert.equal(result.changed, false);
  assert.equal(putCalls(fetchImpl).length, 0);
});

test('syncRecord aktualisiert bei Abweichung genau einmal', async () => {
  const fetchImpl = zoneAndRecords([A_RECORD]);
  const result = await sync(fetchImpl);
  assert.deepEqual(result, { changed: true, previous: '185.101.92.1', current: '203.0.113.9', dryRun: false });
  const [put] = putCalls(fetchImpl);
  assert.equal(put.body.value, '203.0.113.9');
});

test('Dry-Run liest, schreibt aber nicht', async () => {
  const fetchImpl = zoneAndRecords([A_RECORD]);
  const result = await sync(fetchImpl, { dryRun: true });
  assert.equal(result.changed, true);
  assert.equal(result.dryRun, true);
  assert.equal(putCalls(fetchImpl).length, 0);
});

test('Mehrdeutige Records führen zu einem Fehler ohne Schreibzugriff', async () => {
  const fetchImpl = zoneAndRecords([A_RECORD, { ...A_RECORD, id: 8 }]);
  await assert.rejects(sync(fetchImpl), /Mehrdeutig: 2 Records/);
  assert.equal(putCalls(fetchImpl).length, 0);
});

test('Fehlender Record führt zu einem Fehler', async () => {
  const fetchImpl = zoneAndRecords([]);
  await assert.rejects(sync(fetchImpl), /nicht in Zone djjessejay.ch gefunden/);
});

test('Ungültige IP wird ohne jeden Request abgelehnt', async () => {
  const fetchImpl = zoneAndRecords([A_RECORD]);
  await assert.rejects(sync(fetchImpl, { ip: 'not-an-ip' }), /Ungültige IPv4/);
  assert.equal(fetchImpl.calls.length, 0);
});

test('detectPublicIp liefert getrimmte IPv4', async () => {
  const fetchImpl = fakeFetch(() => ({ text: '185.101.92.15\n' }));
  assert.equal(await detectPublicIp({ url: 'https://example.test', fetchImpl }), '185.101.92.15');
});

test('detectPublicIp verwirft HTML-Antworten', async () => {
  const fetchImpl = fakeFetch(() => ({ text: '<!doctype html><title>Maintenance</title>' }));
  await assert.rejects(detectPublicIp({ url: 'https://example.test', fetchImpl }), /keine gültige IPv4/);
});

test('detectPublicIp meldet HTTP-Fehler des IP-Dienstes', async () => {
  const fetchImpl = fakeFetch(() => ({ status: 503, text: '' }));
  await assert.rejects(detectPublicIp({ url: 'https://example.test', fetchImpl }), /HTTP 503/);
});
