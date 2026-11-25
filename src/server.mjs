import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve, extname, sep, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openStore } from './server-db.mjs';
import { apiRoute } from './server-routes.mjs';
import { HttpError, insist } from './server-validation.mjs';
import { createCatalogProvider } from './catalog-music.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json',
  '.png':'image/png','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.webp':'image/webp',
  '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.avif':'image/avif'};
const titleEscape = v => String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const nowName = () => new Date().toISOString();
function json(res,status,body) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
}
async function jsonBody(req) {
  const raw = [];
  let size = 0;
  for await (const piece of req) {
    size += piece.length;
    insist(size <= 520000,'Arquivo ou formulário muito grande.',413);
    raw.push(piece);
  }
  if (!size) return {};
  let data;
  try { data = JSON.parse(Buffer.concat(raw).toString('utf8')); }
  catch { throw new HttpError(400,'O formulário recebido é inválido.'); }
  insist(data && typeof data === 'object' && !Array.isArray(data), 'O formulário recebido é inválido.');
  return data;
}
function limits() {
  const buckets = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key,b] of buckets) if (b.end <= now) buckets.delete(key);
  },60000);
  cleanup.unref();
  return {
    close:() => clearInterval(cleanup),
    check(key,max,window) {
      const now = Date.now();
      let b = buckets.get(key);
      if (!b || b.end <= now) {
        insist(buckets.size < 20000 || b,'Muitas solicitações. Tente mais tarde.',429);
        b = {end:now + window,n:0};
        buckets.set(key,b);
      }
      insist(++b.n <= max,'Muitas solicitações. Aguarde antes de tentar novamente.',429);
    }
  };
}

