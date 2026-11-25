import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { crc32, deflateSync } from 'node:zlib';
import { createApp } from '../src/server.mjs';
import { moderate } from '../src/server-moderation.mjs';
import { backupDatabase } from '../src/server-backup.mjs';
import { avatarValue } from '../src/server-validation.mjs';

const seedAlbums = [
  {id:'disco-a',title:'Disco de teste',artist:'Artista A',tracks:[{id:'faixa-a',title:'Faixa de teste'}]},
  {id:'disco-b',title:'Segundo disco de teste',artist:'Artista B',tracks:[]}
];
const senha = 'senha de exemplo privada';
async function start(t,options = {}) {
  const {server,store} = await createApp({filename:':memory:',seedAlbums,...options});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const url = 'http://127.0.0.1:' + server.address().port;
  async function close() {
    if (server.listening) await new Promise((yes,no)=>server.close(e=>e ? no(e) : yes()));
  }
  t.after(close);
  function client() {
    let cookie = '';
    async function req(method,path,body,headers={}) {
      const res = await fetch(url + '/api' + path,{method,
        headers:{'content-type':'application/json',...(cookie ? {cookie} : {}), ...headers},
        body:body === undefined ? undefined : JSON.stringify(body)});
      const issued = res.headers.get('set-cookie');
      if (issued) cookie = issued.split(';')[0];
      return {status:res.status, data:await res.json(), headers:res.headers};
    }
    async function ok(method,path,body) {
      const res = await req(method,path,body);
      assert.equal(res.status,200,JSON.stringify(res.data));
      return res.data;
    }
    const register = name => ok('POST','/auth/register',{username:name,email:name+'@example.test',name,password:senha});
    return {req,ok,register,read:()=>ok('GET','/bootstrap'),cookie:()=>cookie};
  }
  return {client,store,url,close};
}

test('conta, sessão e propriedade das escutas com isolamento público e privado', async t => {
  const app = await start(t);
  const ana = app.client(), bia = app.client(), visita = app.client();
  const {user} = await ana.register('ana');
  await bia.register('bia');
  const publicEntry = (await ana.ok('POST','/entries',{albumId:'disco-a',date:'2026-01-01',rating:3.5,review:'Primeira escuta'})).entry;
  const privateEntry = (await ana.ok('POST','/entries',{albumId:'disco-a',date:'2026-02-01',rating:4.5,review:'Só eu',visibility:'private'})).entry;
  const trackEntry = (await ana.ok('POST','/entries',{albumId:'disco-a',trackId:'faixa-a',rating:5})).entry;
  assert.notEqual(publicEntry.id,privateEntry.id);
  assert.equal(trackEntry.trackId,'faixa-a');
  assert.equal((await ana.read()).entries.length,3);
  const shared = await bia.read();
  assert.equal(shared.entries.length,2);
  assert.equal(shared.people.find(u=>u.id===user.id).email,undefined);
  assert.ok(shared.people.every(u=>!('passwordHash' in u)));
  assert.ok((await visita.read()).entries.every(e=>e.visibility==='public'));
  assert.equal((await bia.req('PATCH','/entries/'+publicEntry.id,{rating:1})).status,403);
  assert.equal((await bia.req('POST','/entries/'+privateEntry.id+'/like',{})).status,404);
  assert.equal((await ana.req('PATCH','/entries/'+publicEntry.id,{rating:3.2})).status,400);
  assert.equal((await ana.req('PATCH','/entries/'+publicEntry.id,{date:'2026-02-30'})).status,400);
  assert.equal((await ana.req('POST','/entries',{albumId:'disco-b',trackId:'faixa-a'})).status,400);
  const updated = await ana.ok('PATCH','/entries/'+privateEntry.id,{rating:5,favorite:true});
  assert.equal(updated.entry.favorite,true);
  assert.equal((await visita.read()).entries.length,2);
  const updatedUser = await ana.ok('PATCH','/account',{bio:'Discoteca pessoal',favoriteAlbums:['disco-a'],favoriteArtists:['Artista A']});
  assert.equal(updatedUser.user.favoriteAlbums[0],'disco-a');
  await ana.ok('DELETE','/entries/'+publicEntry.id,{});
  assert.equal((await visita.read()).entries.length,1);
  await ana.ok('POST','/auth/logout',{});
  assert.equal((await ana.read()).user,null);
  assert.equal((await ana.req('POST','/auth/login',{email:'ana@example.test',password:'incorreta'})).status,401);
  const login = await ana.req('POST','/auth/login',{email:'ana@example.test',password:senha});
  assert.equal(login.status,200);
  assert.match(login.headers.get('set-cookie'),/HttpOnly/);
  assert.match(login.headers.get('set-cookie'),/SameSite=Lax/);
  assert.equal((await ana.req('DELETE','/account',{password:'incorreta'})).status,403);
  await ana.ok('DELETE','/account',{password:senha});
  assert.equal((await visita.read()).entries.length,0);
  assert.ok(!(await bia.read()).people.some(u=>u.id===user.id));
});

