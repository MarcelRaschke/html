/**
 * Konfiguration ausschließlich über Umgebungsvariablen.
 * Der Token wird nie aus Dateien im Repository gelesen.
 */

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function positiveInt(raw, fallback, name) {
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^\d+$/.test(raw.trim()) || Number(raw) <= 0) {
    throw new Error(`${name} muss eine positive ganze Zahl sein, erhalten: "${raw}"`);
  }
  return Number(raw);
}

export function loadConfig(env = process.env) {
  const required = (name) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Umgebungsvariable ${name} fehlt.`);
    return value;
  };

  const recordType = (env.HOSTTECH_RECORD_TYPE?.trim() || 'A').toUpperCase();
  if (recordType !== 'A') {
    throw new Error(`HOSTTECH_RECORD_TYPE "${recordType}" wird nicht unterstützt. Nur A.`);
  }

  return {
    token: required('HOSTTECH_TOKEN'),
    domain: required('HOSTTECH_DOMAIN'),
    recordName: env.HOSTTECH_RECORD_NAME?.trim() || '@',
    recordType,
    staticIp: env.HOSTTECH_IP?.trim() || null,
    ipCheckUrl: env.IP_CHECK_URL?.trim() || 'https://api4.ipify.org',
    timeoutMs: positiveInt(env.HTTP_TIMEOUT_MS, 10_000, 'HTTP_TIMEOUT_MS'),
    dryRun: TRUTHY.has((env.DDNS_DRY_RUN ?? '').trim().toLowerCase()),
  };
}
