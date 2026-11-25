const endpoint = 'https://musicbrainz.org/ws/2/';
const minute = 60_000;

export function catalogError(status, message, options = {}) {
  return Object.assign(new Error(message), { status, statusCode: status }, options);
}

function publicContactUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return '';
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || /(^|\.)(localhost|local|test|invalid|example)$/.test(host) ||
        /^(?:example\.(?:com|org|net)|.*\.(?:internal|lan))$/.test(host) ||
        /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return '';
    return url.href;
  } catch { return ''; }
}

export function musicbrainzContact(env = process.env) {
  const supplied = (env.MUSICBRAINZ_CONTACT || '').trim();
  if (supplied.length > 240 || /[\r\n()]/.test(supplied)) return '';
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(supplied)) return supplied;
  if (supplied) return publicContactUrl(supplied);
  return publicContactUrl(env.APP_ORIGIN);
}

export function createMusicBrainzRequest({
  getContact = musicbrainzContact, fetcher = (...args) => fetch(...args),
  spacing = 1100, timeout = 9000, now = Date.now
} = {}) {
  const cache = new Map();
  const pending = new Map();
  let gate = Promise.resolve();
  let nextStart = 0;
  let cooldown = 0;
  let providerFailures = 0;
  const pauseError = () => catalogError(503, 'O MusicBrainz pediu uma pausa nas consultas. Tente novamente em instantes.',
    { retryAfter: Math.max(1, Math.ceil((cooldown - now()) / 1000)) });

  async function startSlot() {
    if (cooldown > now()) throw pauseError();
    const delay = Math.max(0, nextStart - now());
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (cooldown > now()) throw pauseError();
    nextStart = now() + spacing;
  }
  async function read(url, identity) {
    const slot = gate.then(startSlot);
    gate = slot.catch(() => {});
    await slot;
    let response;
    try {
      response = await fetcher(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'CAPA/1.1 (' + identity + ')' },
        signal: AbortSignal.timeout(timeout), redirect: 'error'
      });
      if (response.status === 429 || response.status === 503) {
        const raw = response.headers.get('Retry-After');
        const until = /^\d+$/.test(raw || '') ? now() + Number(raw) * 1000 : Date.parse(raw);
        providerFailures++;
        const backoff = Math.min(30 * 60_000, 60_000 * (2 ** Math.min(providerFailures - 1, 5)));
        cooldown = Math.max(now() + backoff, Number.isFinite(until) ? until : 0);
        throw pauseError();
      }
      if (response.status === 404) throw catalogError(404, 'Item não encontrado no MusicBrainz.');
      if (!response.ok) throw catalogError(503, 'O MusicBrainz não conseguiu atender a consulta.');
      const result = await response.json();
      providerFailures = 0;
      return result;
    } catch (error) {
      if (error.statusCode) throw error;
      throw catalogError(503, 'Não foi possível consultar o MusicBrainz. O acervo local continua disponível.');
    }
  }
  return function request(resource, params = {}) {
    if (!/^(artist|release-group|release|recording)(?:\/[a-f0-9-]{36})?$/.test(resource)) {
      throw catalogError(400, 'Recurso musical desconhecido.');
    }
    const url = new URL(resource, endpoint);
    url.search = new URLSearchParams({ fmt: 'json', ...params }).toString();
    const key = url.href;
    const entry = cache.get(key);
    if (entry && entry.until > now()) return Promise.resolve(entry.value);
    const identity = getContact();
    if (!identity) throw catalogError(503, 'A busca online requer um contato institucional em MUSICBRAINZ_CONTACT ou uma APP_ORIGIN pública HTTPS. O acervo local está disponível.');
    if (pending.has(key)) return pending.get(key);
    if (cooldown > now()) throw pauseError();
    if (pending.size >= 12) throw catalogError(503, 'O catálogo externo está ocupado. Tente novamente em instantes.');
    const result = read(url, identity).then(value => {
      if (cache.size >= 160) cache.delete(cache.keys().next().value);
      cache.set(key, { value, until: now() + (params.query ? 10 : 60) * minute });
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, result);
    return result;
  };
}