test('listas, links, privacidade, curtidas, bloqueio, moderação e batalha', async t => {
  const dir = await mkdtemp(join(tmpdir(),'capa-test-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const publicDir = join(dir,'public');
  await mkdir(publicDir);
  await writeFile(join(publicDir,'index.html'),'<html><head><title>CAPA</title></head><body></body></html>');
  await writeFile(join(publicDir,'offline.html'),'offline');
  const app = await start(t,{publicDir});
  const a=app.client(), b=app.client(), guest=app.client();
  const ua=(await a.register('rita')).user, ub=(await b.register('luna')).user;
  const e=(await a.ok('POST','/entries',{albumId:'disco-a',trackId:'faixa-a',review:'Graves & agudos',rating:4})).entry;
  const list=(await a.ok('POST','/lists',{title:'Duas escolhas',description:'Uma faixa e um disco',
    items:[{albumId:'disco-a',trackId:'faixa-a'},{albumId:'disco-b'}]})).list;
  const privateList=(await a.ok('POST','/lists',{title:'Só em casa',visibility:'private'})).list;
  assert.equal((await b.read()).lists.length,1);
  assert.equal((await b.req('DELETE','/lists/'+list.id,{})).status,404);
  const liked=await b.ok('POST','/entries/'+e.id+'/like',{active:true});
  assert.equal(liked.active,true);
  await b.ok('POST','/entries/'+e.id+'/like',{active:true});
  const c=(await b.ok('POST','/entries/'+e.id+'/comments',{text:'Também gostei.'})).comment;
  assert.deepEqual((await a.read()).entries[0].likes,[ub.id]);
  await b.ok('POST','/people/'+ua.id+'/follow',{active:true});
  assert.deepEqual((await b.read()).following,[ua.id]);
  assert.deepEqual((await a.read()).followers,[ub.id]);
  const preview=await fetch(app.url+'/avaliacao/'+e.id);
  assert.match(await preview.text(),/Graves &amp; agudos/);
  assert.equal((await fetch(app.url+'/lista/'+privateList.id)).status,404);
  assert.match(await (await fetch(app.url+'/lista/'+list.id)).text(),/og:title.+Duas escolhas/);
  assert.match(await (await fetch(app.url+'/perfil/rita')).text(),/og:title.+rita/);
  const hiddenOwner=await fetch(app.url+'/lista/'+privateList.id,{headers:{cookie:a.cookie()}});
  assert.equal(hiddenOwner.status,200);
  assert.doesNotMatch(await hiddenOwner.text(),/Só em casa/);
  assert.equal(await (await fetch(app.url+'/offline.html')).text(),'offline');
  await b.ok('POST','/people/'+ua.id+'/block',{active:true});
  assert.deepEqual((await b.read()).entries,[]);
  assert.deepEqual((await a.read()).followers,[]);
  assert.equal((await a.read()).entries[0].comments.length,0);
  assert.equal((await fetch(app.url+'/perfil/rita',{headers:{cookie:b.cookie()}})).status,404);
  assert.equal((await b.req('POST','/entries/'+e.id+'/comments',{text:'x'})).status,404);
  await b.ok('POST','/people/'+ua.id+'/block',{active:false});
  await a.ok('POST','/reports',{targetType:'comment',targetId:c.id,reason:'Revisar por favor'});
  const report=moderate(app.store,'listar')[0];
  assert.equal(report.conteudo,'Também gostei.');
  moderate(app.store,'remover',report.id);
  assert.deepEqual((await guest.read()).entries[0].comments,[]);
  const battle=await a.ok('POST','/battles',{albumA:'disco-a',albumB:'disco-b',winner:'disco-a'});
  const again=await a.ok('POST','/battles',{albumA:'disco-b',albumB:'disco-a',winner:'disco-b'});
  assert.equal(battle.battle.id,again.battle.id);
  assert.equal((await a.read()).battles.length,1);
  assert.equal((await guest.read()).battles.length,0);
  await a.ok('PATCH','/lists/'+list.id,{visibility:'private',title:'Editada'});
  assert.deepEqual((await guest.read()).lists,[]);
  await a.ok('DELETE','/lists/'+list.id,{});
  await b.ok('POST','/reports',{targetType:'user',targetId:ua.id,reason:'Verificar perfil'});
  moderate(app.store,'suspender',moderate(app.store,'listar')[0].id);
  assert.equal((await a.read()).user,null);
  assert.deepEqual((await guest.read()).entries,[]);
  assert.equal((await fetch(app.url+'/avaliacao/'+e.id)).status,404);
  moderate(app.store,'reativar',ua.id);
  assert.equal((await guest.read()).entries.length,1);
});

test('persistência, importação idempotente, origem, autenticação e limite de requisições', async t=>{
  const dir=await mkdtemp(join(tmpdir(),'capa-db-'));
  let active;
  t.after(async()=>{
    await active?.close();
    await rm(dir,{recursive:true,force:true});
  });
  const filename=join(dir,'db.sqlite');
  const mbid='12345678-abcd-4321-abcd-123456789012';
  const album={...seedAlbums[0],id:'mb-'+mbid};
  let imports=0;
  const catalogProvider=async()=>({searchCatalog:async()=>[{mbid,title:album.title}],importAlbum:async()=>{imports++;return album;}});
  const first=await start(t,{filename,catalogProvider});
  active=first;
  const person=first.client();
  assert.equal((await person.req('POST','/entries',{albumId:'disco-a'})).status,401);
  assert.equal((await person.req('POST','/auth/logout',{}, {origin:'https://outra-origem.example'})).status,403);
  assert.equal((await person.req('POST','/auth/logout',{}, {'content-type':'text/plain'})).status,415);
  await person.register('teste');
  assert.equal((await person.ok('GET','/catalog/search?q=disco')).results[0].mbid,mbid);
  await person.ok('POST','/catalog/import/'+mbid,{});
  await person.ok('POST','/catalog/import/'+mbid,{});
  assert.equal(imports,1);
  await person.ok('POST','/entries',{albumId:album.id});
  await first.close();
  const next=await start(t,{filename,catalogProvider});
  active=next;
  const client=next.client();
  const persisted=await client.req('GET','/bootstrap',undefined,{cookie:person.cookie()});
  assert.equal(persisted.data.user.username,'teste');
  assert.equal(persisted.data.entries[0].albumId,album.id);
  assert.ok(persisted.data.albums.some(x=>x.id===album.id));
  let last;
  for(let i=0;i<31;i++) last=await client.req('POST','/auth/login',{username:'',password:''});
  assert.equal(last.status,429);
});

test('avatar aceita PNG válido, remove metadados e verifica audiência ao carregar a imagem', async t=>{
  function chunk(name,body) {
    const bytes=Buffer.alloc(body.length+12);
    bytes.writeUInt32BE(body.length);
    bytes.write(name,4);
    body.copy(bytes,8);
    bytes.writeUInt32BE(crc32(bytes.subarray(4,-4)),bytes.length-4);
    return bytes;
  }
  const header=Buffer.from('00000001000000010806000000','hex');
  const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('tEXt',Buffer.from('Comment\0conteúdo local')),chunk('IDAT',deflateSync(Buffer.from([0,255,64,0,255]))),chunk('IEND',Buffer.alloc(0))]);
  const clean=avatarValue('data:image/png;base64,'+png.toString('base64'));
  assert.ok(!Buffer.from(clean.split(',')[1],'base64').includes(Buffer.from('Comment')));
  assert.equal(avatarValue(clean),clean);
  assert.throws(()=>avatarValue('data:text/plain;base64,YQ=='),/PNG/);
  assert.throws(()=>avatarValue('data:image/png;base64,YQ=='),/PNG/);
  const app=await start(t);
  const dono=app.client(), visitante=app.client();
  const {user}=await dono.register('comfoto');
  const publicProfile=(await dono.ok('PATCH','/account',{avatar:clean})).user;
  assert.equal(publicProfile.avatar,'/api/people/'+user.id+'/avatar.png');
  const bootstrap=await visitante.read();
  assert.ok(!JSON.stringify(bootstrap).includes('data:image/png'));
  const photo=await fetch(app.url+publicProfile.avatar);
  assert.equal(photo.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()),Buffer.from(clean.split(',')[1],'base64'));
  const {user:outro}=await visitante.register('outrapessoa');
  await dono.ok('POST','/people/'+outro.id+'/block',{active:true});
  const blockedPhoto=await fetch(app.url+publicProfile.avatar,{headers:{cookie:visitante.cookie()}});
  assert.equal(blockedPhoto.status,404);
  assert.deepEqual((await dono.read()).blockedPeople.map(p=>p.username),['outrapessoa']);
  assert.equal((await visitante.read()).blockedPeople.length,0);
});

