import { createHash } from 'node:crypto';
import { HttpError, insist } from './server-validation.mjs';

const idPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const freshFor = 6 * 3600000;
const retainFor = 7 * 86400000;
const hour = 3600000;
const provider = 'musicbrainz';
const searchLimit = 24;

function mbid(value) {
  return typeof value === 'string' && idPattern.test(value) ? value.toLowerCase() : null;
}

function releaseId(album) {
  if (!album) return null;
  return mbid(album.releaseId) || mbid(album.source?.match(/^https:\/\/musicbrainz\.org\/release\/([^/?#]+)\/?$/i)?.[1]) ||
    mbid(album.id?.replace(/^mb-/,''));
}

function comparable(title) {
  return title.normalize('NFC').toLocaleLowerCase('pt-BR').trim();
}
function fold(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

// Keep previous social IDs when enriching the same edition with recording MBIDs.
// A recording ID identifies a recording across releases, not a position in a release.
function enrichTracks(stored, incoming) {
  const tracks = stored.map(t=>({...t}));
  for (const [i,t] of incoming.entries()) {
    const at = tracks.findIndex((prior,k) => {
      const matchesTitle = comparable(prior.title) === comparable(t.title);
      const matchesPlace = (prior.disc || 1) === (t.disc || 1) && (prior.position || k+1) === (t.position || i+1);
      if (prior.recordingId && t.recordingId && prior.recordingId !== t.recordingId) return false;
      return (prior.id === t.id && (matchesTitle || (prior.recordingId && prior.recordingId === t.recordingId))) ||
        (matchesTitle && matchesPlace);
    });
    if (at >= 0) {
      const prior = tracks[at];
      tracks[at] = {...t,...prior,recordingId:prior.recordingId || t.recordingId || null};
    } else if (!tracks.some(prior=>prior.id===t.id)) {
      tracks.push(t);
    } else if (t.recordingId) {
      const alternate = t.id + '-' + t.recordingId;
      if (!tracks.some(x=>x.id===alternate)) tracks.push({...t,id:alternate});
    }
  }
  return tracks;
}

export function musicLibrary({db,all,get,run,atomic}, seed) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS music_external_ids (
      provider TEXT NOT NULL, kind TEXT NOT NULL, externalId TEXT NOT NULL, albumId TEXT NOT NULL,
      PRIMARY KEY(provider,kind,externalId)
    );
    CREATE TABLE IF NOT EXISTS music_artists (
      id TEXT PRIMARY KEY, name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS music_release_artists (
      albumId TEXT NOT NULL, artistId TEXT NOT NULL REFERENCES music_artists(id), position INTEGER NOT NULL,
      PRIMARY KEY(albumId,artistId)
    );
    CREATE INDEX IF NOT EXISTS artist_releases ON music_release_artists(artistId,albumId);
    CREATE TABLE IF NOT EXISTS music_recordings (
      provider TEXT NOT NULL, recordingId TEXT NOT NULL, albumId TEXT NOT NULL, trackId TEXT NOT NULL,
      PRIMARY KEY(provider,recordingId,albumId,trackId)
    );
    CREATE TABLE IF NOT EXISTS music_query_cache (
      key TEXT PRIMARY KEY, response TEXT NOT NULL, storedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS music_query_age ON music_query_cache(storedAt);
  `);
  const initial = new Map(seed.map(a=>[a.id,a]));
  function read(id) {
    if (typeof id !== 'string') return undefined;
    const item = get('SELECT album FROM imports WHERE id=?',id);
    return item ? JSON.parse(item.album) : initial.get(id);
  }
  const index = {get:read, has:id=>typeof id === 'string' && (initial.has(id) || Boolean(get('SELECT 1 FROM imports WHERE id=?',id)))};
  function lookup(kind,externalId) {
    if (!externalId) return null;
    return get('SELECT albumId FROM music_external_ids WHERE provider=? AND kind=? AND externalId=?',provider,kind,externalId)?.albumId || null;
  }
  function link(kind,externalId,albumId) {
    if (externalId) run('INSERT INTO music_external_ids VALUES(?,?,?,?) ON CONFLICT DO NOTHING',provider,kind,externalId,albumId);
  }
  function credits(albumId,artists) {
    for (const [order,a] of (artists || []).entries()) {
      if (typeof a.id!=='string' || typeof a.name!=='string') continue;
      run('INSERT INTO music_artists VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',a.id,a.name);
      run('INSERT INTO music_release_artists VALUES(?,?,?) ON CONFLICT DO NOTHING',albumId,a.id,order);
    }
  }
  function register(album) {
    link('release',releaseId(album),album.id);
    credits(album.id,album.artists?.length ? album.artists : [{id:album.artistId,name:album.artist}]);
    for (const t of album.tracks || []) {
      if (mbid(t.recordingId)) run('INSERT OR IGNORE INTO music_recordings VALUES(?,?,?,?)',provider,t.recordingId.toLowerCase(),album.id,t.id);
    }
  }
  // Register legacy seeds before historical imports so previously shared slugs keep their identity.
  atomic(()=>{
    for (const album of seed) register(album);
    for (const row of all('SELECT album FROM imports ORDER BY rowid')) register(JSON.parse(row.album));
  });

  function persist(incoming,canonicalGroup) {
    const eid = incoming && releaseId(incoming);
    insist(eid && incoming.id === 'mb-'+eid && typeof incoming.title==='string' &&
      Array.isArray(incoming.tracks) && incoming.tracks.every(t=>typeof t.id==='string' && typeof t.title==='string'),
      'Edição sem identificadores confiáveis.',502);
    if (canonicalGroup) insist(!incoming.groupId || incoming.groupId === canonicalGroup,'O grupo retornado pela fonte é diferente.',502);
    return atomic(()=>{
      const stable = lookup('release',eid) || incoming.id;
      const previous = read(stable);
      const groupId = mbid(incoming.groupId) || canonicalGroup || previous?.groupId || null;
      const tracks = previous ? enrichTracks(previous.tracks,incoming.tracks) : incoming.tracks;
      const curated = initial.get(stable);
      const album = {...previous,...incoming,...curated,id:stable,groupId,releaseId:eid,tracks,
        versions:incoming.versions?.length ? incoming.versions : previous?.versions || []};
      run('INSERT INTO imports VALUES(?,?) ON CONFLICT(id) DO UPDATE SET album=excluded.album',stable,JSON.stringify(album));
      register(album);
      credits(stable,incoming.artists);
      if(canonicalGroup) link('group',canonicalGroup,stable);
      return album;
    });
  }

  function forBootstrap({entries,lists,people,battles}) {
    const ids = new Set(initial.keys());
    for (const row of all('SELECT id FROM imports ORDER BY rowid DESC LIMIT 40')) ids.add(row.id);
    for (const e of entries) ids.add(e.albumId);
    for (const list of lists) for (const item of list.items) ids.add(item.albumId);
    for (const person of people) for (const id of person.favoriteAlbums) ids.add(id);
    for (const battle of battles) {ids.add(battle.albumA);ids.add(battle.albumB);}
    return [...ids].map(read).filter(Boolean);
  }
  function findTrack(id,preferredRelease) {
    const albumId = preferredRelease && lookup('release',preferredRelease);
    if (preferredRelease && !albumId) return null;
    const found = albumId ? get('SELECT albumId,trackId FROM music_recordings WHERE provider=? AND recordingId=? AND albumId=? ORDER BY rowid LIMIT 1',provider,id,albumId)
      : get('SELECT albumId,trackId FROM music_recordings WHERE provider=? AND recordingId=? ORDER BY rowid LIMIT 1',provider,id);
    return found ? {album:read(found.albumId),trackId:found.trackId} : null;
  }
  const pending = new Map();
  function oneAtATime(key,work) {
    if (pending.has(key)) return pending.get(key);
    insist(pending.size<48,'O catálogo está ocupado. Tente novamente em instantes.',503);
    const job = Promise.resolve().then(work).finally(()=>pending.delete(key));
    pending.set(key,job);
    return job;
  }
  async function cached(parts,load) {
    const key=createHash('sha256').update(JSON.stringify(parts)).digest('hex');
    const old=get('SELECT response,storedAt FROM music_query_cache WHERE key=?',key);
    const age=old ? Date.now()-old.storedAt : Infinity;
    if (age <= freshFor) return JSON.parse(old.response);
    return oneAtATime('query:'+key,async()=>{
      let result;
      try {result=await load();}
      catch(error) {
        if (age<=retainFor && [429,502,503,504].includes(error.status)) {
          return {...JSON.parse(old.response),stale:true,cachedAt:new Date(old.storedAt).toISOString()};
        }
        throw error;
      }
      const response=JSON.stringify(result);
      if (Buffer.byteLength(response)<=1024*1024) atomic(()=>{
        run('INSERT INTO music_query_cache VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET response=excluded.response,storedAt=excluded.storedAt',
          key,response,Date.now());
        run('DELETE FROM music_query_cache WHERE storedAt<?',Date.now()-retainFor);
        run('DELETE FROM music_query_cache WHERE key IN (SELECT key FROM music_query_cache ORDER BY storedAt DESC,rowid DESC LIMIT -1 OFFSET 256)');
      });
      return result;
    });
  }
  // Fallback local: quando a fonte externa está indisponível, a busca continua
  // sobre o acervo já importado e as sementes locais, sem inventar resultados.
  function localSearch(q, {page=1, year='', type='',kind='all',genre='',order='relevance'} = {}) {
    page=positivePage(String(page));
    const words=fold(q).split(/\s+/).filter(Boolean),unique=new Map(initial);
    for(const row of all('SELECT album FROM imports ORDER BY rowid')){try{const a=JSON.parse(row.album);unique.set(a.id,a);}catch{}}
    const matches=a=>(!year||String(a.year)===year)&&(!genre||fold(a.genre).includes(fold(genre)))&&
      (!type||a.type===type||(type==='Ao vivo'&&a.secondaryTypes?.includes('Live')));
    const albums=[...unique.values()].filter(matches),items=[];
    if(kind==='group'||kind==='all')items.push(...albums.map(a=>({...a,kind:'group'})));
    if(kind==='artist'||kind==='all'){
      const artists=new Map();
      for(const a of albums)for(const person of a.artists?.length?a.artists:[{id:a.artistId,name:a.artist}])
        if(person.id)artists.set(person.id,{id:person.id,kind:'artist',name:person.name,title:person.name,artist:person.name,artistId:person.id,artistType:''});
      items.push(...artists.values());
    }
    if(kind==='track'||kind==='all')for(const a of albums)for(const t of a.tracks)
      items.push({...t,kind:'track',albumId:a.id,artist:a.artist,albumTitle:a.title,year:a.year});
    const list=items.filter(a=>words.every(w=>fold([a.title,a.artist,a.genre,a.albumTitle].filter(Boolean).join(' ')).includes(w)));
    if(order==='az')list.sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
    else if(order==='recentes')list.sort((a,b)=>(b.year||0)-(a.year||0));
    const start=(page-1)*searchLimit;
    return {page,total:list.length,next:start+searchLimit<list.length?page+1:null,local:true,results:list.slice(start,start+searchLimit)};
  }

  return {index,lookup,persist,forBootstrap,findTrack,oneAtATime,cached,localSearch,all,get};
}

function positivePage(raw) {
  insist(raw===null || (/^[1-9]\d{0,3}$/.test(raw)), 'Página inválida.');
  return raw===null ? 1 : Number(raw);
}
function requiredId(value) {
  const id=mbid(value);
  insist(id,'Identificador MusicBrainz inválido.');
  return id;
}
async function ask(factory,method,...args) {
  try {return await (await factory())[method](...args);}
  catch (error) {
    const valid = [400,404,422,429,502,503,504].includes(error?.status) && error.statusCode===error.status;
    throw new HttpError(valid ? error.status : 503,valid ? error.message : 'A fonte musical está indisponível. Tente novamente em instantes.');
  }
}

export async function catalogRoute({store,url,method,ip,me,throttle,catalogProvider}) {
  const path=url.pathname.slice('/api/catalog/'.length);
  const [route,rawId,extra]=path.split('/');
  const lib=store.music;
  function remoteRead(){throttle('music-read:'+ip,45,60000);}
  function remoteDetail(){throttle('music-open:'+ip,24,60000);throttle('music-open-hour:'+ip,240,hour);}
  if (method==='GET' && path==='discover') {
    const q=(url.searchParams.get('q') || '').normalize('NFC').trim().replace(/\s+/g,' ');
    const kind=url.searchParams.get('kind') || 'all', year=url.searchParams.get('year') || '', type=url.searchParams.get('type') || '',genre=url.searchParams.get('genre') || '',order=url.searchParams.get('order') || 'relevance';
    const page=positivePage(url.searchParams.get('page'));
    insist(q.length<=120 && (!q||q.length>=2),'Pesquise pelo menos dois caracteres.');
    insist(genre.length<=60,'Gênero muito longo.');
    insist(!year || /^\d{4}$/.test(year),'Ano inválido.');
    insist(type.length<=40 && ['all','artist','group','track'].includes(kind),'Filtro de busca inválido.');
    if(!q&&!year&&!type&&!genre)return lib.localSearch(q,{page,year,type,kind,genre,order});
    try {
      return await lib.cached(['discover-v2',q.toLocaleLowerCase('pt-BR'),kind,page,year,type,genre],async()=>{
        remoteRead();
        return ask(catalogProvider,'searchMusic',q,{kind,page,year,type,genre});
      });
    } catch {
      return {...lib.localSearch(q,{page,year,type,kind,genre,order}),unavailable:true};
    }
  }
  if (method==='GET' && route==='artists' && rawId && extra===undefined) {
    const id=requiredId(rawId),page=positivePage(url.searchParams.get('page'));
    return lib.cached(['artist',id,page],async()=>{remoteRead();return ask(catalogProvider,'loadArtist',id,page);});
  }
  if (method==='GET' && route==='groups' && extra==='versions' && path.split('/').length===3) {
    const id=requiredId(rawId),page=positivePage(url.searchParams.get('page'));
    return lib.cached(['versions',id,page],async()=>{remoteRead();return ask(catalogProvider,'listVersions',id,page);});
  }
  const isLegacy=method==='POST' && route==='import';
  if ((!isLegacy && method!=='GET') || !rawId || extra!==undefined ||
     !['import','groups','recordings','releases'].includes(route) || (route==='import'&&!isLegacy)) {
    throw new HttpError(404,'Rota de catálogo indisponível.');
  }
  if(isLegacy) insist(me,'Entre na sua conta para continuar.',401);
  const id=requiredId(rawId);
  if (route==='recordings') {
    const preferred=url.searchParams.has('releaseId') ? requiredId(url.searchParams.get('releaseId')) : null;
    const known=lib.findTrack(id,preferred);
    if(known)return known;
    return lib.oneAtATime(['recording',id,preferred].join(':'),async()=>{
      remoteDetail();
      const result=await ask(catalogProvider,'resolveRecording',id,preferred);
      const incomingTrack=result?.album?.tracks?.find(t=>t.id===result.trackId);
      insist(incomingTrack && incomingTrack.recordingId===id,'A fonte não confirmou a gravação nesta edição.',502);
      if(preferred) insist(releaseId(result.album)===preferred,'A fonte retornou outra edição.',502);
      const album=lib.persist(result.album);
      const track=album.tracks.find(t=>t.recordingId===id && t.id===result.trackId) || album.tracks.find(t=>t.recordingId===id);
      insist(track,'Faixa indisponível.',404);
      return {album,trackId:track.id};
    });
  }
  const group=route==='groups';
  const existing=lib.lookup(group?'group':'release',id);
  if(existing&&!(route==='releases'&&url.searchParams.get('enrich')==='1'&&!lib.index.get(existing).groupId))return {album:lib.index.get(existing)};
  return lib.oneAtATime((group?'group:':'release:')+id,async()=>{
    if(isLegacy) throttle('import:'+me.id,12,60000);
    remoteDetail();
    const incoming=await ask(catalogProvider,group?'importGroup':'importAlbum',id);
    if(!group)insist(releaseId(incoming)===id,'A fonte retornou outra edição.',502);
    return {album:lib.persist(incoming,group?id:null)};
  });
}

