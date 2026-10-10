/**
 * Fake fetch für Tests. Der Handler bekommt URL, Init und Aufrufnummer und
 * liefert { status, body } oder { status, text } für Rohtext.
 */
export function fakeFetch(handler) {
  const calls = [];

  const fetchImpl = async (url, init = {}) => {
    const call = {
      url: String(url),
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
      body: init.body === undefined ? undefined : JSON.parse(init.body),
    };
    calls.push(call);

    const { status = 200, body, text } = await handler(call, calls.length);
    const raw = text ?? (body === undefined ? '' : JSON.stringify(body));

    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => raw,
      json: async () => JSON.parse(raw),
    };
  };

  fetchImpl.calls = calls;
  return fetchImpl;
}

export const ZONE = { id: 42, name: 'djjessejay.ch' };

export const A_RECORD = { id: 7, name: '@', type: 'A', value: '185.101.92.1', ttl: 300 };
