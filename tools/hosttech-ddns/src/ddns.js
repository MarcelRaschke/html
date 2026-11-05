#!/usr/bin/env node
/**
 * Einstiegspunkt: IP ermitteln, DNS-Record bei Abweichung aktualisieren.
 * Exit-Code 0 bei Erfolg oder unverändertem Record, 1 bei Fehler.
 */

import { pathToFileURL } from 'node:url';
import { HosttechClient } from './hosttech-client.js';
import { loadConfig } from './config.js';
import { detectPublicIp, syncRecord } from './sync.js';

const stamp = () => new Date().toISOString();

export async function run(env = process.env, { fetchImpl = globalThis.fetch, log = console.log } = {}) {
  const cfg = loadConfig(env);
  const client = new HosttechClient({
    token: cfg.token,
    fetchImpl,
    timeoutMs: cfg.timeoutMs,
  });

  const ip =
    cfg.staticIp ??
    (await detectPublicIp({ url: cfg.ipCheckUrl, fetchImpl, timeoutMs: cfg.timeoutMs }));

  const result = await syncRecord({
    client,
    domain: cfg.domain,
    recordName: cfg.recordName,
    recordType: cfg.recordType,
    ip,
    dryRun: cfg.dryRun,
  });

  const fqdn = cfg.recordName === '@' ? cfg.domain : `${cfg.recordName}.${cfg.domain}`;
  if (!result.changed) {
    log(`[${stamp()}] ${fqdn} zeigt bereits auf ${ip}, keine Änderung.`);
  } else {
    const suffix = cfg.dryRun ? ' (Dry-Run, nicht geschrieben)' : '';
    log(`[${stamp()}] ${fqdn}: ${result.previous} -> ${ip}${suffix}`);
  }
  return result;
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  run().catch((err) => {
    console.error(`[${stamp()}] FEHLER: ${err.message}`);
    process.exitCode = 1;
  });
}
