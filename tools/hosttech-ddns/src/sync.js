/**
 * Kernlogik: Public-IP ermitteln und den A-Record nur bei Abweichung schreiben.
 */

const IPV4_OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${IPV4_OCTET}(\\.${IPV4_OCTET}){3}$`);

export function isValidIPv4(ip) {
  return typeof ip === 'string' && IPV4.test(ip);
}

/**
 * Liefert die öffentliche IPv4-Adresse des Hosts. Antworten, die keine
 * gültige IPv4 enthalten, werden verworfen, damit nie ein Müllwert in DNS landet.
 */
export async function detectPublicIp({ url, fetchImpl = globalThis.fetch, timeoutMs = 10_000 }) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`IP-Abfrage fehlgeschlagen: HTTP ${res.status}`);
  const ip = (await res.text()).trim();
  if (!isValidIPv4(ip)) {
    throw new Error(`IP-Dienst lieferte keine gültige IPv4-Adresse: ${ip.slice(0, 64)}`);
  }
  return ip;
}

/**
 * Stellt sicher, dass genau ein Record name/type in der Zone auf `ip` zeigt.
 * Mehrdeutige Records (z. B. Round-Robin) führen zu einem Fehler statt zu
 * einem stillen Überschreiben.
 */
export async function syncRecord({
  client,
  domain,
  recordName,
  recordType = 'A',
  ip,
  dryRun = false,
}) {
  if (!isValidIPv4(ip)) throw new Error(`Ungültige IPv4-Adresse: ${ip}`);

  const zoneId = await client.findZoneId(domain);
  const records = await client.listRecords(zoneId);
  const matches = records.filter((r) => r.name === recordName && r.type === recordType);

  if (matches.length === 0) {
    throw new Error(`Record ${recordName} (${recordType}) nicht in Zone ${domain} gefunden.`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Mehrdeutig: ${matches.length} Records ${recordName} (${recordType}) in Zone ${domain}.`,
    );
  }

  const [target] = matches;
  const previous = target.value;

  if (previous === ip) {
    return { changed: false, previous, current: ip, dryRun };
  }

  if (!dryRun) {
    await client.updateRecord(zoneId, target, { value: ip });
  }
  return { changed: true, previous, current: ip, dryRun };
}
