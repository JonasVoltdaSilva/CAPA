// Catálogo dinâmico: consulta ao MusicBrainz com normalização estável.
// Nenhum dado é inventado: o que a fonte não traz permanece ausente.
import { createMusicBrainzRequest } from './catalog-client.mjs';
import {
  artistItem, category, credit, entityId, groupItem, mappedAlbum, pageNumber,
  recordingItem, releaseType, sourceUrl, versionItem, compareVersions, uuid
} from './catalog-normalize.mjs';

const searchLimit = 24;
const discographyLimit = 100;
const versionsLimit = 25;

function terms(q) {
  return String(q || '').normalize('NFC').split(/\s+/).map(t => t.replace(/["\\]/g, '').trim()).filter(Boolean).slice(0, 10);
}

function fieldQuery(field, list) {
  if (!list.length) return '';
  return list.map(t => field + ':"' + t + '"').join(' AND ');
}

function yearFilter(year) {
  if (!year || !/^\d{4}$/.test(String(year))) return '';
  const y = String(year);
  return `firstreleasedate:[${y}-01-01 TO ${y}-12-31]`;
}

function typeFilter(type) {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'álbum' || t === 'album') return 'primarytype:album';
  if (t === 'ep') return 'primarytype:ep';
  if (t === 'single') return 'primarytype:single';
  if (t === 'compilação') return 'secondarytype:compilation';
  if (t === 'ao vivo') return 'secondarytype:live';
  if (t === 'outro') return 'primarytype:other';
  return '';
}

const safe = value => String(value).replace(/["\\]/g,'');
function joinAnd(parts) { return parts.filter(Boolean).join(' AND '); }
function yearOf(date) { return /^\d{4}/.test(date || '') ? Number(date.slice(0, 4)) : null; }

function catalogError(status, message) {
  const e = new Error(message);
  e.status = status;
  e.statusCode = status;
  return e;
}

export function createCatalogProvider(options = {}) {
  const request = options.request ?? createMusicBrainzRequest(options);
  const store = options.store;

  async function searchReleaseGroups(q, { page, year, type, genre }) {
    const ts = terms(q);
    const perWord = ts.map(t => `(releasegroup:"${safe(t)}" OR release:"${safe(t)}" OR artist:"${safe(t)}")`);
    const core = joinAnd([
      ...perWord,
      typeFilter(type),
      yearFilter(year),
      genre ? 'tag:"'+safe(genre)+'"' : ''
    ]);
    const data = await request('release-group', {
      limit: searchLimit, offset: (page - 1) * searchLimit, query: core, inc: 'artist-credits'
    });
    const count = Number(data['release-group-count']) || data['release-groups']?.length || 0;
    return {
      page, total: count, results: (data['release-groups'] || []).map(g => groupItem(g))
    };
  }

  async function searchArtists(q, { page, genre }) {
    const ts = terms(q);
    const perWord = ts.map(t => `(artist:"${safe(t)}" OR alias:"${safe(t)}")`);
    const core = joinAnd([...perWord, genre ? 'tag:"'+safe(genre)+'"' : '']);
    const data = await request('artist', {
      limit: searchLimit, offset: (page - 1) * searchLimit, query: core, inc: 'aliases'
    });
    const count = Number(data['artist-count']) || data.artists?.length || 0;
    return {
      page, total: count, results: (data.artists || []).map(a => artistItem(a))
    };
  }

  async function searchRecordings(q, { page, genre, year }) {
    const ts = terms(q);
    const perWord = ts.map(t => `(recording:"${safe(t)}" OR artist:"${safe(t)}")`);
    const core = joinAnd([...perWord,genre?'tag:"'+safe(genre)+'"':'',year?'firstreleasedate:['+year+'-01-01 TO '+year+'-12-31]':'']);
    const data = await request('recording', {
      limit: searchLimit, offset: (page - 1) * searchLimit, query: core, inc: 'releases+artist-credits'
    });
    const count = Number(data['recording-count']) || data.recordings?.length || 0;
    return {
      page, total: count, results: (data.recordings || []).map(rec => recordingItem(rec))
    };
  }

  async function searchMusic(q, { kind = 'all', page = 1, year = '', type = '', genre = '' } = {}) {
    page = pageNumber(page);
    genre=({'música clássica':'classical','eletrônica':'electronic','música latina':'latin','rap':'hip hop','hip-hop':'hip hop','r&b':'contemporary r&b'}[genre.toLocaleLowerCase('pt-BR')]||genre);
    const groups = kind !== 'artist' && kind !== 'track' ? searchReleaseGroups(q, { page, year, type, genre }) : { page, total: 0, results: [] };
    const artists = kind !== 'group' && kind !== 'track' ? searchArtists(q, { page, genre }) : { page, total: 0, results: [] };
    const tracks = kind === 'track' || kind === 'all' ? searchRecordings(q, { page, genre, year }) : { page, total: 0, results: [] };
    const [g, a, t] = await Promise.all([groups, artists, tracks]);
    return {
      page, total: g.total + a.total + t.total,
      results: g.results.map(x => ({ ...x, kind: 'group' })).concat(
        a.results.map(x => ({ ...x, kind: 'artist' })),
        t.results.map(x => ({ ...x, kind: 'track' }))
      )
    };
  }

  async function loadArtist(id, page) {
    page = pageNumber(page);
    const focal = entityId(id, 'mb-');
    let artist = null;
    const fullId = 'mb-' + focal;
    try {
      const artistRes = await request('artist/' + focal);
      artist = artistItem(artistRes);
    } catch {
      const row = store && store.all ? store.all('SELECT * FROM music_artists WHERE id=?', fullId)[0] : null;
      if (!row) throw catalogError(404, 'Artista não encontrado.');
      artist = {
        kind: 'artist', id: fullId, mbid: focal, title: row.name, name: row.name, artist: row.name,
        artistId: fullId, artistMbid: focal,
        artists: [{ id: fullId, mbid: focal, name: row.name }],
        type: 'Artista', artistType: '', country: '', area: '', disambiguation: '', date: '', year: null, cover: '',
        source: sourceUrl('artist', focal)
      };
    }
    let total = 0;
    const sections = { albums: [], eps: [], singles: [], compilations: [], appearances: [], other: [] };
    try {
      const data = await request('release-group', {
        artist: focal, limit: discographyLimit, offset: (page-1)*discographyLimit, inc: 'artist-credits'
      });
      const raw = data['release-groups'] || [];
      total = Number(data['release-group-count']) || raw.length;
      for (const g of raw) {
        const gi = groupItem(g, focal);
        const sec = gi.section || 'other';
        if (sections[sec]) sections[sec].push(gi);
        else sections.other.push(gi);
      }
    } catch {
      if (store && store.all && store.index) {
        const rows = store.all('SELECT albumId FROM music_release_artists WHERE artistId=?', fullId);
        for (const r of rows) {
          const a = store.index.get(r.albumId);
          if (!a) continue;
          total++;
          sections.albums.push({
            kind: 'group', id:a.id, groupId:a.groupId||null,
            title: a.title, artist: a.artist, artistId: a.artistId, artists: a.artists || [],
            type: a.type || 'Álbum', section: 'albums', secondaryTypes: a.secondaryTypes || [],
            year: a.year || null, date: a.date || '', country: '', disambiguation: '', cover: a.cover || '', source: a.source || ''
          });
        }
      }
    }
    for (const sec of Object.values(sections)) {
      sec.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a.title.localeCompare(b.title));
    }
    return { artist, sections, page, total, next: page * discographyLimit < total ? page + 1 : null };
  }

  async function listVersions(id, page) {
    page = pageNumber(page);
    const data = await request('release', {
      'release-group': id, limit: versionsLimit, offset: (page - 1) * versionsLimit,
      inc: 'recordings+artist-credits+release-groups+tags+genres'
    });
    const total = Number(data['release-count']) || 0;
    const versions = (data.releases || [])
      .filter(r=>r.status==='Official').map(r => versionItem(r))
      .sort(compareVersions);
    return { versions, page, total, next: page * versionsLimit < total ? page + 1 : null };
  }

  async function releaseRaw(id) {
    const clean = entityId(id);
    return await request('release/' + clean, { inc: 'recordings+artist-credits+release-groups+tags+genres' });
  }

  async function importAlbum(id) {
    const clean = entityId(id);
    const release = await releaseRaw(clean);
    const album = mappedAlbum(release, clean);
    album.genre = (release.tags || []).map(t => t.name).filter(Boolean).slice(0, 3).join(', ');
    return album;
  }

  async function importGroup(id) {
    const clean = entityId(id);
    const first = await listVersions(clean, 1);
    if (!first.versions.length) throw catalogError(404, 'O grupo não tem edições disponíveis.');
    return importAlbum(first.versions[0].mbid);
  }

  async function resolveRecording(id, preferred) {
    const clean = entityId(id);
    const rec = await request('recording/' + clean, { inc: 'releases+artist-credits' });
    const releases = (rec.releases || []).filter(v => uuid.test(v.id) && (!v.status || v.status === 'Official'));
    const ordered = releases.map(versionItem).sort(compareVersions);
    const candidates = preferred ? [entityId(preferred)] : ordered.slice(0,5).map(v => v.mbid);
    for (const mbid of candidates) {
      try {
        const album = await importAlbum(mbid);
        const track = album.tracks.find(t => t.recordingId === clean || t.trackMbid === clean);
        if (track) return { album, trackId: track.id };
      } catch {
        continue;
      }
    }
    throw catalogError(404, 'A gravação não foi encontrada em nenhuma edição oficial.');
  }

  async function searchCatalog(q) {
    const ts = terms(q);
    const core = joinAnd([...ts.map(t=>'(release:"'+safe(t)+'" OR artist:"'+safe(t)+'")'), 'status:official']);
    const data = await request('release', { limit: 35, query: core, inc: 'artist-credits' });
    const seen = new Set();
    const results = [];
    for (const release of data.releases || []) {
      const key = release['release-group']?.id || release.id;
      if (!release.title || !release.id || seen.has(key)) continue;
      seen.add(key);
      const cr = credit(release);
      const type = releaseType(release['release-group'] || {});
      results.push({ mbid: release.id, title: release.title, artist: cr.artist, year: yearOf(release.date), type });
    }
    return results;
  }

  return { searchMusic, loadArtist, listVersions, importAlbum, importGroup, resolveRecording, searchCatalog };
}
