/**
 * Minimaler Client für die Hosttech DNS REST API.
 * Endpunkt: https://api.ns1.hosttech.eu/api/v1
 *
 * Keine externen Abhängigkeiten. fetch ist injizierbar, damit die Tests
 * ohne Netzwerk laufen.
 */

export const DEFAULT_BASE_URL = 'https://api.ns1.hosttech.eu/api/v1';

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class HosttechError extends Error {
  constructor(message, { status = null, retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = 'HosttechError';
    this.status = status;
    this.retryable = retryable;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class HosttechClient {
  constructor({
    token,
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = globalThis.fetch,
    timeoutMs = 10_000,
    maxAttempts = 3,
    retryDelayMs = 1_000,
  } = {}) {
    if (!token) throw new HosttechError('API-Token fehlt.');
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxAttempts = maxAttempts;
    this.retryDelayMs = retryDelayMs;
  }

  /**
   * Führt einen Request mit exponentiellem Backoff aus.
   * Wiederholt wird nur bei Netzwerkfehlern, Timeouts, 429 und 5xx.
   * Alle Schreibaufrufe sind idempotent (PUT mit vollständigem Zielzustand).
   */
  async request(path, options = {}) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.#send(path, options);
      } catch (err) {
        if (!err.retryable || attempt >= this.maxAttempts) throw err;
        await sleep(this.retryDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  async #send(path, { method = 'GET', body } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let res;
      try {
        res = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
            ...(body !== undefined && { 'Content-Type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (cause) {
        throw new HosttechError(`Netzwerkfehler bei ${method} ${path}: ${cause.message}`, {
          retryable: true,
          cause,
        });
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new HosttechError(
          `HTTP ${res.status} bei ${method} ${path}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
          { status: res.status, retryable: RETRYABLE_STATUS.has(res.status) },
        );
      }

      return res.status === 204 ? null : await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Sammelt alle Seiten einer Liste ein. Die Paginierung folgt der
   * Laravel-typischen Struktur meta.current_page / meta.last_page.
   * Falls die API keine meta-Angaben liefert, wird eine Seite gelesen.
   */
  async #getAll(path) {
    const items = [];
    for (let page = 1; ; page++) {
      const separator = path.includes('?') ? '&' : '?';
      const json = await this.request(`${path}${separator}page=${page}`);
      items.push(...(json?.data ?? []));
      const lastPage = json?.meta?.last_page;
      if (!lastPage || page >= lastPage) return items;
    }
  }

  async findZoneId(domain) {
    const zones = await this.#getAll('/user/v1/zones');
    const zone = zones.find((z) => z.name === domain);
    if (!zone) {
      throw new HosttechError(`Zone ${domain} nicht im Hosttech-Account gefunden.`);
    }
    return zone.id;
  }

  async listRecords(zoneId) {
    return this.#getAll(`/user/v1/zones/${zoneId}/records`);
  }

  async updateRecord(zoneId, record, { value }) {
    return this.request(`/user/v1/zones/${zoneId}/records/${record.id}`, {
      method: 'PUT',
      body: {
        name: record.name,
        type: record.type,
        value,
        ttl: record.ttl || 300,
      },
    });
  }
}
