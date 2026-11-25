import {esc, icon, normalize, cover, ratingBlock, nota, safeImage} from './ui.js';
import {temaDoAlbum} from './identidades.js';

const albumUrl=a=>(a.id?.startsWith('mbg-')?'/lancamento/':'/album/')+encodeURIComponent(a.id);
const trackUrl=(a,t)=>'/musica/'+encodeURIComponent(a.id)+'/'+encodeURIComponent(t.id);
const dateLabel=date=>date?.length===10?new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'}):date;
const duration=d=>d?Math.floor(d/60)+':'+String(Math.round(d%60)).padStart(2,'0'):'—';
const artistLinks=a=>(a.artists?.length?a.artists:[{id:a.artistId,name:a.artist}]).map(p=>`<a href="/artista/${encodeURIComponent(p.id)}">${esc(p.name)}</a>`).join(' &amp; ');
let featureIndex=0;
let shelfType='Todos';
const sizeOfId=id=>encodeURIComponent(id);
export function card(a) {
  return `<article class="album-card"><a class="card-link" href="${albumUrl(a)}">${cover(a)}<h3>${esc(a.title)}</h3></a><div class="card-meta"><a href="/artista/${sizeOfId(a.artistId)}">${esc(a.artist)}</a><span>${esc(a.year)}</span></div></article>`;
}
function sectionHead(title,href,label) {
  return `<div class="section-head"><h2>${title}</h2>${href?`<a class="text-link" href="${href}">${label} ${icon('arrow',16)}</a>`:''}</div>`;
}
function feature(ctx) {
  const all=ctx.s.albums;
  const first=all.find(a=>normalize(a.title)==='clube da esquina')||all[0];
  if (!first) return '';
  const slides=[first,...all.filter(a=>a.id!==first.id && a.cover && a.cover.startsWith('/assets/')).slice(0,2)];
  const index=featureIndex%slides.length;
  const a=slides[index], isClube=normalize(a.title)==='clube da esquina';
  const original=isClube?`<div class="hero-sleeve"><span>Milton Nascimento<br>&amp; Lô Borges</span><strong>Clube da<br>Esquina</strong><small>Encarte da curadoria</small></div>`:cover(a,'hero-official');
  return `<section class="feature ${isClube?'minas':'alternate'}" aria-label="Disco em foco">
    <div class="feature-photo" aria-hidden="true"></div>
    <div class="feature-copy"><div class="eyebrow"><span class="live-dot"></span> Disco em foco</div>
    <h2>${isClube?'Clube da<br>Esquina':esc(a.title)}</h2><p class="feature-artist">${esc(isClube?'Milton Nascimento & Lô Borges':a.artist)}</p>
    <p class="feature-meta">${esc(a.year)}<i></i>${esc(a.genre||a.type)}<i></i>${a.tracks.length} faixas</p>
    <a class="btn feature-btn" href="${albumUrl(a)}">${icon('disc',17)} Explorar ${a.type==='Single'?'single':'álbum'} ${icon('arrow',16)}</a></div>
    <div class="feature-object" aria-hidden="true"><div class="vinyl"><i></i></div>${original}</div>
    ${slides.length>1?`<div class="slider-controls" aria-label="Escolha de destaque"><button class="round" data-slide="-1" aria-label="Destaque anterior">${icon('left',16)}</button><span>${String(index+1).padStart(2,'0')} <em>/</em> ${String(slides.length).padStart(2,'0')}</span><button class="round" data-slide="1" aria-label="Próximo destaque">${icon('right',16)}</button></div>`:''}
  </section>`;
}
function home(ctx) {
  const albums=ctx.s.albums;
  const hasLocal=a=>a.cover?.startsWith('/assets/');
  const sorted=[...albums.filter(hasLocal),...albums.filter(a=>!hasLocal(a))];
  const types=['Todos',...['Álbum','EP','Single'].filter(t=>albums.some(a=>a.type===t))];
  const labels={Todos:'Todos','Álbum':'Álbuns',EP:'EPs',Single:'Singles'};
  const featured=sorted.filter(a=>shelfType==='Todos'||a.type===shelfType).slice(0,5);
  return `<div class="wrap discovery"><div class="heading-row"><h1>Descobrir</h1><a href="/explorar" class="text-link catalog-shortcut" aria-label="Catálogo completo">${icon('layers',16)} Catálogo completo ${icon('external',15)}</a></div>
  ${feature(ctx)}
  <section class="shelf">${sectionHead('Na estante','/explorar','Ver tudo')}<div class="shelf-filters"><span class="shelf-caption">Seleção da curadoria</span><div class="pills">${types.map(t=>`<button data-shelf="${t}" class="pill ${shelfType===t?'selected':''}" aria-pressed="${shelfType===t}">${labels[t]}</button>`).join('')}</div></div>
  <div class="card-grid">${featured.map(card).join('')}</div></section>
  <section class="home-destinations">${[['studio','Estúdio de capas','Transforme sua avaliação em uma arte para compartilhar.','/estudio'],['book','Diário musical','Revisite os discos e as faixas que você registrou.','/diario'],['users','Comunidade','Encontre ouvintes e leia as críticas mais recentes.','/comunidade']].map(x=>`<a class="destination" href="${x[3]}">${icon(x[0],23)}<div><h3>${x[1]}</h3><p>${x[2]}</p></div>${icon('right',16)}</a>`).join('')}</section></div>`;
}
function pageNavigator(p,total,page,base='/explorar',per=24){
  const pages=Math.max(1,Math.ceil(total/per));if(pages<=1)return '';
  const href=n=>{const q=new URLSearchParams(p);q.set('page',n);return base+'?'+esc(q.toString());};
  return '<nav class="page-nav" aria-label="Paginação">'+(page>1?'<a class="btn" href="'+href(page-1)+'">Página anterior</a>':'')+'<span>Página '+page+' de '+pages+'</span>'+(page<pages?'<a class="btn" href="'+href(page+1)+'">Próxima página</a>':'')+'</nav>';
}
function params(p,k,v){const n=new URLSearchParams(p);n.set(k,v);n.delete('page');return '/explorar?'+esc(n.toString());}
const trackResultUrl=t=>t.albumId?'/musica/'+encodeURIComponent(t.albumId)+'/'+encodeURIComponent(t.id):'/gravacao/'+encodeURIComponent(t.mbid)+(t.releaseId?'?edicao='+encodeURIComponent(t.releaseId):'');
function musicResults(items,cat){
  if(cat==='Artistas')return '<div class="people-grid">'+items.map(a=>'<a class="artist-tile" href="/artista/'+encodeURIComponent(a.id)+'"><div><h3>'+esc(a.title)+'</h3><small>'+esc([a.artistType==='Group'?'Banda ou grupo':a.artistType==='Person'?'Artista':'Artista',a.country,a.disambiguation].filter(Boolean).join(' · '))+'</small></div>'+icon('right',16)+'</a>').join('')+'</div>';
  if(cat==='Faixas')return '<div class="track-list">'+items.map(t=>'<a href="'+trackResultUrl(t)+'"><span>'+icon('music',16)+'</span><div><b>'+esc(t.title)+'</b><small>'+esc([t.artist,t.albumTitle,t.disambiguation].filter(Boolean).join(' · '))+'</small></div><time>'+duration(t.duration)+'</time></a>').join('')+'</div>';
  return '<div class="card-grid">'+items.map(card).join('')+'</div>';
}
async function explore(ctx,path){
  const p=new URLSearchParams(location.search),term=p.get('q')||'';
  const cat=path==='artistas'?'Artistas':(['Discos','Artistas','Faixas'].includes(p.get('categoria'))?p.get('categoria'):'Discos');
  const genre=p.get('genero')||'',type=p.get('tipo')||'',year=p.get('ano')||'',page=Math.max(1,Number(p.get('page'))||1);
  const kind={Discos:'group',Artistas:'artist',Faixas:'track'}[cat];
  const select=(name,label,options,current)=>'<label>'+label+'<select name="'+name+'">'+options.map(([v,l])=>'<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>';
  let data,error='';
  try{data=await ctx.api('/catalog/discover?'+new URLSearchParams({q:term,kind,type,year,genre,page}));}
  catch(e){error=e.message;data={results:[],total:0};}
  const genres=['Pop','Rock','MPB','Sertanejo','Funk','Rap','Hip-hop','R&B','Eletrônica','Indie','Jazz','Música clássica','K-pop','Música latina'];
  return `<div class="wrap inner"><h1>Catálogo musical</h1><form id="catalog-form" class="search-panel">
    <label class="search-box">${icon('search')}<input type="search" aria-label="Pesquisar no catálogo" placeholder="Buscar discos, artistas e faixas" name="q" value="${esc(term)}" autocomplete="off"><button class="btn small" type="submit">Buscar</button></label>
    <div id="catalog-suggestions" aria-live="polite"></div><input name="categoria" type="hidden" value="${cat}">
    <div class="filter-row">${cat==='Discos'?select('tipo','Formato',[['','Todos os formatos'],...['Álbum','EP','Single','Compilação','Ao vivo','Outro'].map(t=>[t,t])],type):''}
    <label>Gênero<input name="genero" list="music-genres" value="${esc(genre)}" placeholder="Qualquer gênero"><datalist id="music-genres">${genres.map(g=>'<option value="'+g+'">').join('')}</datalist></label>
    ${cat!=='Artistas'?'<label>Ano<input name="ano" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="Qualquer ano" value="'+esc(year)+'"></label>':''}</div></form>
    <nav class="tabs" aria-label="Categorias de pesquisa">${['Discos','Artistas','Faixas'].map(c=>'<a class="'+(cat===c?'current':'')+'" href="'+params(p,'categoria',c)+'">'+c+'</a>').join('')}</nav>
    ${error?'<p role="alert">'+esc(error)+'</p>':''}
    ${data.unavailable?'<p role="status">A fonte externa está indisponível. Exibindo o que já está no acervo; tente a busca novamente em instantes.</p>':''}
    <p class="muted count-label">${data.total} resultados${data.local?' · acervo local':''}${data.stale?' · última consulta disponível':''}</p>
    ${data.results.length?musicResults(data.results,cat)+pageNavigator(p,data.total,page):'<div class="empty"><h2>Nenhum resultado</h2><p>Tente outro nome, gênero ou formato. A cobertura depende dos dados disponíveis na fonte.</p></div>'}
    <p class="credit">Dados musicais do <a href="https://musicbrainz.org" target="_blank" rel="noopener noreferrer">MusicBrainz</a>. Edições deluxe, remasterizações e relançamentos ficam na página do disco.</p></div>`;
}
function latestReviews(ctx,entries) {
  return entries.filter(e=>e.review).slice(0,6).map(e=>`<article class="review-line"><a class="text-link" href="/perfil/${sizeOfId(ctx.user(e.userId)?.username||'')}">${esc(ctx.user(e.userId)?.name||'Ouvinte')}</a> ${e.rating?`<b class="score">★ ${esc(e.rating.toLocaleString('pt-BR'))}</b>`:''}<p>${esc(e.review)}</p><a href="/avaliacao/${sizeOfId(e.id)}" class="text-link">Abrir crítica ${icon('right',14)}</a></article>`).join('')||'<div class="empty">As críticas públicas deste disco aparecerão aqui.</div>';
}
export function notFound() {return '<div class="wrap inner empty"><h1>Página indisponível</h1><p>O endereço pode ter mudado ou o conteúdo pode ser privado.</p><a class="btn" href="/">Voltar a descobrir</a></div>'}
function identityBand(album) {
  if(!album)return '';
  const tema=temaDoAlbum(album);
  if(tema.nivel!==1)return '';
  const cores=tema.cores;
  return `<div class="identity-band" data-identidade="1" style="--identidade-fundo:${esc(cores.fundo)};--identidade-tinta:${esc(cores.tinta||'')};--identidade-destaque:${esc(cores.destaque||cores.fundo)}"><span class="kicker">${icon('star',15)} Identidade visual <b>${esc(tema.identidade.titulo)}</b> · ${esc(tema.rotulo)}</span><a class="btn small" href="/estudio?album=${encodeURIComponent(album.id)}">${icon('studio',15)} Usar no Estúdio</a></div>`;
}
function recordPage(ctx,album,track) {
  const a=album;
  const stats=ctx.avg(a.id,track?.id??null);
  const entries=ctx.s.entries.filter(e=>e.albumId===a.id&&(e.trackId||null)===(track?.id||null)&&e.visibility==='public');
  const lists=ctx.s.lists.filter(l=>l.visibility==='public'&&l.items.some(i=>i.albumId===a.id&&(!track||i.trackId===track.id)));
  const title=track?.title||a.title;
  const position=a.tracks.findIndex(t=>t.id===track?.id)+1;
  const me=ctx.s.user||{};
  const minhaEntrada=ctx.s.entries.find(e=>e.userId===me.id&&e.albumId===a.id&&(e.trackId||null)===(track?.id||null));
  const avaliado=minhaEntrada&&minhaEntrada.rating;
  const accao=avaliado?`<div class="row estado-avaliado"><span class="kicker">${icon('star',17)} Avaliado</span>${ratingBlock(minhaEntrada.rating,{label:'Sua avaliação'})}<button class="btn" data-review="${esc(a.id)}" data-track="${esc(track?.id||'')}" data-entry="${esc(minhaEntrada.id)}">Editar avaliação</button><a class="text-link" href="/avaliacao/${sizeOfId(minhaEntrada.id)}">Ver avaliação</a><a class="btn" href="/estudio?destino=instagram&entry=${encodeURIComponent(minhaEntrada.id)}">${icon('share',17)} Compartilhar nos Stories</a><button class="btn" data-remove-rating="${esc(minhaEntrada.id)}">Excluir avaliação</button></div>`:`<div class="row"><button class="btn primary" data-review="${esc(a.id)}" data-track="${esc(track?.id||'')}">${icon('plus',18)} Registrar escuta</button><a class="btn" href="/estudio?album=${sizeOfId(a.id)}">${icon('studio',17)} Criar arte</a></div>`;
  const fundo=safeImage(a.cover)?` style="--capa-fundo:url(${esc(JSON.stringify(a.cover))})"`:'';
  return `<div class="wrap inner"><a class="text-link breadcrumb" href="${track?albumUrl(a):'/explorar'}">${icon('left',14)} ${track?esc(a.title):'Catálogo musical'}</a>
  ${identityBand(a)}
  <section class="record-intro"${fundo}>${cover(a,'detail-cover')}<div class="record-info"><span class="kicker">${icon(track?'music':'disc',16)} ${esc(track?'Faixa '+position:a.type)}</span>
  <h1>${esc(title)}</h1><p class="artist-links">${artistLinks(a)}</p><p class="muted">${[dateLabel(a.date||String(a.year||'')),a.genre,track?duration(track.duration):a.tracks.length+' faixas'].filter(Boolean).map(esc).join(' · ')}</p>${accao}
  <div class="edition-control" ${a.groupId||a.releaseId||a.source?.includes('musicbrainz.org/release/')?'':'hidden'} data-album-id="${esc(a.id)}"><button class="btn" type="button" data-versions>Ver edições deste lançamento</button><div class="edition-results" aria-live="polite"></div></div>
  <p class="credit">${a.cover?`Imagem de referência${a.credit?' · '+esc(a.credit):''}`:'Ficha tipográfica da curadoria'} · <a href="${esc(a.source)}" target="_blank" rel="noopener noreferrer">Fonte da edição ${icon('external',12)}</a></p></div></section>
  <div class="record-columns"><div>${!track?`<section>${sectionHead('Faixas')}<div class="track-list">${a.tracks.map((t,i)=>`<div class="track-row"><a href="${trackUrl(a,t)}"><span>${String(i+1).padStart(2,'0')}</span><b>${esc(t.title)}</b><time>${duration(t.duration)}</time></a><button class="icon-btn" data-review="${esc(a.id)}" data-track="${esc(t.id)}" aria-label="Avaliar ${esc(t.title)}">${icon('star',16)}</button></div>`).join('')}</div></section>`:''}
  <section>${sectionHead('Críticas recentes')}${latestReviews(ctx,entries)}</section></div><aside><section class="panel"><h2>Notas da comunidade</h2>${stats.count?ratingBlock(Math.round(stats.mean*2)/2,{label:'Média da comunidade'}):'<strong class="big-score">—</strong>'}<p class="muted">${stats.count} ${stats.count===1?'avaliação pública':'avaliações públicas'}${stats.count?' · média '+esc(nota(stats.mean)):''}</p><div class="histogram">${Array.from({length:10},(_,i)=>{const score=(i+1)*0.5,n=stats.values.filter(v=>v===score).length;return `<div title="${score} estrelas, ${n} avaliações"><span>${n}</span><meter min="0" max="${Math.max(1,...Array.from({length:10},(_,j)=>stats.values.filter(v=>v===(j+1)*0.5).length))}" value="${n}" aria-label="${score} estrelas"></meter><small>${score.toLocaleString('pt-BR')}</small></div>`}).join('')}</div></section>
  <section class="panel"><h2>Em listas públicas</h2>${lists.length?lists.map(l=>`<p><a href="/lista/${sizeOfId(l.id)}">${esc(l.title)}</a></p>`).join(''):'<p class="muted">Ainda não há listas públicas com esta obra.</p>'}<a class="text-link" href="/listas">Explorar listas ${icon('arrow',15)}</a></section></aside></div></div>`;
}
async function artistPage(ctx,id){
  const page=Math.max(1,Number(new URLSearchParams(location.search).get('page'))||1);
  const external=/^mb-[a-f0-9-]{36}$/.test(id);
  let data;
  if(external)data=await ctx.api('/catalog/artists/'+encodeURIComponent(id.slice(3))+'?page='+page);
  else{
    const albums=ctx.s.albums.filter(a=>a.artistId===id||a.artists?.some(x=>x.id===id));
    if(!albums.length)return notFound();
    data={artist:{name:albums[0].artists?.find(x=>x.id===id)?.name||albums[0].artist},sections:{albums},total:albums.length};
  }
  const a=data.artist,sections=data.sections||{};
  return '<div class="wrap inner"><a class="text-link breadcrumb" href="/artistas">Artistas</a>'+(!external?'<p><a class="btn" href="/explorar?categoria=Artistas&q='+encodeURIComponent(a.name||a.title)+'">Buscar discografia completa</a></p>':'')+'<section class="artist-intro"><h1>'+esc(a.name||a.title)+'</h1><p class="muted">'+esc([a.artistType==='Group'?'Banda ou grupo':'Artista',a.country,a.area,a.disambiguation].filter(Boolean).join(' · '))+'</p><p>'+data.total+' lançamentos encontrados</p></section>'+[['albums','Álbuns'],['eps','EPs'],['singles','Singles'],['compilations','Compilações'],['appearances','Participações'],['other','Outros lançamentos']].map(([key,label])=>sections[key]?.length?'<section class="shelf">'+sectionHead(label)+'<div class="card-grid">'+sections[key].map(card).join('')+'</div></section>':'').join('')+pageNavigator(new URLSearchParams(),data.total,page,'/artista/'+encodeURIComponent(id),100)+'</div>';
}
async function resolveAlbum(ctx,id){
  let album=ctx.album(id);
  if(album)return album;
  const group=id?.match(/^mbg-([a-f0-9-]{36})$/),release=id?.match(/^mb-([a-f0-9-]{36})$/);
  if(!group&&!release)return null;
  const data=await ctx.api('/catalog/'+(group?'groups/'+group[1]:'releases/'+release[1]));
  album=data.album;
  if(!ctx.album(album.id))ctx.s.albums.push(album);
  return album;
}
export async function discoverPage(ctx,parts) {
  const [route,id,trackId]=parts;
  if(route==='boas-vindas'){
    const choices=ctx.s.albums.filter(a=>a.cover?.startsWith('/assets/')).slice(0,4);
    return `<div class="wrap inner welcome"><section class="welcome-lead"><div><h1>Seu diário<br>de música.</h1><p>Registre o que ouviu, escreva sobre os discos que ficaram com você e leve suas críticas para o Instagram.</p><div class="row"><a class="btn primary" href="${ctx.s.user?'/diario':'/cadastro'}">${ctx.s.user?'Abrir meu diário':'Criar meu diário'} ${icon('arrow',17)}</a><a class="btn" href="/">Descobrir discos</a></div></div><div class="welcome-grid">${choices.map(a=>`<a href="${albumUrl(a)}" aria-label="${esc(a.title)}">${cover(a)}</a>`).join('')}</div></section>${sectionHead('Conheça o CAPA')}<div class="welcome-steps">${[['book','Diário musical','Guarde datas, notas e críticas. Registre outra escuta quando sua relação com o disco mudar.','/diario'],['layers','Listas','Reúna faixas e discos em uma seleção com um link próprio.','/listas'],['studio','Estúdio','Crie uma arte de avaliação, uma lista de favoritos ou uma retrospectiva para compartilhar.','/estudio']].map(([g,t,desc,href])=>`<a href="${href}">${icon(g,22)}<h3>${t}</h3><p>${desc}</p></a>`).join('')}</div></div>`;
  }
  if (!route||route==='inicio'||route==='descobrir') return home(ctx);
  if(route==='explorar'||route==='artistas') return await explore(ctx,route);
  if(route==='artista') return await artistPage(ctx,id);
  if(route==='gravacao'){
    const release=new URLSearchParams(location.search).get('edicao');
    const data=await ctx.api('/catalog/recordings/'+encodeURIComponent(id)+(release?'?releaseId='+encodeURIComponent(release):''));
    if(!ctx.album(data.album.id))ctx.s.albums.push(data.album);
    history.replaceState(null,'',trackUrl(data.album,{id:data.trackId}));
    return recordPage(ctx,data.album,data.album.tracks.find(t=>t.id===data.trackId));
  }
  if(route==='album'||route==='musica'||route==='lancamento'){
    const a=await resolveAlbum(ctx,id), t=a?.tracks.find(t=>t.id===trackId);
    if(a&&route==='lancamento')history.replaceState(null,'',albumUrl(a));
    return !a||(route==='musica'&&!t)?notFound():recordPage(ctx,a,route==='musica'?t:null);
  }
  if(route==='creditos') return `<div class="wrap inner prose"><span class="kicker">CAPA</span><h1>Créditos</h1><h2>Fotografia editorial</h2><p>A paisagem do destaque é <a href="https://commons.wikimedia.org/wiki/File:Serra_da_Mantiqueira_MG.jpg">Serra da Mantiqueira MG</a>, de Angelica Khazen. A fotografia e sua interpretação cromática são distribuídas sob <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. O encarte da curadoria combina essa paisagem com tipografia original.</p><h2>Catálogo e capas</h2>${ctx.s.albums.map(a=>`<p><b>${esc(a.title)}</b> · ${esc(a.artist)}. ${esc(a.credit||'')} ${esc(a.license||'')} <a href="${esc(a.coverSource||a.source)}" rel="noopener noreferrer">Consultar origem</a>.</p>`).join('')}<h2>Tipografia</h2><p>Bricolage Grotesque e Instrument Sans, distribuídas sob a SIL Open Font License. Licenças em <a href="/assets/fonts/BricolageGrotesque-OFL.txt">Bricolage Grotesque</a> e <a href="/assets/fonts/InstrumentSans-OFL.txt">Instrument Sans</a>.</p></div>`;
  return null;
}
export function bindDiscover(ctx) {
  const page=document.getElementById('page');
  const remove=page.querySelector('[data-remove-rating]');
  if(remove)remove.onclick=async()=>{
    if(!await ctx.confirm('Excluir avaliação','A sua nota e a crítica desta escuta serão removidas. Esta ação não pode ser desfeita.','Excluir'))return;
    remove.disabled=true;
    try{await ctx.api('/entries/'+encodeURIComponent(remove.dataset.removeRating),'DELETE');await ctx.refresh();ctx.toast('Avaliação excluída.');ctx.render()}
    catch(error){ctx.toast(error.message);remove.disabled=false}
  };
  page.querySelectorAll('[data-shelf]').forEach(b=>b.onclick=()=>{shelfType=b.dataset.shelf;ctx.render()});
  page.querySelectorAll('[data-slide]').forEach(b=>b.onclick=()=>{const n=1+ctx.s.albums.filter(a=>a!==ctx.s.albums[0]&&a.cover?.startsWith('/assets/')).slice(0,2).length;featureIndex=(featureIndex+Number(b.dataset.slide)+n)%n;ctx.render()});
  const f=page.querySelector('#catalog-form');
  if(f){
    f.onsubmit=e=>{e.preventDefault();const p=new URLSearchParams(new FormData(f));for(const k of [...p.keys()])if(!p.get(k))p.delete(k);ctx.go('/explorar?'+p)};
    f.onchange=e=>{if(e.target.tagName==='SELECT')f.requestSubmit()};
    let timer,sequence=0;const input=f.elements.q,out=f.querySelector('#catalog-suggestions');
    input.oninput=()=>{clearTimeout(timer);const current=++sequence;out.replaceChildren();if(input.value.trim().length<3)return;
      timer=setTimeout(async()=>{try{const data=await ctx.api('/catalog/discover?'+new URLSearchParams({q:input.value.trim(),kind:({Discos:'group',Artistas:'artist',Faixas:'track'})[f.elements.categoria.value],page:1}));if(current!==sequence||!out.isConnected)return;
      out.innerHTML=data.results.slice(0,5).map(a=>'<a class="suggestion" href="'+(a.kind==='artist'?'/artista/'+encodeURIComponent(a.id):a.kind==='track'?trackResultUrl(a):albumUrl(a))+'">'+esc(a.title)+' <small>'+esc(a.artist)+'</small></a>').join('');}catch{}},650);};
  }
  const editions=page.querySelector('[data-versions]');
  if(editions){let number=1;editions.onclick=async()=>{
    const root=editions.closest('.edition-control'),out=root.querySelector('.edition-results'),album=ctx.album(root.dataset.albumId);editions.disabled=true;
    try{let groupId=album.groupId;const releaseId=album.releaseId||album.source?.match(/musicbrainz\.org\/release\/([a-f0-9-]{36})/)?.[1];
      if(!groupId&&releaseId){const data=await ctx.api('/catalog/releases/'+releaseId+'?enrich=1');groupId=data.album.groupId;album.groupId=groupId;}
      if(!groupId)throw new Error('A fonte ainda não relacionou este disco a outras edições.');
      const data=await ctx.api('/catalog/groups/'+groupId+'/versions?page='+number);
      out.insertAdjacentHTML('beforeend',(data.versions||[]).map(v=>'<a class="edition-row" href="/album/mb-'+encodeURIComponent(v.mbid)+'"><b>'+esc(v.title)+'</b><small>'+esc([v.disambiguation,v.date,v.country,v.format,v.trackCount&&v.trackCount+' faixas'].filter(Boolean).join(' · '))+'</small></a>').join('')||'<p>Nenhuma edição oficial disponível.</p>');
      if(data.next){number=data.next;editions.textContent='Carregar mais edições';}else editions.hidden=true;
    }catch(error){out.textContent=error.message;}finally{editions.disabled=false;}
  };}
  const remote=page.querySelector('#remote-search');
  if(remote)remote.onclick=async()=>{
    const out=page.querySelector('#remote-results');remote.disabled=true;out.textContent='Consultando o catálogo externo…';
    try{
      const data=await ctx.api('/catalog/search?q='+encodeURIComponent(new URLSearchParams(location.search).get('q')));
      out.innerHTML=data.results.length?data.results.map(r=>`<div class="remote-row"><div><b>${esc(r.title)}</b><small>${esc(r.artist)} · ${esc(r.year||'')}</small></div><button class="btn" data-import="${esc(r.mbid)}">Abrir edição</button></div>`).join(''):'Nenhuma edição encontrada.';
      out.querySelectorAll('[data-import]').forEach(b=>b.onclick=async()=>{if(!ctx.requireUser())return;b.disabled=true;try{const {album}=await ctx.api('/catalog/import/'+encodeURIComponent(b.dataset.import),'POST',{});await ctx.refresh();ctx.go(albumUrl(album))}catch(error){ctx.toast(error.message);b.disabled=false}});
    }catch(error){out.textContent=error.message}finally{remote.disabled=false}
  };
}