function publicPreview(store,path,origin,viewer) {
  const parts = path.match(/^\/(avaliacao|perfil|lista|album)\/([^/]+)\/?$/);
  if (!parts) return null;
  const [,kind,id] = parts;
  let title,description, album,owner;
  if (kind === 'album') {
    album = store.catalog().get(id);
    if (!album) return /^mb-[a-f0-9-]{36}$/i.test(id)?null:{hidden:true};
    title = album.title + (album.artist ? ' · ' + album.artist : '');
    description = [album.type, album.year, album.genre, album.tracks?.length ? album.tracks.length + ' faixas' : '']
      .filter(Boolean).join(' · ') || 'Disco no catálogo do CAPA.';
  } else if (kind === 'perfil') {
    const profile = store.get('SELECT id,name,username,bio FROM users WHERE username=?',id);
    if (!profile || store.blockedBetween(profile.id,viewer?.id) || store.get('SELECT 1 FROM suspensions WHERE userId=?',profile.id)) return {hidden:true};
    owner = profile.id;
    title = profile.name + ' (@' + profile.username + ')';
    description = profile.bio || 'Perfil musical no CAPA.';
  } else if (kind === 'lista') {
    const list = store.get('SELECT userId,visibility,title,description,items FROM lists WHERE id=?',id);
    if (!list || store.blockedBetween(list.userId,viewer?.id) || store.get('SELECT 1 FROM suspensions WHERE userId=?',list.userId)) return {hidden:true};
    if (list.visibility !== 'public') return {hidden:list.userId !== viewer?.id};
    owner = list.userId;
    title = list.title;
    description = list.description || 'Lista musical no CAPA.';
    album = store.catalog().get(JSON.parse(list.items)[0]?.albumId);
  } else {
    const e = store.get('SELECT * FROM entries WHERE id=?',id);
    if (!e || store.blockedBetween(e.userId,viewer?.id) || store.get('SELECT 1 FROM suspensions WHERE userId=?',e.userId)) return {hidden:true};
    if (e.visibility !== 'public') return {hidden:e.userId !== viewer?.id};
    owner = e.userId;
    album = store.catalog().get(e.albumId);
    const what = album?.tracks?.find(t => t.id === e.trackId)?.title ?? album?.title ?? 'Escuta';
    title = what + (album?.artist ? ' · ' + album.artist : '');
    const author = store.get('SELECT username FROM users WHERE id=?',owner);
    description = [author && '@' + author.username, e.rating && e.rating.toLocaleString('pt-BR') + '/5', e.review || 'Registro de escuta no CAPA.'].filter(Boolean).join(' · ');
  }
  const image = album?.exportCover && album?.cover ? album.cover : '/assets/icon-512.png';
  const full = new URL(image,origin);
  return {title,description:description.slice(0,250),url:new URL(path,origin).href,image:/^https?:$/.test(full.protocol) ? full.href : null};
}
function addMeta(html,preview) {
  if (!preview?.title) return html;
  const {title,description,url,image} = preview;
  const values = {'og:title':title + ' · CAPA','og:type':'website','og:description':description,'og:url':url,'og:image':image};
  const tags = Object.entries(values).filter(([,val])=>val).map(([name,val])=>
    '<meta property="' + name + '" content="' + titleEscape(val) + '">').join('\n');
  return html.replace(/<meta\b[^>]*\bproperty=["']og:[^>]*>/gi,'')
    .replace(/<title\b[^>]*>.*?<\/title>/is, () => '<title>' + titleEscape(title) + ' · CAPA</title>')
    .replace('</head>', () => tags + '\n</head>');
}

export async function createApp(options = {}) {
  const publicDir = resolve(options.publicDir ?? join(root,'public'));
  const seed = options.seedAlbums ?? JSON.parse(await readFile(join(root,'src','catalog.json'),'utf8'));
  const dbFile = options.filename ?? join(resolve(process.env.DATA_DIR ?? join(root,'data')),'capa.sqlite');
  const store = openStore(dbFile,seed);
  const limit = limits();
  const conf = options.origin ?? process.env.APP_ORIGIN;
  const base = conf && new URL(conf).origin;
  const trustLocalProxy = process.env.TRUST_PROXY === 'loopback';
  const providerInstance=createCatalogProvider({store:store.music});
  const catalogProvider = options.catalogProvider ?? (() => providerInstance);
  const server = createServer({requestTimeout:20000, headersTimeout:12000}, async (req,res) => {
    try {
      // Public deployment sets APP_ORIGIN at its HTTPS reverse proxy. Development
      // accepts only a loopback origin when the server is bound to localhost.
      const host = req.headers.host;
      insist(typeof host === 'string' && /^[a-z0-9.:\[\]-]+$/i.test(host),'Endereço inválido.',400);
      const requestBase = base || new URL('http://' + host).origin;
      const listener = server.address();
      if (!base && ['127.0.0.1','::1'].includes(listener?.address)) {
        insist(['localhost','127.0.0.1','[::1]'].includes(new URL(requestBase).hostname),'Endereço inválido.',400);
      }
      const url = new URL(req.url,requestBase);
      insist(url.origin === requestBase || (base && url.origin === base),'Endereço inválido.');
      const safe = url.protocol === 'https:';
      const cookieName = safe ? '__Host-capa' : 'capa';
      const token = (req.headers.cookie || '').split(';').map(x=>x.trim().split('=')).find(x=>x[0] === cookieName)?.[1];
      const cookie = token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : '';
      const setCookie = value => res.setHeader('Set-Cookie',`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${value ? 2592000 : 0}${safe ? '; Secure' : ''}`);
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('X-Frame-Options','DENY');
      res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; connect-src 'self' https://coverartarchive.org https://*.archive.org https://*.wikimedia.org; manifest-src 'self'; worker-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      if (safe) res.setHeader('Strict-Transport-Security','max-age=31536000');
      const avatarPath = url.pathname.match(/^\/api\/people\/([a-f0-9-]{36})\/avatar\.png$/);
      if (avatarPath && ['GET','HEAD'].includes(req.method)) {
        const owner = avatarPath[1];
        const viewer = store.authenticated(cookie);
        const image = !store.blockedBetween(owner,viewer?.id) && store.get(
          'SELECT avatar FROM users WHERE id=? AND id NOT IN (SELECT userId FROM suspensions)',owner)?.avatar;
        insist(image,'Imagem indisponível.',404);
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'private, no-store'});
        res.end(req.method === 'HEAD' ? undefined : Buffer.from(image.slice('data:image/png;base64,'.length),'base64'));
        return;
      }
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        insist(['GET','POST','PATCH','DELETE'].includes(req.method),'Método indisponível.',405);
        const peer = req.socket.remoteAddress ?? 'local';
        const trusted = trustLocalProxy && ['::1','127.0.0.1','::ffff:127.0.0.1'].includes(peer);
        const realIp = req.headers['x-real-ip'];
        const ip = trusted && typeof realIp === 'string' && isIP(realIp) ? realIp : peer;
        let body = {};
        if (req.method !== 'GET') {
          insist(!req.headers.origin || req.headers.origin === requestBase,'Origem não autorizada.',403);
          insist(!req.headers['sec-fetch-site'] || ['same-origin','none'].includes(req.headers['sec-fetch-site']),'Origem não autorizada.',403);
          const jsonType = req.headers['content-type']?.split(';')[0].trim().toLowerCase() === 'application/json';
          insist(jsonType || (req.headers.origin === requestBase && !req.headers['transfer-encoding'] && Number(req.headers['content-length'] || 0) === 0),
            'Envie um formulário JSON.',415);
          limit.check('mutation:' + ip,200,60000);
          insist(Number(req.headers['content-length'] || 0) <= 520000,'Arquivo ou formulário muito grande.',413);
          body = await jsonBody(req);
        }
        const data = await apiRoute({store,method:req.method,url,body,cookie,setCookie,throttle:limit.check,ip,catalogProvider});
        json(res,200,data);
        return;
      }
      insist(req.method === 'GET' || req.method === 'HEAD','Método indisponível.',405);
      let path;
      try { path = decodeURIComponent(url.pathname); }
      catch { throw new HttpError(400,'Endereço inválido.'); }
      insist(!path.includes('\\') && !path.includes('\0') && !path.split('/').some(part=>part.startsWith('.')),'Arquivo indisponível.',404);
      const local = resolve(publicDir,'.' + path);
      insist(!isAbsolute(path.slice(1)) && (local === publicDir || local.startsWith(publicDir + sep)),'Arquivo indisponível.',404);
      const info = await stat(local).catch(()=>null);
      if (info?.isFile() && path !== '/index.html') {
        const type = types[extname(local)];
        insist(type,'Arquivo indisponível.',404);
        res.writeHead(200,{'Content-Type':type,'Cache-Control':path === '/sw.js' ? 'no-cache' : 'public, max-age=300'});
        res.end(req.method === 'HEAD' ? undefined : await readFile(local));
        return;
      }
      const shared = /^\/(perfil|avaliacao|lista|album)\/[^/]+\/?$/.test(path);
      insist(shared || !extname(path) || path === '/index.html','Arquivo indisponível.',404);
      const preview = shared && publicPreview(store,path,requestBase,store.authenticated(cookie));
      const html = await readFile(join(publicDir,'index.html'),'utf8');
      res.writeHead(preview?.hidden ? 404 : 200,{'Content-Type':types['.html'],'Cache-Control':'no-store'});
      res.end(req.method === 'HEAD' ? undefined : addMeta(html,preview));
    } catch (err) {
      if (!res.headersSent && !res.destroyed) {
        if (!(err instanceof HttpError)) console.error(nowName(), 'Falha na requisição',err.code ?? err.name);
        json(res,err instanceof HttpError ? err.status : 500,{error:err instanceof HttpError ? err.message : 'Não foi possível concluir a operação.'});
      } else res.end();
    }
  });
  server.on('close',()=>{ limit.close(); store.db.close(); });
  return {server,store};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const {server} = await createApp();
  const port = Number(process.env.PORT || 3000), host = process.env.HOST || '127.0.0.1';
  server.listen(port,host,()=>console.log('CAPA em http://' + host + ':' + server.address().port));
  for (const signal of ['SIGTERM','SIGINT']) process.once(signal,()=>server.close());
}

