import {openShareDestinations} from './share-files.js';
import {ratingBlock} from './ui.js';

// Views for individual listeners and the community. Shared data comes from the authenticated bootstrap.
const pathId = value => encodeURIComponent(value ?? '');
const same = (a, b) => a != null && b != null && String(a) === String(b);
const has = (values, id) => (values || []).some(value => same(value, id));
const byId = (values, id) => (values || []).find(value => same(value.id, id));
const search = () => new URL(location.href).searchParams;
const rate = value => Number(value).toLocaleString('pt-BR', {maximumFractionDigits: 1});
const dateText = date => /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {day:'numeric',month:'short',year:'numeric'}) : '';
const sorted = entries => [...entries].sort((a,b) => b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
const own = (c, id) => same(c.s.user?.id, id);
const personal = c => sorted(c.s.entries.filter(e => own(c, e.userId)));
const publicEntries = c => sorted(c.s.entries.filter(e => e.visibility === 'public'));
const detail = (c, item) => {
  const album = c.album(item.albumId);
  const track = byId(album?.tracks, item.trackId);
  return {album, track, title:track?.title || album?.title || 'Obra indisponível'};
};
const profileURL = u => '/perfil/' + pathId(u.username);
const entryURL = e => '/avaliacao/' + pathId(e.id);
const listURL = l => '/lista/' + pathId(l.id);
const releaseURL = (album, track) => track ? '/musica/' + pathId(album.id) + '/' + pathId(track.id) : '/album/' + pathId(album.id);
const photo = (c,u,size='') => {
  const localImage = u?.avatar?.startsWith('data:image/png;base64,') || u?.avatar === '/api/people/'+pathId(u?.id)+'/avatar.png';
  return `<span class="sc-avatar ${size}">${localImage ? `<img src="${c.esc(u.avatar)}" alt="">` : c.esc(Array.from(u?.name || u?.username || '?')[0].toLocaleUpperCase('pt-BR'))}</span>`;
};
const option = (c, val, title, active) => `<option value="${c.esc(String(val))}"${String(val) === String(active) ? ' selected' : ''}>${c.esc(String(title))}</option>`;
let fieldIndex = 0;
const field = (label, control) => {
  const id = 'sc-field-' + (++fieldIndex);
  return `<div class="sc-field"><label for="${id}">${label}</label>${control.replace(/^<(input|select|textarea)\b/, '<$1 id="' + id + '"')}</div>`;
};
const select = (name, options) => `<select name="${name}">${options}</select>`;
const btn = (label, action, id='', extra='') => `<button type="button" class="btn quiet" data-sc-action="${action}" data-id="${pathId(id)}" ${extra}>${label}</button>`;
const link = (label, href, primary=false) => `<a class="btn ${primary ? 'primary' : 'quiet'}" href="${href}">${label}</a>`;
const heading = (c, title, subtitle='', actions='') => `<header class="sc-heading"><div><h1 class="page-title">${c.esc(title)}</h1>${subtitle ? `<p class="muted">${c.esc(subtitle)}</p>` : ''}</div>${actions ? `<div class="sc-actions">${actions}</div>` : ''}</header>`;
const empty = (title, subtitle='', action='') => `<div class="sc-empty"><strong>${title}</strong>${subtitle ? `<p>${subtitle}</p>` : ''}${action}</div>`;
const notice = () => '<p class="sc-error" role="alert" hidden></p>';
const part = (title,body) => `<section class="sc-section"><h2>${title}</h2>${body}</section>`;
const dest = () => {
  const requested = search().get('voltar');
  if (!requested || !requested.startsWith('/') || requested.includes('\\') || requested.startsWith('//')) return '/meu-perfil';
  const target = new URL(requested,location.origin);
  return target.origin === location.origin && !['/entrar','/cadastro'].includes(target.pathname) ? target.pathname + target.search + target.hash : '/meu-perfil';
};
const restricted = (c,title,explanation) => heading(c,title) + empty('Entre para continuar',explanation,link('Entrar','/entrar?voltar='+encodeURIComponent(location.pathname+location.search),true));
const unavailable = (c,noun) => heading(c,noun) + empty('Conteúdo indisponível','O endereço pode ter mudado ou o acesso pode ser privado.',link('Abrir a comunidade','/comunidade'));

function authPage(c, register) {
  const title = register ? 'Criar conta' : 'Entrar';
  if (c.s.user) return heading(c,title) + empty('Você já entrou',c.esc(c.s.user.name),link('Continuar',c.esc(dest()),true));
  const other = (register ? '/entrar' : '/cadastro') + '?voltar=' + encodeURIComponent(dest());
  return `<div class="sc-auth"><div class="sc-auth-mark" aria-hidden="true">◉</div>${heading(c,title,register ? 'Dê um lugar às suas escutas.' : 'Volte ao seu diário musical.')}
    <form data-sc-form="${register ? 'register' : 'login'}" class="sc-form">${register ? field('Seu nome','<input name="name" autocomplete="name" required maxlength="80">') +
      field('Nome de usuário','<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="30" pattern="[a-z0-9_][a-z0-9_.\\-]*" title="De 3 a 30 caracteres, use letras minúsculas, números, ponto, traço ou sublinhado.">') : ''}
    ${field('E-mail','<input name="email" type="email" autocomplete="email" autocapitalize="none" required maxlength="254">')}
    ${field(register ? 'Senha (mínimo de 10 caracteres)' : 'Senha',`<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" required ${register ? 'minlength="10"' : ''}>`)}
    ${notice()}<button class="btn primary">${title}</button></form>
    <p class="sc-auth-switch">${register ? 'Já tem conta?' : 'Ainda não tem conta?'} <a href="${other}">${register ? 'Entrar' : 'Criar conta'}</a></p></div>`;
}

function entryCard(c,e) {
  const {album,track,title} = detail(c,e);
  const person = c.user(e.userId);
  const author = person ? `<a class="sc-author" href="${profileURL(person)}">${photo(c,person)}${c.esc(person.name)}</a>` : 'Ouvinte';
  return `<article class="sc-entry"><div class="sc-entry-meta">${author}<span>${dateText(e.date)}${e.visibility === 'private' ? ' · Privado' : ''}</span></div>
    <div class="sc-entry-main">${album ? `<a class="sc-thumb" href="${releaseURL(album,track)}" aria-label="${c.esc(title)}">${c.cover(album)}</a>` : ''}
      <div><a class="sc-entry-title" href="${entryURL(e)}">${c.esc(title)}</a><span class="sc-secondary">${c.esc(album?.artist || '')}${track ? ' · Faixa' : ''}</span>
      ${ratingBlock(e.rating,{compact:true})}${e.favorite ? '<span class="sc-favorite" aria-label="Favorito">♥</span>' : ''}</div></div>
      ${e.review ? `<p class="sc-excerpt">${c.esc(e.review)}</p>` : ''}
      <a class="sc-text-link" href="${entryURL(e)}">Ver registro${e.comments?.length ? ' · ' + e.comments.length + (e.comments.length === 1 ? ' comentário' : ' comentários') : ''}</a>${e.rating && own(c,e.userId) ? `<a class="sc-text-link" href="/estudio?destino=instagram&amp;entry=${pathId(e.id)}">Compartilhar nos Stories</a>` : ''}</article>`;
}
function entryStream(c,entries,blank) { return entries.length ? `<div class="sc-stream">${entries.map(e=>entryCard(c,e)).join('')}</div>` : blank; }

function diary(c) {
  if (!c.s.user) return restricted(c,'Diário musical','Registre a data, a nota e suas impressões sobre cada escuta.');
  const q=search(), raw=personal(c), albums=[...new Map(raw.map(e=>[e.albumId,c.album(e.albumId)])).values()].filter(Boolean);
  const unique=(arr)=>[...new Set(arr)].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const opts=(all,values,active)=>option(c,'',all,active)+values.map(v=>option(c,v,v,active)).join('');
  const entries=raw.filter(e=>{
    const album=c.album(e.albumId);
    return (!q.get('data')||e.date===q.get('data')) && (!q.get('mes')||e.date.slice(5,7)===q.get('mes')) && (!q.get('ano')||e.date.startsWith(q.get('ano'))) &&
      (!q.get('artista')||album?.artist===q.get('artista')) && (!q.get('album')||same(e.albumId,q.get('album'))) && (!q.get('nota')||Number(e.rating)===Number(q.get('nota')));
  });
  const filters=`<details class="sc-filters" ${q.size ? 'open' : ''}><summary>Filtrar escutas</summary><form data-sc-form="filter" class="sc-filter-grid">
    ${field('Data',`<input type="date" name="data" value="${c.esc(q.get('data') || '')}">`)}
    ${field('Mês',select('mes',option(c,'','Todos',q.get('mes'))+Array.from({length:12},(_,i)=>option(c,String(i+1).padStart(2,'0'),new Date(2020,i,1).toLocaleDateString('pt-BR',{month:'long'}),q.get('mes'))).join('')))}
    ${field('Ano',select('ano',opts('Todos',unique(raw.map(e=>e.date.slice(0,4))).reverse(),q.get('ano'))))}
    ${field('Artista',select('artista',opts('Todos',unique(albums.map(a=>a.artist)),q.get('artista'))))}
    ${field('Disco',select('album',option(c,'','Todos',q.get('album'))+albums.map(a=>option(c,a.id,a.title,q.get('album'))).join('')))}
    ${field('Nota',select('nota',option(c,'','Todas',q.get('nota'))+Array.from({length:10},(_,i)=>option(c,(i+1)/2,rate((i+1)/2)+' ★',q.get('nota'))).join('')))}
    <div class="sc-actions"><button class="btn primary">Aplicar</button>${link('Limpar','/diario')}</div></form></details>`;
  return heading(c,'Diário musical','Suas escutas, dia após dia.',btn('Registrar escuta','review')) + filters + entryStream(c,entries,empty(raw.length?'Nenhuma escuta com esses filtros':'Sua primeira escuta',raw.length?'Ajuste o período, a obra ou a nota para buscar novamente.':'Escolha um disco e registre o que ficou com você.',raw.length ? link('Limpar filtros','/diario') : link('Explorar discos','/explorar',true)));
}

function profile(c, username) {
  const u=username ? c.s.people.find(x=>x.username.toLowerCase()===username.toLowerCase()) ?? (c.s.user?.username===username?c.s.user:null) : c.s.user;
  if (!u) return username ? unavailable(c,'Perfil') : restricted(c,'Meu perfil','Reúna seus favoritos, suas listas e seu diário em um só lugar.');
  const mine=own(c,u.id), entries=sorted(c.s.entries.filter(e=>same(e.userId,u.id) && (mine || e.visibility==='public')));
  const lists=c.s.lists.filter(l=>same(l.userId,u.id) && (mine || l.visibility==='public'));
  const favorites=(u.favoriteAlbums||[]).map(id=>c.album(id)).filter(Boolean);
  const following=has(c.s.following,u.id);
  const socialControls=mine ? link('Editar perfil','/configuracoes') : btn(following?'Deixar de seguir':'Seguir','follow',u.id,`aria-pressed="${following}"`);
  const followCounts = `<span><b>${Number(u.followersCount ?? u.followers?.length ?? 0)}</b> seguidores</span><span><b>${Number(u.followingCount ?? u.following?.length ?? (mine?c.s.following?.length:0) ?? 0)}</b> seguindo</span>`;
  const artists=(u.favoriteArtists||[]).map(s=>{
    const artist=c.s.albums.flatMap(artistsOf).find(a=>same(a.id,s)||a.name===s);
    return artist ? `<a class="sc-pill" href="/artista/${pathId(artist.id)}">${c.esc(artist.name)}</a>` : `<span class="sc-pill">${c.esc(s)}</span>`;
  }).join('');
  const recent=entries.slice(0,6);
  return `<header class="sc-profile">${photo(c,u,'large')}<div><p class="sc-handle">@${c.esc(u.username)}</p><h1 class="page-title">${c.esc(u.name)}</h1>
    ${u.bio ? `<p class="sc-bio">${c.esc(u.bio)}</p>` : ''}<div class="sc-metadata">${followCounts}<span><b>${entries.length}</b> escutas</span></div>
    <div class="sc-actions">${socialControls}${btn('Compartilhar perfil','share','',`data-url="${profileURL(u)}"`)}${!mine && c.s.user?btn('Bloquear','block',u.id)+btn('Denunciar','report',u.id,'data-target="user"'):''}</div></div></header>` +
    part('Discos favoritos',favorites.length ? `<div class="sc-albums">${favorites.map(c.card).join('')}</div>` : empty('Os favoritos aparecerão aqui.', '',mine?link('Escolher discos','/configuracoes'):'')) +
    (artists ? part('Artistas favoritos',`<div class="sc-pills">${artists}</div>`) : '') +
    part('Escutas recentes',entryStream(c,recent,empty('Este perfil ainda não tem escutas visíveis.'))) +
    part('Listas',listStream(c,lists,mine?link('Criar lista','/listas?nova=1'):''));
}
function community(c) {
  const q=search(), tab=q.get('aba') || 'atividade', label={atividade:'Atividade',seguindo:'Seguindo',pessoas:'Pessoas'};
  const nav=`<nav class="sc-tabs" aria-label="Comunidade">${Object.entries(label).map(([k,t])=>`<a href="/comunidade?aba=${k}" ${tab===k?'aria-current="page"':''}>${t}</a>`).join('')}</nav>`;
  let body;
  if(tab==='pessoas'){
    const term=(q.get('q')||'').trim().toLocaleLowerCase('pt-BR');
    const users=c.s.people.filter(u=>!own(c,u.id)&&!has(c.s.blocked,u.id)&&[u.name,u.username].some(v=>v.toLocaleLowerCase('pt-BR').includes(term)));
    body=`<form data-sc-form="filter" class="sc-search"><input type="hidden" name="aba" value="pessoas">${field('Buscar ouvintes',`<input type="search" name="q" value="${c.esc(q.get('q')||'')}" placeholder="Nome ou usuário">`)}<button class="btn">Buscar</button></form>`+
      (users.length?`<div class="sc-people">${users.map(u=>`<div class="sc-person"><a href="${profileURL(u)}">${photo(c,u)}<span><strong>${c.esc(u.name)}</strong><small>@${c.esc(u.username)}</small></span></a>${btn(has(c.s.following,u.id)?'Deixar de seguir':'Seguir','follow',u.id)}</div>`).join('')}</div>`:empty('Nenhum ouvinte encontrado.'));
  }else if(tab==='seguindo' && !c.s.user) body=empty('Acompanhe outros ouvintes','Entre para ver as atividades de quem você segue.',link('Entrar','/entrar?voltar=%2Fcomunidade%3Faba%3Dseguindo',true));
  else {
    const visible=id=>tab!=='seguindo'||has(c.s.following,id);
    const events=[...publicEntries(c).filter(e=>visible(e.userId)).map(e=>({date:e.createdAt||e.date,html:()=>entryCard(c,e)})),...c.s.lists.filter(l=>l.visibility==='public'&&visible(l.userId)).map(l=>({date:l.updatedAt||l.createdAt||'',html:()=>listRow(c,l)}))].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    body=events.length?`<div class="sc-stream">${events.map(e=>e.html()).join('')}</div>`:empty(tab==='seguindo'?'Seu feed de seguidos está vazio':'A comunidade está começando','Descubra pessoas que também gostam de ouvir e escrever sobre música.',link('Encontrar ouvintes','/comunidade?aba=pessoas'));
  }
  return heading(c,'Comunidade','Descobertas, escutas e listas de outros ouvintes.')+nav+body;
}

function entryView(c,id) {
  const e=byId(c.s.entries,id);
  if(!e) return unavailable(c,'Registro de escuta');
  const {album,track,title}=detail(c,e), u=c.user(e.userId), mine=own(c,e.userId), isPublic=e.visibility==='public';
  const returnURL='/entrar?voltar='+encodeURIComponent(entryURL(e));
  const actions=btn(e.rating?'Compartilhar nos Stories':'Compartilhar','shareEntry',e.id)+(isPublic?btn('Compartilhar link','share','',`data-url="${entryURL(e)}"`):'')+(mine?btn('Editar','editEntry',e.id)+btn('Excluir','deleteEntry',e.id):btn('Denunciar','report',e.id,'data-target="entry"'));
  const comments=e.comments||[], likes=e.likes||[];
  return `<div class="sc-reading"><a href="${mine?'/diario':'/comunidade'}" class="sc-back">← ${mine?'Meu diário':'Comunidade'}</a>
    ${heading(c,'Registro de escuta')}<article class="sc-record"><header class="sc-record-head">${album?`<a class="sc-feature-cover" href="${releaseURL(album,track)}">${c.cover(album)}</a>`:''}
    <div><p class="sc-handle">${track?'Faixa':'Disco'} · ${dateText(e.date)}</p><h2>${c.esc(title)}</h2><p>${c.esc(album?.artist||'')}</p>
    ${ratingBlock(e.rating)}${e.favorite?'<span class="sc-favorite">♥ Favorito</span>':''}</div></header>
    <div class="sc-entry-meta">${u?`<a class="sc-author" href="${profileURL(u)}">${photo(c,u)}${c.esc(u.name)}</a>`:''}<span>${isPublic?'Público':'Privado'}</span></div>
    ${e.review?`<p class="sc-review-text">${c.esc(e.review)}</p>`:''}<div class="sc-actions">${actions}</div></article>
    ${isPublic?part('Conversa',`<div class="sc-actions">${btn(`${has(likes,c.s.user?.id)?'Curtido':'Curtir'} · ${likes.length}`,'like',e.id,`aria-pressed="${has(likes,c.s.user?.id)}"`)}</div>
    <div class="sc-comments">${comments.map(comment=>{
      const author=c.user(comment.userId);
      return `<article><div class="sc-entry-meta">${author?`<a class="sc-author" href="${profileURL(author)}">${photo(c,author)}${c.esc(author.name)}</a>`:'Ouvinte'}${!own(c,comment.userId)?btn('Denunciar','report',comment.id,'data-target="comment"'):''}</div><p>${c.esc(comment.text)}</p></article>`;
    }).join('')}</div>${c.s.user?`<form class="sc-form" data-sc-form="comment" data-id="${pathId(e.id)}">${field('Seu comentário','<textarea name="text" required maxlength="1000" rows="3"></textarea>')}${notice()}<button class="btn primary">Comentar</button></form>`:link('Entre para comentar',returnURL) }`):''}</div>`;
}
function listRow(c,l) {
  const u=c.user(l.userId), count=l.items?.length||0, first=l.items?.length?c.album(l.items[0].albumId):null;
  return `<article class="sc-list-row"><a class="sc-list-title" href="${listURL(l)}">${first?`<span class="sc-thumb">${c.cover(first)}</span>`:'<span class="sc-list-symbol" aria-hidden="true">≡</span>'}<span><strong>${c.esc(l.title)}</strong><small>${count} ${count===1?'obra':'obras'}${l.visibility==='private'?' · Privada':''}</small></span></a>
    ${u?`<a class="sc-list-by" href="${profileURL(u)}">@${c.esc(u.username)}</a>`:''}</article>`;
}
function listStream(c,lists,action=''){
  return lists.length?`<div class="sc-list-stream">${lists.map(l=>listRow(c,l)).join('')}</div>`:empty('Ainda não há listas aqui.','',action);
}
function listEditor(c,list=null) {
  if(!c.s.user) return restricted(c,'Criar lista','Junte discos e faixas em uma seleção sua.');
  if(list && !own(c,list.userId)) return unavailable(c,'Editar lista');
  const options=c.s.albums.map(a=>option(c,a.id,`${a.title} · ${a.artist}`,'')).join('');
  return `<div class="sc-reading">${heading(c,list?'Editar lista':'Criar lista')}<form class="sc-form" data-sc-form="list" data-id="${pathId(list?.id||'')}">
    ${field('Título',`<input name="title" required minlength="1" maxlength="120" value="${c.esc(list?.title||'')}">`)}
    ${field('Descrição',`<textarea name="description" maxlength="1200" rows="3">${c.esc(list?.description||'')}</textarea>`)}
    ${field('Visibilidade',select('visibility',option(c,'public','Pública',list?.visibility)+option(c,'private','Privada',list?.visibility)))}
    <fieldset class="sc-fieldset"><legend>Obras da lista</legend><div class="sc-filter-grid">${field('Disco',select('albumChoice',option(c,'','Escolha um disco','')+options))}${field('Faixa',select('trackChoice','<option value="">Disco completo</option>'))}</div>
    ${btn('Adicionar à lista','addItem')}<ol class="sc-ordered" data-sc-items></ol></fieldset>
    ${notice()}<div class="sc-actions"><button class="btn primary">Salvar lista</button>${link('Cancelar',list?listURL(list):'/listas')}</div></form></div>`;
}
function listsPage(c) {
  const q=search();
  if(q.get('nova')==='1') return listEditor(c);
  const mine=q.get('aba')==='minhas';
  const nav=`<nav class="sc-tabs" aria-label="Listas"><a href="/listas" ${!mine?'aria-current="page"':''}>Da comunidade</a><a href="/listas?aba=minhas" ${mine?'aria-current="page"':''}>Minhas listas</a></nav>`;
  const rows=c.s.lists.filter(l=>mine?own(c,l.userId):l.visibility==='public');
  return heading(c,'Listas','Discos e faixas reunidos por quem escuta.',link('Criar lista','/listas?nova=1',true))+nav+(mine&&!c.s.user?empty('Entre para ver suas listas.','',link('Entrar','/entrar?voltar=%2Flistas%3Faba%3Dminhas')):listStream(c,rows,link('Criar lista','/listas?nova=1')));
}
function listDetail(c,id) {
  const list=byId(c.s.lists,id);
  if(!list) return unavailable(c,'Lista');
  if(search().get('editar')==='1') return listEditor(c,list);
  const owner=c.user(list.userId), mine=own(c,list.userId);
  const actions=link('Criar arte','/estudio?lista='+pathId(list.id))+(list.visibility==='public'?btn('Compartilhar link','share','',`data-url="${listURL(list)}"`):'')+(mine?link('Editar lista',listURL(list)+'?editar=1')+btn('Excluir lista','deleteList',id):btn('Denunciar','report',id,'data-target="list"'));
  return `<div class="sc-reading"><a class="sc-back" href="/listas">← Listas</a>${heading(c,list.title,list.description)}
    <div class="sc-entry-meta">${owner?`<a class="sc-author" href="${profileURL(owner)}">${photo(c,owner)}${c.esc(owner.name)}</a>`:''}<span>${list.visibility==='private'?'Privada':'Pública'} · ${list.items.length} obras</span></div>
    <div class="sc-actions sc-list-actions">${actions}</div>${list.items.length?`<ol class="sc-ordered">${list.items.map((item,i)=>{
      const {album,track,title}=detail(c,item);
      return album ? `<li><span class="sc-rank">${i+1}</span><a class="sc-library-item" href="${releaseURL(album,track)}"><span class="sc-thumb">${c.cover(album)}</span><span><strong>${c.esc(title)}</strong><small>${c.esc(album.artist)} · ${track?'Faixa':'Disco'}</small></span></a></li>`:'';
    }).join('')}</ol>`:empty('Esta lista está vazia.','',mine?link('Adicionar obras',listURL(list)+'?editar=1'):'' )}</div>`;
}
function ranking(c) {
  const q=search(), tracks=q.get('tipo')==='faixas';
  const keys=new Map();
  for(const e of publicEntries(c)){
    if(!e.rating||Boolean(e.trackId)!==tracks) continue;
    keys.set(JSON.stringify([e.albumId,e.trackId||null]),{albumId:e.albumId,trackId:e.trackId||null});
  }
  const ranked=[...keys.values()].map(item=>({...detail(c,item),score:c.avg(item.albumId,item.trackId)})).filter(row=>row.score.count&&row.album).sort((a,b)=>b.score.mean-a.score.mean||b.score.count-a.score.count||a.title.localeCompare(b.title,'pt-BR'));
  return heading(c,'Rankings','A nota pública mais recente de cada ouvinte compõe a média de cada obra.')+
    `<nav class="sc-tabs" aria-label="Tipo de ranking"><a href="/rankings" ${!tracks?'aria-current="page"':''}>Discos</a><a href="/rankings?tipo=faixas" ${tracks?'aria-current="page"':''}>Faixas</a></nav>`+
    (ranked.length?`<ol class="sc-ordered">${ranked.map((row,i)=>`<li><span class="sc-rank">${i+1}</span><a class="sc-library-item" href="${releaseURL(row.album,row.track)}"><span class="sc-thumb">${c.cover(row.album)}</span><span><strong>${c.esc(row.title)}</strong><small>${c.esc(row.album.artist)}</small></span></a><span class="sc-ranking-note"><b>★ ${rate(row.score.mean)}</b><small>${row.score.count} ${row.score.count===1?'voto':'votos'}</small></span></li>`).join('')}</ol>`:empty('O ranking começa com a primeira nota pública.','',link('Escolher um disco','/explorar')));
}
function counts(items) {
  const tally=new Map();
  for(const key of items.filter(Boolean)) tally.set(key,(tally.get(key)||0)+1);
  return [...tally].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]),'pt-BR'));
}
function stats(c) {
  if(!c.s.user) return restricted(c,'Estatísticas','Acompanhe os discos, artistas e gêneros que voltam ao seu diário.');
  const filter=search(), period=filter.get('periodo')||'total', all=personal(c), now=new Date();
  const month=filter.get('mes')||`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`, year=filter.get('ano')||String(now.getFullYear());
  const entries=all.filter(e=>period==='total'||e.date.startsWith(period==='mes'?month:year)), albums=entries.map(e=>c.album(e.albumId)).filter(Boolean);
  const genres=counts(albums.flatMap(genresOf)), artists=counts(albums.map(a=>a.artist)), discs=counts(entries.map(e=>e.albumId));
  const ratings=entries.filter(e=>Number(e.rating)>0);
  const metric=(value,label)=>`<div><b>${value}</b><span>${label}</span></div>`;
  const bars=rows=>`<ul class="sc-bars">${rows.slice(0,6).map(([name,n])=>`<li><span>${c.esc(name)}</span><b>${n}</b><meter max="${rows[0][1]}" value="${n}" aria-label="${c.esc(name)}"></meter></li>`).join('')}</ul>`;
  const interested=new Set(all.filter(e=>Number(e.rating)>=4).flatMap(e=>genresOf(c.album(e.albumId))));
  const heard=new Set(all.map(e=>e.albumId)), recommendations=c.s.albums.filter(a=>!heard.has(a.id)).map(a=>({a,n:genresOf(a).filter(g=>interested.has(g)).length})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n).slice(0,4).map(x=>x.a);
  return heading(c,'Estatísticas','O que suas escutas contam sobre o seu gosto.')+`<form class="sc-period" data-sc-form="filter">${field('Período',select('periodo',option(c,'total','Todo o diário',period)+option(c,'mes','Um mês',period)+option(c,'ano','Um ano',period)))}${field('Mês',`<input type="month" name="mes" value="${c.esc(month)}">`)}${field('Ano',`<input type="number" min="1000" max="9999" name="ano" value="${c.esc(year)}">`)}<button class="btn">Atualizar</button></form>`+
    (entries.length?`<div class="sc-metrics">${metric(entries.length,'escutas')+metric(discs.length,'discos')+metric(artists.length,'artistas')+metric(ratings.length?rate(ratings.reduce((sum,e)=>sum+Number(e.rating),0)/ratings.length):'—','nota média')}</div>
    <div class="sc-two">${part('Artistas mais ouvidos',bars(artists))+part('Perfil de gosto',genres.length?bars(genres):empty('Os discos deste período ainda não têm gêneros identificados.'))}</div>
    ${part('Discos mais ouvidos',`<div class="sc-albums">${discs.slice(0,4).map(([id])=>c.album(id)).filter(Boolean).map(c.card).join('')}</div>`)}
    <div class="sc-actions">${link('Retrospectiva mensal','/estudio?modelo=mensal&mes='+pathId(month))}${link('Retrospectiva anual','/estudio?modelo=anual&ano='+pathId(year))}</div>`:empty('Nenhuma escuta neste período.','',link('Abrir o diário','/diario'))) +
    (recommendations.length?part('Para o seu gosto',`<p class="muted">Discos ainda fora do seu diário com gêneros que você avaliou com quatro estrelas ou mais.</p><div class="sc-albums">${recommendations.map(c.card).join('')}</div>`):'');
}


function battle(c) {
  if(c.s.albums.length<2) return heading(c,'Batalha de discos')+empty('São necessários dois discos no catálogo.');
  const q=search(), albums=c.s.albums, previous=c.s.battles||[], i=previous.length%albums.length;
  const a=c.album(q.get('a')) || albums[i];
  const b=(q.get('b')!==a.id && c.album(q.get('b'))) || albums.find((album,n)=>n>=i+1&&!same(album.id,a.id)) || albums.find(album=>!same(a.id,album.id));
  const choices=selected=>albums.map(d=>option(c,d.id,d.title+' · '+d.artist,selected)).join('');
  const card=d=>`<article class="sc-contender"><a href="${releaseURL(d)}">${c.cover(d)}<h2>${c.esc(d.title)}</h2></a><p>${c.esc(d.artist)}</p>
    ${btn('Escolher este disco','vote',d.id,`data-a="${pathId(a.id)}" data-b="${pathId(b.id)}" aria-label="Escolher ${c.esc(d.title)}"`)}</article>`;
  return heading(c,'Batalha de discos','Qual dos dois você levaria para casa?') + `<div class="sc-battle">${card(a)}<span class="sc-versus" aria-hidden="true">×</span>${card(b)}</div>
    <details class="sc-filters"><summary>Escolher outro par</summary><form class="sc-period" data-sc-form="pair">${field('Primeiro disco',select('a',choices(a.id)))}${field('Segundo disco',select('b',choices(b.id)))}${notice()}<button class="btn">Comparar</button></form></details>` +
    (previous.length?part('Suas escolhas',`<ol class="sc-ordered">${[...previous].sort((x,y)=>String(y.createdAt).localeCompare(String(x.createdAt))).slice(0,12).map(v=>{
      const winner=c.album(v.winner), other=c.album(same(v.winner,v.albumA)?v.albumB:v.albumA);
      return winner&&other?`<li><span><strong>${c.esc(winner.title)}</strong><small>Escolhido ao lado de ${c.esc(other.title)}</small></span></li>`:'';
    }).join('')}</ol>`):'');
}
function favoriteSelectors(c,u,key,choices,number,label) {
  return `<fieldset class="sc-fieldset"><legend>${label}</legend><div class="sc-filter-grid">${Array.from({length:number},(_,i)=>field((key==='albums'?'Disco ':'Artista ')+(i+1),select(key,option(c,'','Escolher',(u[key==='albums'?'favoriteAlbums':'favoriteArtists']||[])[i])+choices.map(([id,name])=>option(c,id,name,(u[key==='albums'?'favoriteAlbums':'favoriteArtists']||[])[i])).join('')))).join('')}</div></fieldset>`;
}
function artistsOf(album){return album.artists?.length ? album.artists : [{id:album.artistId,name:album.artist}];}
function genresOf(album){return album?.genres?.length ? album.genres : album?.genre ? [album.genre] : [];}
function settings(c) {
  const u=c.s.user;
  if(!u) return restricted(c,'Configurações','Entre para editar suas informações ou gerenciar sua conta.');
  const albums=c.s.albums.map(a=>[a.id,a.title+' · '+a.artist]);
  const artists=[...new Map(c.s.albums.flatMap(a=>artistsOf(a).map(artist=>[artist.id,artist.name]))).entries()];
  const blocked=c.s.blocked||[];
  return `<div class="sc-reading">${heading(c,'Configurações','Escolha como seu perfil aparece para outros ouvintes.')}<form class="sc-form" data-sc-form="settings">
    <div class="sc-photo-edit">${photo(c,u,'large')}<div>${field('Foto de perfil','<input type="file" name="avatar" accept="image/png,image/jpeg,image/webp">')}<label class="sc-check"><input name="removeAvatar" type="checkbox"> Remover foto atual</label></div></div>
    ${field('Seu nome',`<input autocomplete="name" required maxlength="80" name="name" value="${c.esc(u.name)}">`)}
    ${field('Nome de usuário',`<input autocomplete="username" required minlength="3" maxlength="30" name="username" value="${c.esc(u.username)}">`)}
    ${field('Biografia',`<textarea rows="3" maxlength="500" name="bio">${c.esc(u.bio||'')}</textarea>`)}
    ${favoriteSelectors(c,u,'albums',albums,4,'Quatro discos favoritos')}
    ${favoriteSelectors(c,u,'artists',artists,4,'Artistas favoritos')}
    ${notice()}<button class="btn primary">Salvar perfil</button></form>
    ${part('Sessão',btn('Sair da conta','logout'))}
    ${blocked.length?part('Pessoas bloqueadas',`<ul class="sc-blocked">${blocked.map(id=>`<li><span>${c.esc(byId(c.s.blockedPeople,id)?.name||'Perfil bloqueado')}</span>${btn('Desbloquear','unblock',id)}</li>`).join('')}</ul>`):''}
    <details class="sc-filters sc-danger"><summary>Excluir conta e dados</summary><p>Seu perfil, registros e listas serão excluídos definitivamente.</p><form data-sc-form="deleteAccount" class="sc-form">${field('Confirme sua senha','<input required type="password" autocomplete="current-password" name="password">')}${notice()}<button class="btn">Excluir minha conta</button></form></details></div>`;
}

const routes={
  entrar:c=>authPage(c,false),cadastro:c=>authPage(c,true),diario:diary,
  perfil:(c,id)=>profile(c,id),'meu-perfil':c=>profile(c),comunidade:community,avaliacao:entryView,
  listas:listsPage,lista:listDetail,rankings:ranking,estatisticas:stats,batalha:battle,configuracoes:settings
};
export async function socialPage(c,parts){
  if(!Object.hasOwn(routes,parts[0])) return null;
  return `<div class="wrap inner sc-page">${routes[parts[0]](c,parts[1])}</div>`;
}

function formError(form,message){
  const el=form.querySelector('.sc-error');
  if(el){ el.textContent=message; el.hidden=!message; }
}
function listItemsHTML(c,items){
  return items.map((item,i)=>{
    const {title,album,track}=detail(c,item);
    return `<li><span class="sc-rank">${i+1}</span><span class="sc-item-text"><strong>${c.esc(title)}</strong><small>${c.esc(album?.artist||'')} · ${track?'Faixa':'Disco'}</small></span><div class="sc-actions sc-item-buttons">
    ${btn('↑','moveUp',i,`aria-label="Subir ${c.esc(title)}" ${i===0?'disabled':''}`)}
    ${btn('↓','moveDown',i,`aria-label="Descer ${c.esc(title)}" ${i===items.length-1?'disabled':''}`)}
    ${btn('×','removeItem',i,`aria-label="Remover ${c.esc(title)}"`)}</div></li>`;
  }).join('');
}
function interactionDialog(root,title,body,prompt='Confirmar',reason=false){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');
    dialog.className='sc-dialog'; dialog.setAttribute('aria-labelledby','sc-dialog-heading');
    dialog.innerHTML=`<form method="dialog" class="sc-form"><h2 id="sc-dialog-heading"></h2><p></p>${reason?field('Motivo','<textarea name="reason" rows="4" required minlength="3" maxlength="600"></textarea>'):''}<div class="sc-actions"><button class="btn" type="button" data-cancel>Cancelar</button><button class="btn primary"></button></div></form>`;
    dialog.querySelector('h2').textContent=title;dialog.querySelector('p').textContent=body;dialog.querySelector('button.primary').textContent=prompt;
    dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    const form=dialog.querySelector('form');let result=null;
    form.onsubmit=e=>{e.preventDefault();result=reason?form.elements.reason.value.trim():true;dialog.close();};
    dialog.onclose=()=>{dialog.remove();resolve(result);};
    root.append(dialog);dialog.showModal();(reason?form.elements.reason:dialog.querySelector('[data-cancel]')).focus();
  });
}
async function prepareAvatar(file){
  if(file.size>12*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Escolha uma foto PNG, JPEG ou WebP de até 12 MB.');
  const source=URL.createObjectURL(file), img=new Image();
  try{
    img.src=source; await img.decode();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=192;
    const ctx=canvas.getContext('2d'),size=Math.min(img.naturalWidth,img.naturalHeight);
    ctx.drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,192,192);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(source); }
}
export function bindSocial(c,parts){
  const root=document.querySelector('#page .sc-page');
  if(!root || !Object.hasOwn(routes,parts[0])) return;
  const editor=root.querySelector('[data-sc-form="list"]');
  const items=(byId(c.s.lists,parts[1])?.items||[]).map(item=>({...item}));
  const drawItems=()=>{ if(editor) editor.querySelector('[data-sc-items]').innerHTML=listItemsHTML(c,items); };
  if(editor){
    drawItems(); editor.elements.albumChoice.onchange=()=>{
      const album=c.album(editor.elements.albumChoice.value);
      editor.elements.trackChoice.innerHTML='<option value="">Disco completo</option>'+(album?.tracks||[]).map((t,i)=>option(c,t.id,`${i+1}. ${t.title}`,'')).join('');
    };
  }
  async function updated(message,where){
    await c.refresh();
    if(message) c.toast(message);
    if(where) await c.go(where);else await c.render();
  }
  root.addEventListener('click',async ev=>{
    const control=ev.target.closest('[data-sc-action]');
    if(!control||control.disabled) return;
    const act=control.dataset.scAction,id=decodeURIComponent(control.dataset.id||'');
    control.disabled=true;
    try{
      if(act==='share'){
        const url=new URL(control.dataset.url,location.origin).href;
        if(navigator.share){try{await navigator.share({url});}catch(e){if(e.name!=='AbortError') throw e;} }
        else if(navigator.clipboard){await navigator.clipboard.writeText(url);c.toast('Link copiado.');}
        else {await interactionDialog(root,'Link de compartilhamento',url,'Concluir');}
        return;
      }
      if(act==='shareEntry'){openShareDestinations(id);return;}
      if(!c.requireUser()) return;
      if(act==='review'){c.review();return;}
      if(act==='editEntry'){const e=byId(c.s.entries,id);if(e)c.review(e.albumId,e.trackId,e.id);return;}
      if(['addItem','removeItem','moveUp','moveDown'].includes(act) && editor){
        formError(editor,'');
        if(act==='addItem'){
          const albumId=editor.elements.albumChoice.value, trackId=editor.elements.trackChoice.value||null;
          if(!albumId) throw new Error('Escolha um disco para adicionar à lista.');
          if(items.some(i=>same(i.albumId,albumId)&&(i.trackId||null)===trackId)) throw new Error('Esta obra já está na lista.');
          items.push({albumId,trackId});
        }else{
          const pos=Number(id);
          if(act==='removeItem') items.splice(pos,1);
          else {const next=act==='moveUp'?pos-1:pos+1;if(next>=0 && next<items.length) [items[pos],items[next]]=[items[next],items[pos]];}
        }
        drawItems();return;
      }
      if(act==='like'){await c.api('/entries/'+pathId(id)+'/like','POST',{});await updated();return;}
      if(act==='follow'){await c.api('/people/'+pathId(id)+'/follow','POST',{active:!has(c.s.following,id)});await updated();return;}
      if(act==='block'||act==='unblock'){
        if(act==='block'&&!(await interactionDialog(root,'Bloquear perfil','As interações e os registros deste perfil ficarão ocultos para você.','Bloquear')))return;
        await c.api('/people/'+pathId(id)+'/block','POST',{active:act==='block'});await updated(act==='block'?'Perfil bloqueado.':'Perfil desbloqueado.',act==='block'?'/comunidade?aba=pessoas':null);return;
      }
      if(act==='report'){
        const reason=await interactionDialog(root,'Denunciar conteúdo','Descreva o problema para a equipe de moderação.','Enviar denúncia',true);
        if(reason){await c.api('/reports','POST',{targetType:control.dataset.target,targetId:id,reason});c.toast('Denúncia recebida.');}return;
      }
      if(act==='deleteEntry'||act==='deleteList'){
        const list=act==='deleteList';
        if(!(await interactionDialog(root,list?'Excluir lista':'Excluir registro','A exclusão é permanente.','Excluir')))return;
        await c.api('/'+(list?'lists':'entries')+'/'+pathId(id),'DELETE');await updated(list?'Lista excluída.':'Registro excluído.',list?'/listas?aba=minhas':'/diario');return;
      }
      if(act==='vote'){await c.api('/battles','POST',{albumA:decodeURIComponent(control.dataset.a),albumB:decodeURIComponent(control.dataset.b),winner:id});await updated('Escolha registrada.','/batalha');return;}
      if(act==='logout'){await c.api('/auth/logout','POST',{});await updated('Você saiu da conta.','/');}
    }catch(e){ if(editor) formError(editor,e.message);else c.toast(e.message||'Não foi possível concluir.'); }
    finally{control.disabled=false;}
  });
  root.addEventListener('submit',async ev=>{
    const form=ev.target.closest('[data-sc-form]');if(!form)return;
    ev.preventDefault();if(form.dataset.sending)return;
    const type=form.dataset.scForm, data=new FormData(form), values=Object.fromEntries(data), id=decodeURIComponent(form.dataset.id||'');
    const submit=ev.submitter;form.dataset.sending='1';if(submit)submit.disabled=true;formError(form,'');
    try{
      if(type==='filter'||type==='pair'){
        if(type==='pair'&&values.a===values.b)throw new Error('Escolha dois discos diferentes.');
        const params=new URLSearchParams();
        for(const [k,v] of data)if(v)params.set(k,v);
        await c.go(location.pathname+(params.size?'?'+params:''));return;
      }
      if(type==='login'||type==='register'){
        const back=dest();await c.api('/auth/'+type,'POST',values);await updated(type==='register'?'Conta criada.':'Você entrou.',back);return;
      }
      if(!c.requireUser())return;
      if(type==='comment'){await c.api('/entries/'+pathId(id)+'/comments','POST',{text:values.text});await updated('Comentário publicado.');return;}
      if(type==='list'){
        const payload={title:values.title,description:values.description,visibility:values.visibility,items};
        const res=await c.api(id?'/lists/'+pathId(id):'/lists',id?'PATCH':'POST',payload);
        await updated('Lista salva.',listURL(res.list));return;
      }
      if(type==='settings'){
        const favorites=key=>data.getAll(key).filter(Boolean), favoriteAlbums=favorites('albums'),favoriteArtists=favorites('artists');
        if(new Set(favoriteAlbums).size!==favoriteAlbums.length||new Set(favoriteArtists).size!==favoriteArtists.length)throw new Error('Cada favorito deve aparecer uma única vez.');
        const patch={name:values.name,username:values.username,bio:values.bio,favoriteAlbums,favoriteArtists};
        if(values.removeAvatar)patch.avatar='';else if(values.avatar?.size)patch.avatar=await prepareAvatar(values.avatar);
        await c.api('/account','PATCH',patch);await updated('Perfil atualizado.','/meu-perfil');return;
      }
      if(type==='deleteAccount'){
        if(!(await interactionDialog(root,'Excluir sua conta','Todos os registros desta conta serão removidos.','Excluir definitivamente')))return;
        await c.api('/account','DELETE',{password:values.password});await updated('Conta excluída.','/');
      }
    }catch(e){formError(form,e.message||'Não foi possível salvar.');}
    finally{delete form.dataset.sending;if(submit)submit.disabled=false;}
  });
}

