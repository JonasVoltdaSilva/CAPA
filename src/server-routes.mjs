import {authorizedSources} from '../public/cover-policy.js';
import { catalogRoute } from './server-catalog.mjs';
import { randomUUID, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicUser, digest, entryRow, listRow } from './server-db.mjs';
import { insist, HttpError, string, stringList, validDate, avatarValue, passwordValue, usernameValue, visibility, target } from './server-validation.mjs';

const derive = promisify(scrypt);
// Biblioteca de identidades visuais por álbum (references/album-identities/identities.json).
// Fonte da verdade fora de public/; entregue ao navegador como somente leitura.
const appRoot = fileURLToPath(new URL('../', import.meta.url));
let identitiesPromise;
function loadIdentities() {
  identitiesPromise ??= readFile(join(appRoot, 'references', 'album-identities', 'identities.json'), 'utf8')
    .then(raw => {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.identidades)) throw new Error('formato inesperado');
      return parsed;
    })
    .catch(err => {
      console.error(new Date().toISOString(), 'Registro de identidades indisponível:', err.message);
      identitiesPromise = undefined;
      return null;
    });
  return identitiesPromise;
}
let hashJobs = 0;
async function passHash(password, salt) {
  insist(hashJobs < 8,'As contas estão recebendo muitas solicitações. Tente novamente em instantes.',503);
  hashJobs++;
  try {
    return (await derive(password, salt, 64, {N:32768, r:8, p:2, maxmem:64*1024*1024})).toString('hex');
  } finally { hashJobs--; }
}
async function matches(password, encoded) {
  const [salt,hash] = (encoded || ('0'.repeat(32) + ':' + '0'.repeat(128))).split(':');
  const result = await passHash(password,salt);
  return timingSafeEqual(Buffer.from(result,'hex'),Buffer.from(hash,'hex')) && Boolean(encoded);
}

function newEntry(data, previous, catalog) {
  const item = {...{trackId:null,date:new Date().toISOString().slice(0,10),rating:null,review:'',favorite:false,visibility:'public'}, ...previous, ...data};
  const music = target(catalog,item.albumId,item.trackId);
  const rating = item.rating;
  insist(rating === null || (Number.isInteger(rating * 2) && typeof rating === 'number' && rating >= .5 && rating <= 5),
    'Escolha uma nota de 0,5 a 5 estrelas.');
  insist(typeof item.favorite === 'boolean', 'Favorito inválido.');
  return {...music,date:validDate(item.date),rating,review:string(item.review,'Crítica',6000),
    favorite:Number(item.favorite),visibility:visibility(item.visibility)};
}
function listValues(body, previous, catalog) {
  const item = {description:'',items:[],visibility:'public',...previous,...body};
  insist(Array.isArray(item.items) && item.items.length <= 200,'Cada lista permite até 200 itens.');
  const items = item.items.map(x => {
    insist(x && typeof x === 'object', 'Item de lista inválido.');
    return target(catalog, x.albumId, x.trackId);
  });
  insist(new Set(items.map(x => JSON.stringify([x.albumId,x.trackId]))).size === items.length,'Há itens repetidos na lista.');
  return {title:string(item.title,'Título',120,1),description:string(item.description,'Descrição',1200),
    items:JSON.stringify(items),visibility:visibility(item.visibility)};
}

function providerError(error, fallback) {
  const isProviderResponse = [400,404,422,429,503].includes(error?.status) && error?.statusCode === error.status;
  return new HttpError(isProviderResponse ? error.status : 503,isProviderResponse ? error.message : fallback);
}