test('backup online restaura histórico e pede novo login sem substituir arquivos existentes',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'capa-backup-'));
  const saved=join(dir,'copia.sqlite'), filename=join(dir,'original.sqlite');
  const instances=[];
  t.after(async()=>{
    for(const app of instances) await app.close();
    await rm(dir,{recursive:true,force:true});
  });
  const live=await start(t,{filename});
  instances.push(live);
  const dono=live.client();
  await dono.register('backup');
  await dono.ok('POST','/entries',{albumId:'disco-a',visibility:'private',review:'Minha escuta de teste'});
  const snapshot=await backupDatabase(filename,saved);
  assert.equal(snapshot.integridade,'ok');
  await assert.rejects(backupDatabase(filename,saved),{code:'EEXIST'});
  const restored=await start(t,{filename:saved});
  instances.push(restored);
  const conta=restored.client();
  const prior=await conta.req('GET','/bootstrap',undefined,{cookie:dono.cookie()});
  assert.equal(prior.data.user,null);
  assert.deepEqual(prior.data.entries,[]);
  await conta.ok('POST','/auth/login',{username:'backup',password:senha});
  assert.equal((await conta.read()).entries[0].review,'Minha escuta de teste');
  assert.equal((await dono.read()).user.username,'backup');
});

test('identidades visuais e edições estão disponíveis desde a primeira instalação', async t => {
  const app = await start(t,{seedAlbums:undefined});
  const browser = app.client();
  const [first,second] = await Promise.all([
    browser.ok('GET','/identidades'),
    browser.ok('GET','/identidades')
  ]);
  assert.deepEqual(first,second);
  const data = first;
  const {albums} = await browser.read();
  assert.equal(typeof data.versao,'number');
  assert.ok(Array.isArray(data.identidades) && data.identidades.length >= 3);
  assert.ok(data.presetsNivel2 && data.presetsNivel2.cru && data.presetsNivel2.editorial && data.presetsNivel2.classico);
  const ids = new Set(data.identidades.map(x=>x.albumId));
  for (const albumId of ['mb-0aa87f3e-a91a-4355-ad9e-6d60be378841','mb-029bb5e7-f051-4a0f-8c57-a5b89d914300','mb-9ad6641b-e9c6-462e-a039-f3255ded0c2c']) {
    assert.ok(ids.has(albumId),'identidade ausente: '+albumId);
  }
  for (const identidade of data.identidades) {
    const album = albums.find(item=>item.id===identidade.albumId);
    assert.ok(album?.tracks.length);
    const page = await fetch(app.url+'/album/'+identidade.albumId);
    assert.equal(page.status,200);
    assert.match(await page.text(),/property="og:title"/);
    assert.ok(identidade.nivel >= 1 && identidade.nivel <= 3);
    assert.match(identidade.paleta.fundo,/^#[0-9a-f]{6}$/i);
    assert.match(identidade.paleta.tinta,/^#[0-9a-f]{6}$/i);
    assert.ok(typeof identidade.tipografia.fonteTitulo === 'string' && identidade.tipografia.fonteTitulo.length > 2);
    assert.ok(Array.isArray(identidade.regras) && identidade.regras.length > 0);
    assert.ok(identidade.dossie && identidade.dossie.endsWith('IDENTIDADE.md'));
  }
});

test('busca dinâmica cai para o acervo local quando a API externa falha', async t => {
  const failing = async() => ({searchMusic:async()=>{throw Object.assign(new Error('fora'),{status:503});}});
  const app = await start(t,{catalogProvider:failing});
  const c=app.client();
  const result = await c.ok('GET','/catalog/discover?q=disco&kind=group&page=1');
  assert.ok(Array.isArray(result.results));
  assert.ok(result.results.length>=2, 'Disco de teste e Segundo disco devem aparecer');
  assert.ok(result.results.some(r=>/disco de teste/i.test(r.title||'')), 'Disco de teste deve aparecer');
  const byArtist = await c.ok('GET','/catalog/discover?q=artista b&kind=group&page=1');
  assert.ok(byArtist.results.some(r=>/segundo disco/i.test(r.title||'')), 'Segundo disco deve aparecer por artista');
});

