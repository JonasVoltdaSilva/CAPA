import {brand, cover, esc, icon, ratingBlock} from './ui.js';
import {bindDiscover, card, discoverPage, notFound} from './discover.js';
import {socialPage, bindSocial} from './social.js';
import {carregarIdentidades, identidadeDoAlbum, temaDoAlbum} from './identidades.js';

const page=document.querySelector('#page'), dialog=document.querySelector('#dialog');
let toastTimer, generation=0;
const ctx={s:null,esc,icon,cover,card,api,refresh,go,render,review,requireUser,toast,confirm:confirmAction,avg,album:id=>ctx.s.albums.find(a=>a.id===id),user:id=>ctx.s.people.find(p=>p.id===id),identidade:id=>identidadeDoAlbum(id),temaDoAlbum};
async function confirmAction(title,text,button){
  return new Promise(resolve=>{
    popup(title,`<p>${esc(text)}</p><div class="row"><button class="btn danger" id="confirm-yes" type="button">${esc(button)}</button><button class="btn" id="confirm-no" type="button">Cancelar</button></div>`);
    const done=value=>{dialog.removeEventListener('close',closed);dialog.close();resolve(value)},closed=()=>resolve(false);
    dialog.querySelector('#confirm-yes').onclick=()=>done(true);
    dialog.querySelector('#confirm-no').onclick=()=>done(false);
    dialog.addEventListener('close',closed);
    dialog.querySelector('#confirm-no').focus();
  });
}
async function api(path,method='GET',body) {
  let response;
  try {
    response=await fetch('/api'+path,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body||{})});
  } catch {throw new Error('Sem conexão com o CAPA. Tente novamente.')}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'O servidor não conseguiu concluir esta ação.');
  return data;
}
async function refresh(){
  const next=await api('/bootstrap');
  next.albums.forEach(a=>{a.genres??=a.genre?[a.genre]:[]});
  ctx.s=next;
  ratingsByWork.clear();
  const peopleByWork=new Map();
  for(const e of next.entries){
    if(e.visibility!=='public'||e.rating==null)continue;
    const key=workKey(e.albumId,e.trackId);
    if(!peopleByWork.has(key))peopleByWork.set(key,new Map());
    const votes=peopleByWork.get(key), previous=votes.get(e.userId);
    if(!previous||e.createdAt>previous.createdAt)votes.set(e.userId,e);
  }
  for(const [key,votes] of peopleByWork){
    const values=[...votes.values()].map(e=>e.rating);
    ratingsByWork.set(key,{values,count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length});
  }
}
const ratingsByWork=new Map();
const workKey=(id,trackId)=>JSON.stringify([id,trackId||null]);
function avg(albumId,trackId=null) {
  return ratingsByWork.get(workKey(albumId,trackId))||{count:0,mean:0,values:[]};
}
function toast(msg){
  const n=document.querySelector('#toast');n.textContent=msg;n.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('show'),4200);
}
function go(url){
  const dest=new URL(url,location.href);
  if(dest.origin!==location.origin)return;
  if(dialog.open)dialog.close();
  if(location.pathname+location.search!==dest.pathname+dest.search)history.pushState(null,'',dest.pathname+dest.search+dest.hash);
  return render(true);
}
function requireUser(){
  if(ctx.s.user)return true;
  go('/entrar?voltar='+encodeURIComponent(location.pathname+location.search));return false;
}
function header(route){
  const user=ctx.s.user;
  const nav=[['/','Descobrir','compass',['','inicio','descobrir','explorar','artistas','artista','album','musica']],['/comunidade','Comunidade','users',['comunidade','perfil','avaliacao']],['/diario','Diário','book',['diario']],['/estudio','Estúdio','studio',['estudio']]];
  const links=nav.map(([url,title,g,routes])=>`<a href="${url}" ${routes.includes(route)?'aria-current="page"':''}>${icon(g,17)}<span>${title}</span></a>`).join('');
  document.querySelector('#masthead').innerHTML=`<div class="topbar"><a class="brand-link" href="/" aria-label="CAPA, início">${brand()}</a><nav class="top-nav" aria-label="Principal">${links}</nav><div class="top-actions"><button class="icon-btn" data-find aria-label="Pesquisar música">${icon('search',20)}</button><a class="session-link" href="${user?'/meu-perfil':'/entrar'}">${user?`${icon('user',17)} <span>${esc(user.username)}</span>`:'Entrar'}</a><button class="btn primary log-button" data-review="">${icon('plus',17)} <span>Registrar</span></button></div></div><nav class="mobile-nav" aria-label="Navegação no celular">${links}</nav>`;
}
function footer(){
  document.querySelector('#footer').innerHTML=`<div class="footer-inner"><a class="brand-link" href="/">${brand()}</a><nav aria-label="Mais no CAPA">${[['/explorar','Catálogo'],['/artistas','Artistas'],['/listas','Listas'],['/rankings','Rankings'],['/batalha','Batalha de discos'],['/estatisticas','Estatísticas'],['/configuracoes','Configurações'],['/boas-vindas','Sobre o CAPA'],['/creditos','Créditos']].map(([href,l])=>`<a href="${href}">${l}</a>`).join('')}</nav></div>`;
}
async function render(navigate=false){
  const current=++generation;
  page.setAttribute('aria-busy','true');
  if(navigate)page.innerHTML='<div class="wrap inner"><p role="status">Carregando…</p></div>';
  try{
    if(!ctx.s)await refresh();
    await carregarIdentidades().catch(()=>{});
    if(current!==generation)return;
    const parts=location.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    header(parts[0]||'');footer();
    let html=await discoverPage(ctx,parts),social=false,studio;
    if(location.pathname==='/estudio-local'){studio=await import('./studio.js');html=studio.localComposerPage(ctx)}
    if(html==null&&parts[0]==='estudio'){studio=await import('./studio.js');html=studio.studioPage(ctx)}
    if(html==null){html=await socialPage(ctx,parts);social=html!=null}
    if(current!==generation)return;
    page.innerHTML=html==null?notFound():html;page.removeAttribute('aria-busy');
    if(social)bindSocial(ctx,parts);
    else if(studio&&page.querySelector('[data-local-composer="true"]'))await studio.bindLocalComposer(ctx,page.querySelector('#studio'));
    else if(studio)await studio.bindStudio(ctx);
    else bindDiscover(ctx);
    if(current!==generation)return;
    document.title=(page.querySelector('h1')?.textContent||'Descobrir')+' · CAPA';
    if(navigate){window.scrollTo(0,0);page.focus({preventScroll:true})}
    if(ctx.s.user&&parts[0]==='registrar'){
      page.innerHTML='<div class="wrap inner"><h1>Registrar escuta</h1><button data-review="" class="btn primary">Escolher disco</button></div>';
      const p=new URLSearchParams(location.search);review(p.get('album'),p.get('faixa'));
    }
  }catch(error){if(current!==generation)return;page.removeAttribute('aria-busy');page.innerHTML=`<div class="wrap inner empty"><h1>O conteúdo não carregou</h1><p>${esc(error.message)}</p><button class="btn" id="retry">Tentar novamente</button></div>`;page.querySelector('#retry').onclick=()=>{ctx.s=null;render()}}
}
function popup(title,html){
  if(dialog.open)dialog.close();
  dialog.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="Fechar">${icon('close')}</button></div>${html}`;
  dialog.showModal();dialog.scrollTop=0;
}
dialog.addEventListener('click',e=>{if(e.target.closest('[data-close]')||e.target===dialog&&!(e.clientX>=dialog.getBoundingClientRect().left&&e.clientX<=dialog.getBoundingClientRect().right&&e.clientY>=dialog.getBoundingClientRect().top&&e.clientY<=dialog.getBoundingClientRect().bottom))dialog.close()});
function searchDialog(){
  popup('Pesquisar música',`<form id="quick-search" class="stack"><label class="field">Disco, artista ou faixa<input type="search" name="q" placeholder="O que você quer ouvir?" autofocus autocomplete="off"></label><button class="btn primary">${icon('search',16)} Pesquisar no catálogo</button></form>`);
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();go('/explorar?q='+encodeURIComponent(new FormData(e.target).get('q')))};
}
function localDate(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function review(albumId,trackId,entryId){
  const me=ctx.s.user;
  if(!me){
    const dest='/registrar?'+new URLSearchParams({...(albumId?{album:albumId}:{}),...(trackId?{faixa:trackId}:{})});
    go('/entrar?voltar='+encodeURIComponent(dest));return;
  }
  const prev=ctx.s.entries.find(e=>e.userId===me.id&&(entryId?e.id===entryId:albumId&&e.albumId===albumId&&(e.trackId||null)===(trackId||null)));
  const albums=ctx.s.albums,a=ctx.album(prev?.albumId||albumId)||albums[0];
  if(!a){toast('Adicione um disco ao catálogo para registrar sua escuta.');return}
  const options=(items,selected)=>items.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.title)}</option>`).join('');
  popup(prev?'Editar escuta':'Registrar escuta',`<form id="review-form" class="stack">
    <label class="field">Disco<select name="albumId">${albums.map(x=>`<option value="${esc(x.id)}" ${x.id===a.id?'selected':''}>${esc(x.title)} — ${esc(x.artist)}</option>`).join('')}</select></label>
    <label class="field">O que você ouviu?<select name="trackId"><option value="">Disco completo</option>${options(a.tracks,prev?.trackId||trackId)}</select></label>
    <div class="review-note"><label for="rating-select">Sua nota</label><div class="rate-row"><div class="star-input" aria-hidden="true">${[1,2,3,4,5].map(i=>`<span data-star="${i}">★</span>`).join('')}</div><select id="rating-select" name="rating"><option value="">Sem nota</option>${Array.from({length:10},(_,i)=>(i+1)/2).map(n=>`<option value="${n}" ${prev?.rating===n?'selected':''}>${n.toLocaleString('pt-BR')} / 5</option>`).join('')}</select></div></div>
    <label class="field">Crítica <span class="muted">(opcional)</span><textarea name="review" maxlength="6000" rows="3" placeholder="O que ficou desta escuta?">${esc(prev?.review||'')}</textarea></label>
    <div class="form-pair"><label class="field">Data da escuta<input type="date" required name="date" value="${esc(prev?.date||localDate())}" max="${localDate()}"></label>
    <label class="field">Visibilidade<select name="visibility"><option value="public">Pública</option><option value="private" ${prev?.visibility==='private'?'selected':''}>Privada</option></select></label></div>
    <label class="checkbox"><input type="checkbox" name="favorite" ${prev?.favorite?'checked':''}> ${icon('heart',16)} Marcar como favorito</label><p class="form-error" role="alert"></p><button class="btn primary" type="submit">${icon('check',16)} Salvar escuta</button></form>`);
  const form=dialog.querySelector('form'),rating=form.elements.rating;
  const paint=()=>form.querySelectorAll('[data-star]').forEach(x=>{const v=Number(rating.value)-Number(x.dataset.star)+1;x.className=v>=1?'on':v===.5?'half':''});
  paint();rating.onchange=paint;
  if(prev){form.elements.albumId.disabled=true;form.elements.trackId.disabled=true;}
  form.querySelector('.star-input').onclick=e=>{const s=e.target.closest('[data-star]');if(!s)return;const box=s.getBoundingClientRect();rating.value=String(Number(s.dataset.star)-(e.clientX-box.left<box.width/2?.5:0));paint()};
  form.elements.albumId.onchange=e=>{form.elements.trackId.innerHTML='<option value="">Disco completo</option>'+options(ctx.album(e.target.value).tracks)};
  form.onsubmit=async e=>{
    e.preventDefault();const submit=form.querySelector('[type=submit]');if(submit.disabled)return;const d=new FormData(form);submit.disabled=true;
    try{const {entry}=await api(prev?'/entries/'+encodeURIComponent(prev.id):'/entries',prev?'PATCH':'POST',{albumId:prev?.albumId||d.get('albumId'),trackId:prev?prev.trackId:d.get('trackId')||null,date:d.get('date'),rating:d.get('rating')?Number(d.get('rating')):null,review:d.get('review'),favorite:d.has('favorite'),visibility:d.get('visibility')});
      const publica=entry.visibility!=='private';
      const titulo=ctx.album(entry.albumId)?.tracks.find(t=>t.id===entry.trackId)?.title||ctx.album(entry.albumId)?.title;
      ctx.s.entries=[entry,...ctx.s.entries.filter(e=>e.id!==entry.id)];
      dialog.close();try{await refresh();}catch{toast('Sua escuta foi salva. Os demais dados serão atualizados quando a conexão voltar.');}
      if(location.pathname==='/registrar')history.replaceState(null,'','/diario');await render();
      const confirmacao=entry.rating?'Avaliado!':'Escuta salva!';
      popup(confirmacao,`
        ${entry.rating&&publica?'<p><b>Sua avaliação foi publicada!</b></p>':''}
        ${ratingBlock(entry.rating,{label:'Sua avaliação'})}<p><b>${esc(titulo)}</b> está no seu diário.${publica?'':' Este registro é privado; compartilhar a imagem revela seu conteúdo a quem a receber.'}</p>
        <div class="row"><a class="btn primary" href="/estudio?destino=instagram&entry=${encodeURIComponent(entry.id)}">${icon('share',17)} Compartilhar nos Stories</a><a class="btn" href="/estudio?entry=${encodeURIComponent(entry.id)}">Outros formatos</a><a class="btn" href="/diario">Ver diário</a></div>`);
    }catch(err){form.querySelector('.form-error').textContent=err.message;submit.disabled=false}
  };
}
document.addEventListener('click',e=>{
  if(e.defaultPrevented)return;
  if(e.target.closest('[data-find]')){searchDialog();return}
  const rev=e.target.closest('[data-review]');if(rev){review(rev.dataset.review,rev.dataset.track,rev.dataset.entry);return}
  const a=e.target.closest('a[href]');if(!a||a.target||a.hasAttribute('download')||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  if(a.getAttribute('href').startsWith('#')||a.origin!==location.origin||a.pathname.startsWith('/assets/'))return;
  e.preventDefault();go(a.href);
});
window.addEventListener('popstate',()=>{if(dialog.open)dialog.close();render(true)});
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement && e.target.closest('.cover'))e.target.hidden=true},true);
render();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
