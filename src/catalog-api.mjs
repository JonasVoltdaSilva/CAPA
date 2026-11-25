// A fila deve ser compartilhada por todas as instâncias que saem pelo mesmo IP.
// A distribuição inicial executa um processo de aplicação.
const interval = 1100;
const lifetime = 60 * 60 * 1000;
const mbidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const types = new Map([['Album', 'Álbum'], ['EP', 'EP'], ['Single', 'Single']]);
const pending = new Map();
const cached = new Map();
let queue = Promise.resolve();
let nextStart = 0;

function failure(status, message) {
  return Object.assign(new Error(message), { status, statusCode: status });
}

function contact() {
  const value = (process.env.MUSICBRAINZ_CONTACT || '').trim();
  if (value.length > 240 || /[^\x21-\x7e]/.test(value)) return '';
  if (/^[^@\s()]+@[^@\s()]+\.[^@\s()]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

async function upstream(path, identity) {
  const delay = Math.max(0, nextStart - Date.now());
  if (delay > 9000) throw failure(503, 'O MusicBrainz solicitou uma pausa nas consultas. Tente novamente mais tarde.');
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
  nextStart = Date.now() + interval;
  let response;
  try {
    response = await fetch(new URL(path, 'https://musicbrainz.org/ws/2/'), {
      headers: { Accept: 'application/json', 'User-Agent': 'CAPA/1.0 (' + identity + ')' },
      signal: AbortSignal.timeout(6500),
      redirect: 'error'
    });
    if (response.status === 404) throw failure(404, 'Edição não encontrada no MusicBrainz.');
    if (response.status === 503 || response.status === 429) {
      const retry = response.headers.get('Retry-After');
      const seconds = Number(retry);
      const until = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(retry);
      nextStart = Math.max(nextStart, Date.now() + 4000, Number.isFinite(until) ? until : 0);
    }
    if (!response.ok) throw failure(503, 'MusicBrainz indisponível. Tente novamente mais tarde.');
    return await response.json();
  } catch (err) {
    if (err.status) throw err;
    throw failure(503, 'Não foi possível consultar o MusicBrainz. O acervo local continua disponível.');
  }
}

function request(path) {
  const identity = contact();
  if (!identity) throw failure(503, 'A busca online requer um contato do operador em MUSICBRAINZ_CONTACT. Pesquise no acervo local.');
  const entry = cached.get(path);
  if (entry && entry.until > Date.now()) return Promise.resolve(entry.data);
  if (pending.has(path)) return pending.get(path);
  if (pending.size >= 8 || nextStart > Date.now() + 9000) {
    throw failure(503, 'O catálogo externo está ocupado. Tente novamente em instantes.');
  }
  const task = queue.then(() => upstream(path, identity)).then(data => {
    if (cached.size >= 96) cached.delete(cached.keys().next().value);
    cached.set(path, { until: Date.now() + lifetime, data });
    return data;
  }).finally(() => pending.delete(path));
  pending.set(path, task);
  queue = task.catch(() => {});
  return task;
}

function info(release) {
  const credits = release['artist-credit'] || [];
  return {
    mbid: release.id,
    title: release.title,
    artist: credits.map(c => (c.name || c.artist?.name || '') + (c.joinphrase || '')).join(''),
    year: release.date ? Number(release.date.slice(0, 4)) : null,
    type: types.get(release['release-group']?.['primary-type'])
  };
}

export async function searchCatalog(query) {
  const term = String(query || '').normalize('NFC').trim();
  if (term.length < 2 || term.length > 120) throw failure(400, 'Pesquise de 2 a 120 caracteres.');
  const words = term.match(/[\p{L}\p{N}]+/gu)?.slice(0, 12) || [];
  if (!words.length) return [];
  const matches = words.map(word => '(release:"' + word + '" OR artist:"' + word + '")').join(' AND ');
  const params = new URLSearchParams({ fmt: 'json', limit: '35', query: '(' + matches + ') AND status:official' });
  const data = await request('release?' + params);
  const seen = new Set();
  const results = [];
  for (const release of data.releases || []) {
    const item = info(release);
    const key = release['release-group']?.id || item.mbid;
    if (!item.type || !item.title || !item.artist || !mbidPattern.test(item.mbid) || seen.has(key)) continue;
    seen.add(key);
    results.push(item);
  }
  return results;
}

export async function importAlbum(mbid) {
  if (!mbidPattern.test(mbid)) throw failure(400, 'Identificador de edição inválido.');
  const id = mbid.toLowerCase();
  const release = await request('release/' + id + '?fmt=json&inc=recordings%2Bartist-credits%2Brelease-groups');
  const item = info(release);
  const artists = (release['artist-credit'] || []).filter(c => mbidPattern.test(c.artist?.id))
    .map(c => ({ id: 'mb-' + c.artist.id, name: c.name || c.artist.name }));
  if (!item.type || !item.title || !artists.length || release.id !== id) {
    throw failure(422, 'Esta edição não tem informações suficientes para o catálogo.');
  }
  const tracks = [];
  for (const medium of release.media || []) {
    for (const track of medium.tracks || []) {
      const ms = track.length ?? track.recording?.length;
      tracks.push({
        id: 'mb-' + id + '-' + medium.position + '-' + track.position,
        title: track.title || track.recording?.title,
        duration: Number.isFinite(ms) ? Math.round(ms / 1000) : null,
        disc: medium.position, position: track.position
      });
    }
  }
  const source = 'https://musicbrainz.org/release/' + id;
  const hasCover = release['cover-art-archive']?.front === true;
  return {
    id: 'mb-' + id, title: item.title, artist: item.artist, artistId: artists[0].id, artists,
    year: item.year, date: release.date || null, type: item.type, genre: '',
    cover: hasCover ? 'https://coverartarchive.org/release/' + id + '/front-500' : '/assets/covers/sem-capa.svg',
    credit: hasCover ? 'Cover Art Archive' : '', coverSource: source + '/cover-art',
    exportCover: false, source, tracks
  };
}
