import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogProvider} from '../src/catalog-music.mjs';
import {createMusicBrainzRequest} from '../src/catalog-client.mjs';
import {createApp} from '../src/server.mjs';
import {once} from 'node:events';

const artist='11111111-1111-4111-8111-111111111111', group='22222222-2222-4222-8222-222222222222';
const release='33333333-3333-4333-8333-333333333333',recording='44444444-4444-4444-8444-444444444444';
const credit=[{name:'Banda de teste',artist:{id:artist,name:'Banda de teste'}}];
const raw={id:release,title:'Disco de teste',status:'Official',date:'2026-01-01','artist-credit':credit,
  'release-group':{id:group,'primary-type':'Album'},'cover-art-archive':{front:true},
  media:[{position:1,format:'CD','track-count':1,tracks:[{position:1,title:'Canção',recording:{id:recording}}]}]};

test('buscas mantêm termos, filtros, categorias e paginação sem misturar a sintaxe',async()=>{
  const calls=[];
  const p=createCatalogProvider({request:async(resource,params)=>{calls.push({resource,params});return {
    'release-groups':[{id:group,title:'Disco','artist-credit':credit,'primary-type':'Album'}],'release-group-count':25,
    artists:[{id:artist,name:'Banda',type:'Group'}],'artist-count':1,recordings:[{id:recording,title:'Canção','artist-credit':credit,releases:[raw]}],'recording-count':1};}});
  const d=await p.searchMusic('Banda teste',{kind:'group',page:2,year:'2026',type:'Álbum',genre:'Rock'});
  assert.equal(d.results[0].id,'mbg-'+group);assert.equal(calls[0].params.offset,24);
  assert.match(calls[0].params.query,/primarytype:album/);assert.match(calls[0].params.query,/tag:"Rock"/);
  assert.doesNotMatch(calls[0].params.query,/releasegroup:"AND"/);
  assert.equal((await p.searchMusic('Banda',{kind:'artist'})).results[0].artistType,'Group');
  assert.equal((await p.searchMusic('Canção',{kind:'track'})).results[0].releaseId,release);
});
test('discografia avança e edições excluem bootlegs; gravação permanece na edição pedida',async()=>{
  const calls=[];const p=createCatalogProvider({request:async(resource,params)=>{
    calls.push({resource,params});
    if(resource==='artist/'+artist)return {id:artist,name:'Banda'};
    if(resource==='release-group')return {'release-groups':[],'release-group-count':201};
    if(resource==='release')return {releases:[raw,{...raw,id:'55555555-5555-4555-8555-555555555555',status:'Bootleg'}],'release-count':2};
    if(resource==='recording/'+recording)return {id:recording,releases:[raw]};
    if(resource==='release/'+release)return raw;throw Error(resource);
  }});
  const second=await p.loadArtist(artist,2);assert.equal(second.next,3);assert.equal(calls[1].params.offset,100);
  const versions=await p.listVersions(group,1);assert.equal(versions.versions.length,1);assert.equal(versions.versions[0].hasCover,true);
  const result=await p.resolveRecording(recording,release);assert.equal(result.album.releaseId,release);
  assert.equal(result.album.tracks[0].recordingId,recording);
  assert.equal((await p.importGroup(group)).releaseId,release);
});
test('contato, coalescência, espaçamento e pausa do provedor',async()=>{
  let count=0;const starts=[];
  const request=createMusicBrainzRequest({getContact:()=> 'test@capa.test',spacing:30,fetcher:async(url,options)=>{
    count++;starts.push(Date.now());assert.match(options.headers['User-Agent'],/test@capa.test/);
    return new Response(JSON.stringify({artists:[]}),{status:200});
  }});
  await Promise.all([request('artist',{query:'x'}),request('artist',{query:'x'}),request('artist',{query:'y'})]);
  assert.equal(count,2);assert.ok(starts[1]-starts[0]>=25);
  let limited=0;const pause=createMusicBrainzRequest({getContact:()=> 'test@capa.test',fetcher:async()=>{limited++;return new Response('',{status:429,headers:{'Retry-After':'60'}});}});
  await assert.rejects(pause('artist',{query:'x'}),{status:503});
  await assert.rejects(async()=>pause('artist',{query:'y'}),{status:503});assert.equal(limited,1);
});
test('fallback distingue artistas, discos e faixas e aplica filtros; importação conserva IDs sociais',async t=>{
  const seed={id:'antigo',title:'Disco de teste',artist:'Banda de teste',artistId:'banda',year:2026,type:'Álbum',genre:'Rock',
    source:'https://musicbrainz.org/release/'+release,tracks:[{id:'faixa-antiga',title:'Canção'}]};
  const p=createCatalogProvider({request:async(resource)=>resource==='release/'+release?raw:Promise.reject(Error('offline'))});
  const app=await createApp({filename:':memory:',seedAlbums:[seed],catalogProvider:()=>p});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>new Promise(r=>app.server.close(r)));
  const base='http://127.0.0.1:'+app.server.address().port+'/api/catalog/';
  const get=async path=>{const r=await fetch(base+path);assert.equal(r.status,200);return r.json();};
  assert.equal((await get('discover?q=banda&kind=artist')).results[0].kind,'artist');
  assert.equal((await get('discover?q=Canção&kind=track')).results[0].albumId,'antigo');
  assert.equal((await get('discover?q=disco&kind=group&year=1999')).total,0);
  const enriched=await get('releases/'+release+'?enrich=1');
  assert.equal(enriched.album.id,'antigo');assert.equal(enriched.album.tracks[0].id,'faixa-antiga');
  assert.equal(enriched.album.groupId,group);assert.equal(enriched.album.tracks[0].recordingId,recording);
});
