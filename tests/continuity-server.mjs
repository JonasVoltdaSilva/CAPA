// Servidor exclusivo de testes: SQLite em memória e respostas externas controladas.
import {createApp} from '../src/server.mjs';
import {readFile} from 'node:fs/promises';
const seed=JSON.parse(await readFile(new URL('../src/catalog.json',import.meta.url)));
const A='11111111-1111-4111-8111-111111111111',G='22222222-2222-4222-8222-222222222222',R='33333333-3333-4333-8333-333333333333',T='44444444-4444-4444-8444-444444444444',V='55555555-5555-4555-8555-555555555555';
const record={...seed.find(a=>a.id==='ancestral'),id:'mb-'+R,releaseId:R,groupId:G,title:'Edição de teste',artist:'Banda de teste',artistId:'mb-'+A,artists:[{id:'mb-'+A,name:'Banda de teste'}],source:'https://musicbrainz.org/release/'+R,coverHighResolution:null,
  tracks:[{id:'track-test',title:'Canção de teste',recordingId:T}]};
const variant={...record,coverHighResolution:null,id:'mb-'+V,releaseId:V,title:'Edição de teste deluxe',cover:'/assets/covers/polygondwanaland.jpg',source:'https://musicbrainz.org/release/'+V};
const provider={
  searchMusic:async(q,{kind,page=1})=>{
    if(q==='indisponivel')throw Object.assign(Error('Pausa de teste'),{status:503,statusCode:503});
    const item=kind==='artist'?{kind:'artist',id:'mb-'+A,title:'Banda de teste',name:'Banda de teste',artistType:'Group',country:'BR'}:
      kind==='track'?{kind:'track',id:'mbr-'+T,mbid:T,title:'Canção de teste',artist:'Banda de teste',releaseId:R}:
      {kind:'group',id:'mbg-'+G,mbid:G,title:'Edição de teste',artist:'Banda de teste',artistId:'mb-'+A,cover:record.cover,year:2026};
    return {results:[item],total:25,page};
  },
  loadArtist:async(id,page)=>({artist:{name:'Banda de teste',artistType:'Group'},sections:{albums:[{...record,title:page===2?'Segunda página':'Primeira página'}]},total:101,page,next:page===1?2:null}),
  listVersions:async()=>({versions:[{mbid:R,title:record.title,status:'Official',hasCover:true},{mbid:V,title:variant.title,status:'Official',hasCover:true,disambiguation:'deluxe'}],total:2,page:1,next:null}),
  importGroup:async()=>record,importAlbum:async id=>id===V?variant:record,
  resolveRecording:async()=>({album:record,trackId:'track-test'})
};
seed.push({...seed.find(a=>a.id==='capturas'),id:'titulo-longo',title:'Canções para atravessar a noite: memórias, encontros e caminhos de uma viagem que ainda não terminou',coverHighResolution:null});
seed.push(JSON.parse(await readFile(new URL('./fixtures/petal.json',import.meta.url))));
const {server}=await createApp({filename:':memory:',seedAlbums:seed,catalogProvider:()=>provider});
server.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
