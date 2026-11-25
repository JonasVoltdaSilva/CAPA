import {catalogError} from './catalog-client.mjs';

export const sourceName = 'MusicBrainz';
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const sourceUrl = (kind,id) => 'https://musicbrainz.org/' + kind + '/' + id;
const noCover = '/assets/covers/sem-capa.svg';

export function entityId(value, prefix = '') {
  const id = typeof value === 'string' ? value.replace(prefix ? new RegExp('^'+prefix) : /^(?!)$/, '').toLowerCase() : '';
  if (!uuid.test(id)) throw catalogError(400,'Identificador musical inválido.');
  return id;
}

export function pageNumber(value = 1) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 10000) throw catalogError(400,'Página de resultados inválida.');
  return n;
}

export function credit(data) {
  const raw = data['artist-credit'] || [];
  const artists = raw.filter(v=>uuid.test(v.artist?.id)).map(v=>({
    id:'mb-'+v.artist.id, mbid:v.artist.id, name:v.name || v.artist.name
  }));
  return {
    artists, artistId:artists[0]?.id || '', artistMbid:artists[0]?.mbid || '',
    artist:raw.map(c=>(c.name || c.artist?.name || '')+(c.joinphrase || '')).join('')
  };
}

export function category(group, focalArtist) {
  const secondary = group['secondary-types'] || [];
  const credits = group['artist-credit'] || [];
  const index = focalArtist ? credits.findIndex(c=>c.artist?.id===focalArtist) : -1;
  const guest = index>0 && /feat|ft\.|with|participa/i.test(credits[index-1]?.joinphrase || '');
  if (guest) return 'appearances';
  if (secondary.includes('Compilation')) return 'compilations';
  return {Album:'albums',EP:'eps',Single:'singles'}[group['primary-type']] || 'other';
}

export const releaseType = g => (g['secondary-types'] || []).includes('Compilation')
  ? 'Compilação' : ({Album:'Álbum',EP:'EP',Single:'Single'})[g['primary-type']] || 'Outro';

const yearOf = date => /^\d{4}/.test(date || '') ? Number(date.slice(0,4)) : null;

export function artistItem(a) {
  return {kind:'artist', id:'mb-'+a.id, mbid:a.id, title:a.name, name:a.name, artist:a.name,
    artistId:'mb-'+a.id,artistMbid:a.id,artists:[{id:'mb-'+a.id,mbid:a.id,name:a.name}],
    type:'Artista',artistType:a.type||'',country:a.country||'',area:a.area?.name||a['begin-area']?.name||'',
    disambiguation:a.disambiguation||'',date:'',year:null,cover:'',source:sourceUrl('artist',a.id)};
}

export function groupItem(g, focalArtist) {
  const date = g['first-release-date'] || '';
  return {kind:'group', id:'mbg-'+g.id, mbid:g.id, groupId:g.id,title:g.title, ...credit(g),
    type:releaseType(g), section:category(g,focalArtist),secondaryTypes:g['secondary-types']||[],
    year:yearOf(date),date,country:'',disambiguation:g.disambiguation||'',
    cover:'https://coverartarchive.org/release-group/'+g.id+'/front-250',source:sourceUrl('release-group',g.id)};
}

export function versionItem(release) {
  const media = release.media || [];
  const areas = Array.from(new Set([release.country, ...(release['release-events'] || [])
    .flatMap(e=>e.area?.['iso-3166-1-codes']||[])].filter(Boolean)));
  const counts = media.map(m=>m['track-count']).filter(n=>Number.isInteger(n));
  return {mbid:release.id,title:release.title || '',date:release.date || '',status:release.status||'',hasCover:release['cover-art-archive']?.front===true,
    country:release.country || areas[0] || '', countries:areas, disambiguation:release.disambiguation || '',
    format:[...new Set(media.map(m=>m.format).filter(Boolean))].join(' + '),
    trackCount:typeof release['track-count']==='number' ? release['track-count'] : counts.length===media.length&&counts.length>0?counts.reduce((n,c)=>n+c,0):null};
}

export function compareVersions(a,b) {
  // Choose a standard edition before expanded variants. Dates of differing precision
  // compare at year level first; the known country and MBID break remaining ties.
  const expanded = v => /\b(deluxe|remaster(?:ed)?|anniversary|expanded|bonus|explicitly edited|clean version)\b/i.test(v.title+' '+v.disambiguation) ? 1 : 0;
  const regionRank = v => v.country==='BR'?0:v.country==='XW'?1:2;
  return expanded(a)-expanded(b) || (a.date||'9999').localeCompare(b.date||'9999') ||
    regionRank(a)-regionRank(b) || a.mbid.localeCompare(b.mbid);
}

export function recordingItem(rec) {
  const releases=(rec.releases||[]).filter(v=>uuid.test(v.id)&&(!v.status||v.status==='Official'));
  const options=releases.map(versionItem).sort(compareVersions);
  const release=releases.find(v=>v.id===options[0]?.mbid);
  const group=release?.['release-group'];
  const date=rec['first-release-date']||release?.date||'';
  return {kind:'track', id:'mbr-'+rec.id, mbid:rec.id, title:rec.title, ...credit(rec),type:'Faixa',
    disambiguation:rec.disambiguation||'',date,year:yearOf(date),country:release?.country||'',
    albumTitle:release?.title || '',releaseId:release?.id || null,groupId:group?.id || null,
    duration:Number.isFinite(rec.length)?Math.round(rec.length/1000):null,
    cover:group?.id?'https://coverartarchive.org/release-group/'+group.id+'/front-250':'',
    source:sourceUrl('recording',rec.id)};
}

export function mappedAlbum(release, expectedId) {
  const group=release['release-group']||{}, id=release.id, metadata=credit(release);
  if (id!==expectedId || !release.title || !metadata.artists.length) throw catalogError(422,'A edição está incompleta no MusicBrainz.');
  const tracks=[];
  for (const medium of release.media || []) {
    for (const track of medium.tracks || []) {
      const ms=track.length??track.recording?.length;
      tracks.push({id:'mb-'+id+'-'+medium.position+'-'+track.position,title:track.title||track.recording?.title,
        duration:Number.isFinite(ms)?Math.round(ms/1000):null,disc:medium.position,position:track.position,
        recordingId:uuid.test(track.recording?.id)?track.recording.id:null,trackMbid:uuid.test(track.id)?track.id:null});
    }
  }
  const source=sourceUrl('release',id),hasCover=release['cover-art-archive']?.front===true;
  return {id:'mb-'+id,releaseId:id,groupId:uuid.test(group.id)?group.id:null,title:release.title,...metadata,
    year:yearOf(release.date), date:release.date||null, type:releaseType(group),secondaryTypes:group['secondary-types']||[],
    genre:'', country:release.country||'',edition:release.disambiguation||'',editionFormat:versionItem(release).format,
    cover:hasCover?'https://coverartarchive.org/release/'+id+'/front-1200':noCover,
    credit:hasCover?'Cover Art Archive':'',coverSource:source+'/cover-art',exportCover:false,source,tracks};
}