export async function apiRoute({store, method, url, body, cookie, setCookie, throttle, ip, catalogProvider}) {
  const {get,run,all,atomic} = store;
  const path = url.pathname.slice('/api'.length);
  const [section,id,action,extra] = path.split('/').slice(1);
  const me = store.authenticated(cookie);
  const now = new Date().toISOString();
  function session(userId) {
    if (cookie) run('DELETE FROM sessions WHERE hash=?', digest(cookie));
    setCookie(store.issueSession(userId));
    return {user:publicUser(get('SELECT * FROM users WHERE id=?',userId))};
  }
  function auth() { insist(me, 'Entre na sua conta para continuar.',401); }
  function safeEntry(entryId) {
    const row = get('SELECT * FROM entries WHERE id=? AND userId NOT IN (SELECT userId FROM suspensions)',entryId);
    insist(row && (row.visibility === 'public' || row.userId === me?.id) && !store.blockedBetween(row.userId, me?.id),
      'Registro indisponível.',404);
    return row;
  }
  function existingPerson(personId) {
    const row = get('SELECT id FROM users WHERE id=? AND id NOT IN (SELECT userId FROM suspensions)',personId);
    insist(row && row.id !== me.id,'Pessoa indisponível.',404);
    return row.id;
  }
  if (method === 'GET' && path === '/bootstrap') return store.bootstrap(me?.id);
  if(method==='GET'&&path==='/cover-sources'){
    const album=store.catalog().get(url.searchParams.get('albumId'));
    insist(album,'Edição indisponível.',404);
    const registry=JSON.parse(await readFile(join(appRoot,'references','cover-sources.json'),'utf8'));
    return {sources:authorizedSources({...album,coverSources:[...(album.coverSources||[]),...(registry.sources||[])]}).filter(s=>!s.primary)};
  }
  if (method === 'GET' && path === '/identidades') {
    const registry = await loadIdentities();
    return registry ?? {versao: 1, atualizadoEm: null, niveis: {}, presetsNivel2: {}, identidades: []};
  }
  if (method === 'GET' && path === '/catalog/search') {
    const q = string(url.searchParams.get('q') ?? '','Busca',120,2);
    throttle('catalogue:' + ip,45,60000);
    try { return {results:await (await catalogProvider()).searchCatalog(q)}; }
    catch {
      const lib = store.music;
      const local = lib.localSearch ? lib.localSearch(q,{page:1,year:'',type:''}) : {results:[]};
      return {results:local.results, local:Boolean(local.local)};
    }
  }
  if (path.startsWith('/catalog/')) {
    return catalogRoute({store,url,method,ip,me,throttle,catalogProvider});
  }
  if (method === 'POST' && path === '/auth/register') {
    throttle('register:' + ip,12,600000);
    const username = usernameValue(body.username);
    const email = string(body.email,'E-mail',254,3).toLowerCase();
    insist(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Informe um e-mail válido.');
    const name = string(body.name || username,'Nome',80,1);
    const password = passwordValue(body.password);
    const salt = randomBytes(16).toString('hex');
    const hash = salt + ':' + await passHash(password,salt);
    return atomic(() => {
      insist(!get('SELECT 1 FROM users WHERE username=? OR email=?',username,email),'Nome de usuário ou e-mail indisponível.',409);
      const uid = randomUUID();
      run('INSERT INTO users(id,username,email,passwordHash,name) VALUES(?,?,?,?,?)',uid,username,email,hash,name);
      return session(uid);
    });
  }
  if (method === 'POST' && path === '/auth/login') {
    throttle('login:' + ip,30,600000);
    const identifier = string(body.identifier ?? body.username ?? body.email ?? body.login,'Usuário ou e-mail',254,1);
    const password = body.password;
    insist(typeof password === 'string' && Buffer.byteLength(password) <= 512,'Credenciais inválidas.',401);
    const user = get('SELECT * FROM users WHERE username=? OR email=?',identifier,identifier);
    insist(await matches(password,user?.passwordHash),'Credenciais inválidas.',401);
    insist(get('SELECT 1 FROM users WHERE id=?',user.id),'Credenciais inválidas.',401);
    insist(!get('SELECT userId FROM suspensions WHERE userId=?',user.id),'Conta suspensa pela moderação.',403);
    return session(user.id);
  }
  if (method === 'POST' && path === '/auth/logout') {
    if (cookie) run('DELETE FROM sessions WHERE hash=?',digest(cookie));
    setCookie('');
    return {ok:true};
  }
  auth();
  if (path === '/account' && method === 'PATCH') {
    const profile = get('SELECT username,name,bio,avatar,favoriteAlbums,favoriteArtists FROM users WHERE id=?',me.id);
    const username = usernameValue(body.username ?? profile.username);
    const name = string(body.name ?? profile.name,'Nome',80,1);
    const bio = string(body.bio ?? profile.bio,'Biografia',500);
    const avatar = body.avatar === undefined ? profile.avatar : avatarValue(body.avatar);
    const favoriteAlbums = stringList(body.favoriteAlbums ?? JSON.parse(profile.favoriteAlbums),'Álbuns favoritos',4);
    const albums = store.catalog();
    insist(favoriteAlbums.every(x=>albums.has(x)),'Selecione álbuns do catálogo.');
    const favoriteArtists = stringList(body.favoriteArtists ?? JSON.parse(profile.favoriteArtists),'Artistas favoritos',12);
    insist(!get('SELECT id FROM users WHERE username=? AND id<>?',username,me.id),'Esse nome de usuário já está em uso.',409);
    run('UPDATE users SET username=?, name=?, bio=?, avatar=?, favoriteAlbums=?, favoriteArtists=? WHERE id=?',
      username,name,bio,avatar,JSON.stringify(favoriteAlbums),JSON.stringify(favoriteArtists),me.id);
    return {user:publicUser(get('SELECT * FROM users WHERE id=?',me.id))};
  }
  if (path === '/account' && method === 'DELETE') {
    throttle('delete:' + ip,10,600000);
    const {passwordHash} = get('SELECT passwordHash FROM users WHERE id=?',me.id);
    insist(typeof body.password === 'string' && Buffer.byteLength(body.password) <= 512 && await matches(body.password,passwordHash),
      'Confirme sua senha para excluir a conta.',403);
    run('DELETE FROM users WHERE id=?',me.id);
    setCookie('');
    return {ok:true};
  }
  if (section === 'entries' && !action && !extra) {
    if (method === 'POST' && !id) {
      const e = newEntry(body,null,store.catalog());
      const key = randomUUID();
      run('INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?)',key,me.id,e.albumId,e.trackId,e.date,e.rating,e.review,e.favorite,e.visibility,now,now);
      return {entry:entryRow(get('SELECT * FROM entries WHERE id=?',key))};
    }
    if (id && (method === 'PATCH' || method === 'DELETE')) {
      const row = safeEntry(id);
      insist(row.userId === me.id,'Você só pode alterar seus registros.',403);
      if (method === 'DELETE') { run('DELETE FROM entries WHERE id=?',id); return {ok:true}; }
      const e = newEntry(body,entryRow(row),store.catalog());
      run('UPDATE entries SET albumId=?,trackId=?,date=?,rating=?,review=?,favorite=?,visibility=?,updatedAt=? WHERE id=?',
        e.albumId,e.trackId,e.date,e.rating,e.review,e.favorite,e.visibility,now,id);
      return {entry:store.entry(id,me.id)};
    }
  }
  if (section === 'entries' && id && !extra && method === 'POST' && ['comments','like'].includes(action)) {
    const e = safeEntry(id);
    insist(e.visibility === 'public','É preciso uma avaliação pública para interagir.',403);
    if (action === 'comments') {
      const comment = {id:randomUUID(),userId:me.id,entryId:id,text:string(body.text,'Comentário',1500,1),createdAt:now};
      run('INSERT INTO comments VALUES(?,?,?,?,?)',comment.id,me.id,id,comment.text,now);
      return {comment};
    }
    const active = body.active ?? !get('SELECT 1 FROM likes WHERE userId=? AND entryId=?',me.id,id);
    insist(typeof active === 'boolean','Estado da curtida inválido.');
    if (active) run('INSERT OR IGNORE INTO likes VALUES(?,?)',me.id,id);
    else run('DELETE FROM likes WHERE userId=? AND entryId=?',me.id,id);
    return {ok:true,active};
  }
  if (section === 'people' && id && !extra && method === 'POST' && ['follow','block'].includes(action)) {
    const person = existingPerson(id);
    const table = action === 'block' ? 'blocks' : 'follows';
    if (action === 'follow') insist(!store.blockedBetween(me.id,id),'Pessoa indisponível.',404);
    const active = body.active ?? !get(`SELECT 1 FROM ${table} WHERE userId=? AND targetId=?`,me.id,person);
    insist(typeof active === 'boolean','Estado da relação inválido.');
    return atomic(() => {
      if (active) run(`INSERT OR IGNORE INTO ${table} VALUES(?,?)`,me.id,person);
      else run(`DELETE FROM ${table} WHERE userId=? AND targetId=?`,me.id,person);
      if (active && action === 'block')
        run('DELETE FROM follows WHERE (userId=? AND targetId=?) OR (userId=? AND targetId=?)',me.id,person,person,me.id);
      return {ok:true,active};
    });
  }
  if (section === 'lists' && !action && !extra) {
    if ((method === 'POST' && !id) || (id && (method === 'PATCH' || method === 'DELETE'))) {
      const prior = id && get('SELECT * FROM lists WHERE id=? AND userId=?',id,me.id);
      insist(!id || prior,'Lista indisponível.',404);
      if (method === 'DELETE') { run('DELETE FROM lists WHERE id=?',id); return {ok:true}; }
      const v = listValues(body,prior && listRow(prior),store.catalog());
      const key = id || randomUUID();
      if (!id) run('INSERT INTO lists VALUES(?,?,?,?,?,?,?,?)',key,me.id,v.title,v.description,v.items,v.visibility,now,now);
      else run('UPDATE lists SET title=?,description=?,items=?,visibility=?,updatedAt=? WHERE id=?',v.title,v.description,v.items,v.visibility,now,id);
      return {list:listRow(get('SELECT * FROM lists WHERE id=?',key))};
    }
  }
  if (path === '/battles' && method === 'POST') {
    const cat = store.catalog();
    const {albumA,albumB,winner} = body;
    insist(cat.has(albumA) && cat.has(albumB) && albumA !== albumB && [albumA,albumB].includes(winner),'Escolha dois discos diferentes e um favorito.');
    const [a,b] = [albumA,albumB].sort();
    run(`INSERT INTO battles VALUES(?,?,?,?,?,?) ON CONFLICT(userId,albumA,albumB) DO UPDATE SET winner=excluded.winner,createdAt=excluded.createdAt`,
      randomUUID(),me.id,a,b,winner,now);
    return {battle:get('SELECT * FROM battles WHERE userId=? AND albumA=? AND albumB=?',me.id,a,b)};
  }
  if (path === '/reports' && method === 'POST') {
    throttle('report:' + me.id,20,3600000);
    const {targetType,targetId} = body;
    insist(typeof targetId === 'string' && targetId.length <= 100,'Identificador inválido.');
    const reason = string(body.reason,'Motivo',1200,1);
    if (targetType === 'user') {
      existingPerson(targetId);
    } else if (targetType === 'entry') {
      const e = safeEntry(targetId);
      insist(e.userId !== me.id,'Conteúdo inválido.');
    } else if (targetType === 'comment') {
      const c = get('SELECT * FROM comments WHERE id=?',targetId);
      insist(c && c.userId !== me.id && !store.blockedBetween(me.id,c.userId),'Comentário indisponível.',404);
      safeEntry(c.entryId);
    } else if (targetType === 'list') {
      const l = get("SELECT userId FROM lists WHERE id=? AND visibility='public'",targetId);
      insist(l && l.userId !== me.id && !store.blockedBetween(l.userId,me.id),'Lista indisponível.',404);
    } else throw new HttpError(400,'Tipo de denúncia inválido.');
    run(`INSERT INTO reports VALUES(?,?,?,?,?,?) ON CONFLICT(userId,targetType,targetId) DO UPDATE SET reason=excluded.reason,createdAt=excluded.createdAt`,
      randomUUID(),me.id,targetType,targetId,reason,now);
    return {ok:true};
  }
  throw new HttpError(404,'Rota indisponível.');
}


