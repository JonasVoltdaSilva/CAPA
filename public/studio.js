import {storyCover} from './cover-art.js';
import {coverUse} from './cover-policy.js';
import {canShareFile, downloadFile, shareFile} from './share-files.js';
import {identidadeDoAlbum, temaDaIdentidade, temaSemiautomatico, temaDoAlbum, garantirFontes} from './identidades.js';

const models = [
  ['album','Crítica de disco','Album Review'], ['editorial','Editorial','Minimal Editorial'],
  ['faixas','Ranking de faixas','Track Ranking'], ['top','Discos favoritos','Top Albums'],
  ['mensal','Resumo mensal','Monthly Recap'], ['anual','Meu ano em música','Year in Music'],
  ['lista','Lista musical','Lista musical']
];
const formats = [['stories','Stories',1920],['feed','Feed',1350],['quadrado','Quadrado',1080]];
const colors = [['#e9ae76','Cobre'],['#b8cf98','Sálvia'],['#bdaddc','Lavanda'],['#e89480','Coral']];
const themeModes = [['capa','Tema do CAPA'],['album','Estética do álbum'],['custom','Personalizado']];
const selected = (a,b) => a === b ? 'selected' : '';
const author = (ctx,id) => ctx.s.people.find(u=>u.id===id);
const currentPeriod = () => {
  const d=new Date();
  return {year:String(d.getFullYear()),month:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
};
const entryTitle = (ctx,e) => {
  const a=ctx.album(e.albumId);
  return a?.tracks.find(t=>t.id===e.trackId)?.title || a?.title || '';
};
const excerpt = value => {
  const text=String(value||'').replace(/\s+/g,' ').trim();
  const letters=Array.from(text);
  if(letters.length<=210)return text;
  const prefix=letters.slice(0,209).join('');
  const cut=prefix.lastIndexOf(' ');
  return (cut>170 ? prefix.slice(0,cut) : prefix)+'…';
};
const ownEntries = ctx=>ctx.s.entries.filter(e=>e.userId===ctx.s.user?.id);
const dateLabel = date=>date ? new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(date+'T12:00:00')) : '';

function renderLocalComposerPage(ctx,query){
  const album=ctx.album(query.get('album'))||ctx.s.albums[0];
  if(!album)return '<section class="wrap inner"><h1>Estúdio CAPA local</h1><p>Adicione um disco ao catálogo para criar uma composição.</p></section>';
  return `<section class="wrap inner st-root" id="studio" data-local-composer="true"><header class="st-heading"><h1>Estúdio CAPA</h1><p>Composição local no navegador. Escolha um álbum ou use uma imagem do computador.</p></header><div class="st-space"><figure class="st-preview"><div class="st-proof"><canvas id="st-canvas" width="1080" height="1920" aria-label="Prévia da composição local"></canvas></div><figcaption class="st-caption"><span>Prévia local</span><span>1080 × 1920 px</span></figcaption></figure><section class="st-panel" aria-label="Composição local"><label class="field">Álbum<select id="local-album">${ctx.s.albums.map(a=>`<option value="${ctx.esc(a.id)}" ${a.id===album.id?'selected':''}>${ctx.esc(a.title)} · ${ctx.esc(a.artist)}</option>`).join('')}</select></label><label class="field">Imagem do computador<input id="local-cover" type="file" accept="image/png,image/jpeg,image/webp"></label><p id="local-status" class="st-note" role="status">A imagem escolhida permanece neste navegador e não é enviada ao servidor. A exportação fica no seu computador.</p><button id="local-download" class="btn primary" disabled>Baixar composição PNG</button><a href="/estudio?album=${encodeURIComponent(album.id)}" class="text-link">Voltar ao Estúdio compartilhável</a><p>O uso local não concede permissão para redistribuir imagens.</p></section></div></section>`;
}

export function studioPage(ctx) {
  const query=new URLSearchParams(location.search);
  if(query.get('modo')==='local')return renderLocalComposerPage(ctx,query);
  if(query.get('destino')==='instagram')return instagramPage(ctx,query.get('entry'));
  if(!ctx.s.albums.length)return '<section class="wrap inner"><h1>Estúdio</h1><p>Adicione um disco ao catálogo para criar a primeira arte.</p></section>';
  const listId=new URLSearchParams(location.search).get('lista');
  const menu=models.filter(([id])=>id!=='lista'||ctx.s.lists.some(list=>list.id===listId));
  return `<section class="wrap inner st-root" id="studio"><header class="st-heading"><div><h1>Estúdio</h1><p>Transforme uma escuta, lista ou retrospectiva em uma arte para compartilhar.</p></div></header>
    <div class="st-space"><section class="st-preview"><div class="st-proof"><canvas width="1080" height="1350" id="st-canvas" aria-label="Prévia da arte"></canvas></div>
    <div class="st-caption"><span id="st-model-name"></span><span id="st-dimensions"></span></div></section>
    <section class="st-panel" aria-label="Personalizar a arte"><div class="st-pair"><label class="field">Modelo<select id="st-model">${menu.map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><label class="field">Formato<select id="st-format">${formats.map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label></div>
    <div id="st-context" class="st-group"></div>
    <details class="st-options" open><summary>Aparência</summary><div class="st-pair"><label class="field">Tema<select id="st-theme">${themeModes.map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label>
    <div class="st-custom-only"><label class="field">Fundo<select id="st-bg"><option value="escuro">Carvão</option><option value="claro">Papel</option><option value="cor">Tinta colorida</option></select></label>
    <label class="field">Cor de destaque<input id="st-color" type="color" value="#e9ae76"></label></div></div><div class="st-custom-only st-swatches">${colors.map(([v,n])=>`<button type="button" title="${n}" aria-label="Usar ${n}" style="--swatch:${v}" data-color="${v}"></button>`).join('')}<button class="st-palette" id="st-palette" type="button">Extrair da capa</button></div><p class="st-note" id="st-theme-note"></p></details>
    <details class="st-options" open><summary>Texto e assinatura</summary><div id="st-text"></div></details>
    <p id="st-notice" class="st-note" role="status"></p><div class="st-actions"><button class="btn primary" type="button" id="st-save" disabled>${ctx.icon('down',17)} Baixar PNG</button><button class="btn" id="st-share" type="button" hidden disabled>${ctx.icon('share',17)} Compartilhar imagem</button><button class="btn quiet" id="st-link" type="button" hidden>Copiar link público</button></div>
    </section></div></section>`;
}

function startState(ctx) {
  const q=new URLSearchParams(location.search),entry=ctx.s.entries.find(e=>e.id===q.get('entry')),list=ctx.s.lists.find(l=>l.id===q.get('lista'));
  const album=ctx.album(entry?.albumId||q.get('album'))||ctx.s.albums.find(a=>coverUse(a).usable)||ctx.s.albums[0];
  const period=currentPeriod(),requested=q.get('modelo');
  const model=list?'lista':models.some(m=>m[0]===requested&&requested!=='lista')?requested:'album';
  const theme=(q.get('tema')==='album'||q.get('tema')==='capa'||q.get('tema')==='custom')?q.get('tema'):(identidadeDoAlbum(album.id)?'album':'capa');
  return {model,format:'feed',albumId:album.id,entry,list,accent:colors[0][0],background:'escuro',theme,showReview:true,showStars:true,showUser:true,
    title:'',quote:'',chosen:[],tracks:[],grid:list?.items.length>4?9:4,listPage:0,
    month:/^\d{4}-(0[1-9]|1[0-2])$/.test(q.get('mes')||'')?q.get('mes'):period.month,
    year:/^\d{4}$/.test(q.get('ano')||'')?q.get('ano'):period.year,
    unavailable:Boolean((q.has('entry')&&!entry)||(q.has('lista')&&!list))};
}

function seedChoices(ctx,state) {
  const a=ctx.album(state.albumId);
  const entries=ownEntries(ctx).filter(e=>e.albumId===a.id && e.trackId && (e.rating || e.favorite));
  entries.sort((x,y)=>Number(y.favorite)-Number(x.favorite) || (y.rating||0)-(x.rating||0));
  state.tracks=[...new Set(entries.map(e=>e.trackId))].filter(id=>a.tracks.some(t=>t.id===id)).slice(0,5);
  const itemIds=state.list?.items.map(i=>i.albumId) || ctx.s.user?.favoriteAlbums || [];
  state.chosen=[...new Set(itemIds)].filter(id=>ctx.album(id)).slice(0,9);
}

function resetText(ctx,s) {
  const a=ctx.album(s.albumId);
  s.title=({album:s.entry?entryTitle(ctx,s.entry):a.title, editorial:s.entry?entryTitle(ctx,s.entry):a.title,
    faixas:a.title,top:s.list?.title||'Meus discos favoritos',lista:s.list?.title,mensal:'Meu mês em música',anual:'Meu ano em música'})[s.model];
  s.quote=excerpt(['album','editorial'].includes(s.model)?s.entry?.review:listModel(s)?s.list?.description:'');
}

const images=new Map();
const archiveCover = url => /^https:\/\/coverartarchive\.org\//.test(url || '');
function loadArt(url){
  if(!images.has(url))images.set(url,new Promise(resolve=>{
    const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>{images.delete(url);resolve(null)};image.src=url;
  }));
  return images.get(url);
}
const artwork=new Map();
async function art(album) {
  const result=await storyCover(album);artwork.set(album.id,result);return result.image;
}

function albumDoEstudio(ctx,s) {
  return ctx.album(s.albumId)||ctx.s.albums.find(a=>coverUse(a).usable)||ctx.s.albums[0];
}
function notaDoTema(ctx,s) {
  if(s.theme==='album'){
    const identidade=identidadeDoAlbum(albumDoEstudio(ctx,s)?.id);
    if(identidade)return 'Estética de '+identidade.titulo+': paleta e tipografia do dossiê de referências do álbum.';
    const a=albumDoEstudio(ctx,s);
    return coverUse(a).usable?'Sem identidade cadastrada: a cor dominante da capa define o destaque.':'Sem identidade cadastrada e sem capa utilizável: a arte usa o tema padrão do CAPA.';
  }
  if(s.theme==='custom')return 'Você escolhe fundo e cor de destaque.';
  return 'Tokens do design system do CAPA.';
}
// Resolve o tema efetivo da arte. Nível 1: identidade do álbum. Nível 2: cor extraída + preset.
// Nível 3: design system (comportamento histórico do Estúdio).
async function temaDaArte(ctx,s,corExtraida) {
  if(s.theme!=='album')return {nivel:3,cores:{},fontes:null,composicao:{}};
  const identidade=identidadeDoAlbum(albumDoEstudio(ctx,s)?.id);
  if(identidade)return temaDaIdentidade(identidade);
  if(corExtraida)return temaSemiautomatico(corExtraida,'editorial');
  return {nivel:3,cores:{},fontes:null,composicao:{}};
}
const listModel=s=>s.model==='lista'||s.model==='top';
const listPageSize=9;
function listPageCount(s){
  return Math.max(1,Math.ceil((s.list?.items.length||0)/listPageSize));
}
function listPageItems(ctx,s){
  const start=s.listPage*listPageSize;
  return s.list.items.slice(start,start+listPageSize).map((item,i)=>{
    const album=ctx.album(item.albumId);
    const track=album?.tracks.find(t=>t.id===item.trackId);
    return {
      rank:start+i+1,
      title:track?.title||album?.title,
      note:[album?.artist,track&&album.title].filter(Boolean).join(' · ')
    };
  });
}

function controls(ctx,s,root) {
  const e=ctx.esc,a=ctx.album(s.albumId),reviewModel=['album','editorial'].includes(s.model);
  const option=(id,text,current)=>`<option value="${e(id)}" ${selected(id,current)}>${e(text)}</option>`;
  const albumOptions=(current)=>ctx.s.albums.map(x=>option(x.id,x.title+' · '+x.artist,current)).join('');
  let html='';
  if(reviewModel||s.model==='faixas')html=`<label class="field">Disco<select id="st-album">${albumOptions(a.id)}</select></label>`;
  if(reviewModel){
    const available=ctx.s.entries.filter(x=>x.albumId===a.id&&(x.userId===ctx.s.user?.id||x.id===s.entry?.id));
    html+=`<label class="field">Avaliação<select id="st-entry"><option value="">Ficha do disco</option>${available.map(x=>option(x.id,entryTitle(ctx,x)+' · '+dateLabel(x.date)+(x.rating?' · '+x.rating.toLocaleString('pt-BR')+' ★':''),s.entry?.id)).join('')}</select></label>`;
  }
  if(s.model==='faixas'||s.model==='top'){
    const isTop=s.model==='top',values=isTop?s.chosen:s.tracks,lim=isTop?s.grid:5;
    const choices=isTop?ctx.s.albums:a.tracks;
    if(isTop)html+=`<label class="field">Grade<select id="st-grid">${option('4','Quatro discos',String(s.grid))}${option('9','Nove discos',String(s.grid))}</select></label>`;
    const inOrder=values.slice(0,lim);
    html+=`<ol class="st-order">${inOrder.map((id,i)=>{const name=choices.find(x=>x.id===id)?.title||'';return `<li><span>${i+1}. ${e(name)}</span><button aria-label="Subir ${e(name)}" data-move="-1" data-i="${i}" ${i===0?'disabled':''}>↑</button><button aria-label="Descer ${e(name)}" data-move="1" data-i="${i}" ${i===inOrder.length-1?'disabled':''}>↓</button><button aria-label="Remover ${e(name)}" data-remove="${i}">×</button></li>`}).join('')}</ol>`;
    if(inOrder.length<lim)html+=`<label class="field">${isTop?'Adicionar disco':'Adicionar faixa'}<select id="st-add"><option value="">Escolha no catálogo</option>${choices.filter(x=>!values.includes(x.id)).map(x=>option(x.id,x.title,'')).join('')}</select></label>`;
  }
  if(s.model==='lista'&&listPageCount(s)>1)html+=`<label class="field">Página da lista<select id="st-list-page">${Array.from({length:listPageCount(s)},(_,i)=>option(i,'Página '+String(i+1),s.listPage)).join('')}</select></label>`;
  if(s.model==='mensal') html+=`<label class="field">Mês da escuta<input id="st-month" type="month" value="${e(s.month)}"></label>`;
  if(s.model==='anual') html+=`<label class="field">Ano da escuta<input id="st-year" type="number" min="1000" max="9999" value="${e(s.year)}"></label>`;
  root.querySelector('#st-context').innerHTML=html;
  const themeSelect=root.querySelector('#st-theme');
  if(themeSelect){themeSelect.value=s.theme;root.dataset.theme=s.theme}
  const themeNote=root.querySelector('#st-theme-note');
  if(themeNote)themeNote.textContent=notaDoTema(ctx,s);
  root.querySelector('#st-text').innerHTML=`<label class="field">Título na arte<input id="st-title" maxlength="100" value="${e(s.title)}"></label>
    <label class="field">${reviewModel?'Trecho da crítica':'Legenda'}<textarea id="st-quote" rows="2" maxlength="210">${e(s.quote)}</textarea></label>
    <div class="st-checks"><label><input type="checkbox" id="st-show-review" ${s.showReview?'checked':''}> ${reviewModel?'Crítica':'Legenda'}</label>${reviewModel&&s.entry?.rating?`<label><input type="checkbox" id="st-show-stars" ${s.showStars?'checked':''}> Estrelas</label>`:''}<label><input type="checkbox" id="st-show-user" ${s.showUser?'checked':''}> Nome de usuário</label></div>`;
  const publicObject=reviewModel?s.entry:listModel(s)?s.list:null;
  root.querySelector('#st-link').hidden=publicObject?.visibility!=='public';
  root.querySelector('#st-palette').disabled=!coverUse(a).usable || !['album','editorial','faixas','top'].includes(s.model);
  if(s.model==='top')root.querySelector('#st-palette').disabled=!s.chosen.some(id=>ctx.album(id)?.exportCover);
}

function periodEntries(ctx,s) {
  const period=s.model==='mensal'?s.month:s.year;
  return ownEntries(ctx).filter(entry=>entry.date.startsWith(period));
}

function chosenAlbums(ctx,s) {
  if(s.model==='top')return s.chosen.slice(0,s.grid).map(ctx.album).filter(Boolean);
  return ['mensal','anual','lista'].includes(s.model)?[]:[ctx.album(s.albumId)];
}

function accessibleInk(hex) {
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
    .map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.18?'#151714':'#ffffff';
}

function coverColor(img) {
  const c=document.createElement('canvas');c.width=c.height=25;
  const p=c.getContext('2d',{willReadFrequently:true});p.drawImage(img,0,0,25,25);
  const bytes=p.getImageData(0,0,25,25).data,bins=new Map();
  for(let i=0;i<bytes.length;i+=4){
    const [r,g,b]=bytes.slice(i,i+3),lo=Math.min(r,g,b),hi=Math.max(r,g,b);
    if(hi-lo<22||hi<65||lo>215)continue;
    const key=[r,g,b].map(v=>v>>5).join();
    const bucket=bins.get(key)||[0,0,0,0];
    bucket[0]++;bucket[1]+=r;bucket[2]+=g;bucket[3]+=b;bins.set(key,bucket);
  }
  const win=[...bins.values()].sort((a,b)=>b[0]-a[0])[0];
  if(!win)return null;
  return '#'+win.slice(1).map(v=>Math.round(v/win[0]).toString(16).padStart(2,'0')).join('');
}

function contextNotice(ctx,s,albums) {
  if(s.unavailable)return 'O item do link está indisponível para esta conta. Você pode criar uma arte com o catálogo.';
  if(s.model==='mensal'||s.model==='anual'){
    const entries=periodEntries(ctx,s);
    if(!entries.length)return ctx.s.user?'Seu diário não tem escutas neste período.':'Entre na sua conta para usar as escutas do diário.';
    if(entries.some(e=>e.visibility==='private'))return 'O resumo inclui escutas privadas. A imagem contém dados do seu diário.';
  }
  if((listModel(s)&&s.list?.visibility==='private')||(['album','editorial'].includes(s.model)&&s.entry?.visibility==='private'))
    return 'Este registro é privado. Ao enviar a imagem, você compartilha o conteúdo visível na prévia.';
  if(s.model==='faixas'&&!s.tracks.length)return 'Escolha até cinco faixas para montar o ranking.';
  if(s.model==='lista'&&!s.list.items.length)return 'Adicione obras à lista antes de exportar.';
  if(s.model==='top'&&!s.chosen.length)return 'Adicione os discos que deseja destacar.';
  if(albums.some(a=>!artwork.get(a.id)?.image&&!coverUse(a).usable))return 'Os discos sem capa utilizável recebem uma composição tipográfica.';
  return '';
}

async function clipboardLink(url,root,ctx) {
  try{await navigator.clipboard.writeText(url);ctx.toast('Link público copiado.')}
  catch{
    const notice=root.querySelector('#st-notice');
    const field=document.createElement('input');field.value=url;field.readOnly=true;field.setAttribute('aria-label','Link público');
    notice.replaceChildren(field);field.focus();field.select();
  }
}

export async function bindStudio(ctx) {
  const root=document.querySelector('#studio');
  if(!root)return;
  if(root.dataset.destination==='instagram'){await bindInstagram(ctx,root);return;}
  const s=startState(ctx),canvas=root.querySelector('#st-canvas');
  seedChoices(ctx,s);resetText(ctx,s);
  root.querySelector('#st-model').value=s.model;root.querySelector('#st-format').value=s.format;
  controls(ctx,s,root);
  let version=0,blob=null;
  const save=root.querySelector('#st-save'),share=root.querySelector('#st-share');
  const supportsFiles=typeof navigator.share==='function'&&typeof navigator.canShare==='function';
  share.hidden=!supportsFiles;
  async function redraw(){
    const current=++version;blob=null;save.disabled=share.disabled=true;canvas.hidden=true;
    root.querySelector('#st-notice').textContent='Carregando capa…';
    const albums=chosenAlbums(ctx,s),pictures=await Promise.all(albums.map(art));
    let corExtraida=null;
    if(s.theme==='album'&&!identidadeDoAlbum(albumDoEstudio(ctx,s)?.id)){
      const pic=pictures.find(Boolean);
      corExtraida=pic?coverColor(pic):null;
    }
    const theme=await temaDaArte(ctx,s,corExtraida);
    await garantirFontes(theme.fontes?theme:{nivel:3,cores:{},fontes:{carregar:[['700 42px Bricolage'],['400 24px Instrument']]}});
    if(!root.isConnected||current!==version)return;
    const height=formats.find(f=>f[0]===s.format)[2];
    canvas.width=1080;canvas.height=height;
    root.querySelector('#st-dimensions').textContent='1080 × '+height+' px';
    root.querySelector('#st-model-name').textContent=models.find(m=>m[0]===s.model)[2];
    const notice=contextNotice(ctx,s,albums);
    root.querySelector('#st-notice').textContent=[notice,...new Set(albums.map(a=>artwork.get(a.id)?.message).filter(Boolean))].filter(Boolean).join(' ');
    drawProof(canvas,ctx,s,albums,pictures,theme);canvas.hidden=false;
    const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!root.isConnected||current!==version)return;
    const picturedAlbums=s.model==='editorial'?[]:albums.filter((a,i)=>pictures[i]).map(a=>artwork.get(a.id)?.creditAlbum||a);
    blob=output?await withCredits(output,picturedAlbums):null;
    if(!root.isConnected||current!==version)return;
    const empty=(s.model==='lista'&&!s.list.items.length)||(s.model==='top'&&!s.chosen.length)||(s.model==='faixas'&&!s.tracks.length)||
      (['mensal','anual'].includes(s.model)&&!periodEntries(ctx,s).length);
    save.disabled=share.disabled=!blob||empty;
    if(supportsFiles&&blob)share.hidden=!navigator.canShare({files:[new File([blob],'capa.png',{type:'image/png'})]});
    if(!blob)root.querySelector('#st-notice').textContent='A imagem não pôde ser gerada. Altere o formato para tentar novamente.';
  }
  const rebuild=()=>{controls(ctx,s,root);return redraw()};
  root.addEventListener('change',event=>{
    const el=event.target;
    switch(el.id){
      case 'st-model':s.model=el.value;resetText(ctx,s);rebuild();return;
      case 'st-theme':s.theme=el.value;rebuild();return;
      case 'st-format':s.format=el.value;break;
      case 'st-album':s.albumId=el.value;s.entry=null;seedChoices(ctx,s);resetText(ctx,s);rebuild();return;
      case 'st-entry':s.entry=ctx.s.entries.find(e=>e.id===el.value)||null;resetText(ctx,s);rebuild();return;
      case 'st-grid':s.grid=Number(el.value);rebuild();return;
      case 'st-list-page':s.listPage=Number(el.value);break;
      case 'st-add':if(el.value)(s.model==='top'?s.chosen:s.tracks).push(el.value);rebuild();return;
      case 'st-month':if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(el.value)){el.value=s.month;return} s.month=el.value;break;
      case 'st-year':if(!/^\d{4}$/.test(el.value)){el.value=s.year;return} s.year=el.value;break;
      case 'st-bg':s.background=el.value;break;
      case 'st-show-user':s.showUser=el.checked;break;
      case 'st-show-stars':s.showStars=el.checked;break;
      case 'st-show-review':s.showReview=el.checked;break;
      default:return;
    }
    redraw();
  });
  root.addEventListener('input',event=>{
    const id=event.target.id,value=event.target.value;
    if(id==='st-color')s.accent=value;
    else if(id==='st-title')s.title=value;
    else if(id==='st-quote')s.quote=value;
    else return;
    redraw();
  });
  root.addEventListener('click',async event=>{
    const btn=event.target.closest('button');if(!btn||btn.disabled)return;
    if(btn.dataset.color||btn.id==='st-palette'){
      let value=btn.dataset.color;
      if(!value){const album=chosenAlbums(ctx,s).find(x=>coverUse(x).usable);const pic=await art(album);value=pic&&coverColor(pic)}
      if(!value){ctx.toast('Essa capa não tem uma cor dominante disponível.');return}
      root.querySelector('#st-color').value=s.accent=value;redraw();return;
    }
    const order=s.model==='top'?s.chosen:s.tracks;
    if(btn.hasAttribute('data-remove')){order.splice(Number(btn.dataset.remove),1);rebuild();return}
    if(btn.hasAttribute('data-move')){
      const i=Number(btn.dataset.i),j=i+Number(btn.dataset.move);
      [order[i],order[j]]=[order[j],order[i]];await rebuild();root.querySelector(`[data-i="${j}"][data-move="${btn.dataset.move}"]:not(:disabled)`)?.focus();return;
    }
    if(btn.id==='st-link'){
      const item=listModel(s)?s.list:s.entry;
      if(item?.visibility==='public')await clipboardLink(new URL('/'+(listModel(s)?'lista':'avaliacao')+'/'+encodeURIComponent(item.id),location.origin).href,root,ctx);
      return;
    }
    if(!blob||!['st-save','st-share'].includes(btn.id))return;
    const pageNumber=s.model==='lista'&&listPageCount(s)>1?'-'+String(s.listPage+1):'';
    const filename='capa-'+s.model+'-'+s.format+pageNumber+'.png';
    if(btn.id==='st-share'){
      try {await navigator.share({files:[new File([blob],filename,{type:'image/png'})]})}
      catch(err){if(err.name!=='AbortError')ctx.toast('Use Baixar PNG para salvar a imagem e abrir no Instagram.')}
      return;
    }
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  });
  await redraw();
}

async function withCredits(png,albums,change='') {
  if(!albums.length)return png;
  const info=albums.map(a=>[a.title,a.credit,a.license,a.licenseUrl,a.coverSource,change].filter(Boolean).join('\n')).join('\n\n');
  const data=new TextEncoder().encode('Attribution\0\0\0\0\0'+info);
  const chunk=new Uint8Array(12+data.length),view=new DataView(chunk.buffer);
  view.setUint32(0,data.length);chunk.set([105,84,88,116],4);chunk.set(data,8);
  let crc=0xffffffff;
  for(const b of chunk.subarray(4,-4)){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  view.setUint32(chunk.length-4,(crc^0xffffffff)>>>0);
  return new Blob([png.slice(0,-12),chunk,png.slice(-12)],{type:'image/png'});
}

const sans='Instrument, Arial, sans-serif',display='Bricolage, Arial, sans-serif',serif='Georgia, serif';
function rect(p,x,y,w,h,color){p.fillStyle=color;p.fillRect(x,y,w,h)}
function rule(p,x,y,w,color,th=2){rect(p,x,y,w,th,color)}
function label(p,text,x,y,size,color,font=sans,weight=700){
  p.fillStyle=color;p.textBaseline='top';p.font=weight+' '+size+'px '+font;p.fillText(text,x,y);
}
function linesFor(p,text,width) {
  const lines=[];
  for(const para of String(text).split(/\n/)){
    let line='';
    for(const word of para.trim().split(/\s+/).filter(Boolean)){
      if(line&&p.measureText(line+' '+word).width<=width){line+=' '+word;continue}
      if(line){lines.push(line);line=''}
      if(p.measureText(word).width<=width){line=word;continue}
      for(const char of Array.from(word)){
        if(line&&p.measureText(line+char).width>width){lines.push(line);line=''}
        line+=char;
      }
    }
    if(line)lines.push(line);
  }
  return lines;
}
function fit(p,text,x,y,w,h,{size=60,color='#fff',font=display,weight=700,leading=1.12,align='esquerda'}={}){
  if(!text||h<=0||w<=0)return;
  let lines=[];
  let lo=4,hi=Math.max(lo,Math.floor(size)),best=lo;
  while(lo<=hi){
    const mid=(lo+hi)>>1;p.font=weight+' '+mid+'px '+font;
    const next=linesFor(p,text,w);
    if(next.length*mid*leading<=h){best=mid;lo=mid+1}else hi=mid-1;
  }
  p.font=weight+' '+best+'px '+font;lines=linesFor(p,text,w);p.fillStyle=color;p.textBaseline='top';
  const centro=align==='centro';
  p.textAlign=centro?'center':'left';
  lines.forEach((line,i)=>p.fillText(line,centro?x+w/2:x,y+i*best*leading));
  p.textAlign='left';
}
function tituloEco(p,text,x,y,w,h,opts,fundo){
  // eco cru: cópias levemente deslocadas na cor de fundo, como a estética brat
  p.save();p.globalAlpha=.92;
  fit(p,text,x+2.4,y,w,h,{...opts,color:fundo});
  fit(p,text,x-2.4,y,w,h,{...opts,color:fundo});
  fit(p,text,x,y+2.4,w,h,{...opts,color:fundo});
  p.restore();
}
function grooves(p,x,y,r,ink){
  p.save();p.strokeStyle=ink;p.lineWidth=Math.max(2,r*.012);
  for(let i=0;i<9;i++){p.beginPath();p.arc(x,y,r*(.3+.085*i),0,2*Math.PI);p.stroke()}
  p.restore();
}
function insert(p,img,album,x,y,size,theme,tituloTexto) {
  if(img){
    const scale=Math.min(size/img.width,size/img.height),w=img.width*scale,h=img.height*scale;
    rect(p,x,y,size,size,theme.ink);p.drawImage(img,x+(size-w)/2,y+(size-h)/2,w,h);return;
  }
  rect(p,x,y,size,size,theme.accent);
  p.save();p.beginPath();p.rect(x,y,size,size);p.clip();grooves(p,x+size*.83,y+size*.30,size*.53,theme.onAccent);p.restore();
  fit(p,tituloTexto ?? album?.title ?? '',x+size*.08,y+size*.59,size*.84,size*.32,{size:size*.14,color:theme.onAccent});
}
function brand(p,x,y,theme){
  p.save();p.strokeStyle=theme.ink;p.lineWidth=4;
  for(let i=0;i<3;i++){p.beginPath();p.arc(x+23+i*6,y+17,16-i*3,1.5,4.85);p.stroke()}
  p.restore();label(p,'capa.',x+47,y-3,34,theme.ink,display);
}
function star(p,x,y,r,value,color,bg){
  const path=new Path2D();
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.45:r;const xx=x+Math.cos(a)*rad,yy=y+Math.sin(a)*rad;if(i===0)path.moveTo(xx,yy);else path.lineTo(xx,yy)}path.closePath();
  p.save();p.strokeStyle=color;p.lineWidth=2;p.stroke(path);p.clip(path);rect(p,x-r,y-r,2*r,2*r,bg);rect(p,x-r,y-r,2*r*Math.max(0,Math.min(1,value)),2*r,color);p.restore();
}
function stars(p,x,y,s,t) {
  if(!s.showStars||!s.entry?.rating)return;
  for(let i=0;i<5;i++)star(p,x+18+i*42,y+18,17,s.entry.rating-i,t.ink,t.bg);
  label(p,s.entry.rating.toLocaleString('pt-BR',{maximumFractionDigits:1})+'/5',x,y+40,22,t.ink);
}
function drawProof(canvas,ctx,s,albums,pics,theme) {
  const p=canvas.getContext('2d'),H=canvas.height,W=canvas.width,story=H===1920;
  const identidade=theme&&theme.nivel!==3;
  const background=s.theme==='custom'?s.background:'escuro';
  const highlight=s.theme==='custom'?s.accent:colors[0][0];
  const bg=identidade?(theme.cores.fundo||'#191c18'):(background==='escuro'?'#191c18':background==='claro'?'#f1ead9':highlight);
  const ink=identidade?(theme.cores.tinta||accessibleInk(bg)):accessibleInk(bg);
  const accent=identidade?(theme.cores.destaque||bg):(background==='cor'?ink:highlight);
  const t={bg,ink,accent,onAccent:accessibleInk(accent)};
  const titleFont=identidade&&theme.fontes?.titulo?theme.fontes.titulo:display;
  const editorialFont=identidade&&theme.fontes?.titulo?theme.fontes.titulo:serif;
  const bodyFont=identidade&&theme.fontes?.texto?theme.fontes.texto:sans;
  const center=identidade&&theme.composicao?.alinhamento==='centro';
  const caixa=identidade?(theme.composicao?.caixaTitulo||'normal'):'normal';
  const desfoque=identidade&&theme.composicao?.desfoqueTitulo;
  const invertido=identidade&&theme.composicao?.inverterComposicao;
  const titulo=text=>caixa==='minusculas'?String(text).toLowerCase():caixa==='maiusculas'?String(text).toUpperCase():String(text);
  const pad=70,w=W-2*pad,top=story?238:60,bottom=H-(story?245:60);
  if(s.model==='album'){
    const own=ctx.album(s.albumId),heading=titulo(s.title).trim()||entryTitle(ctx,{albumId:s.albumId,trackId:s.entry?.trackId})||own?.title||'';
    storyArt(canvas,heading,s.showStars?s.entry?.rating||0:0,pics[0],own?.title||'');
    return;
  }
  rect(p,0,0,W,H,bg);
  brand(p,pad,top,t);const model=models.find(m=>m[0]===s.model)[2].toUpperCase();
  p.save();p.textAlign='right';label(p,model,W-pad,top+9,21,ink);p.restore();rule(p,pad,top+56,w,ink);
  const credits=s.model==='editorial'?[]:albums.filter((a,i)=>pics[i]).map(a=>a.credit+' · '+a.license);
  const creditLines=[...new Set(credits)];
  const owner=listModel(s)&&s.list?author(ctx,s.list.userId):s.entry&&['album','editorial'].includes(s.model)?author(ctx,s.entry.userId):ctx.s.user;
  const footer=bottom-26-(s.showUser&&owner?38:0)-creditLines.length*25;
  rule(p,pad,footer,w,ink);
  let fy=footer+12;
  if(s.showUser&&owner){fit(p,'@'+owner.username,pad,fy,w,32,{size:25,color:ink,font:sans});fy+=38;}
  creditLines.forEach((c,i)=>fit(p,'Arte · '+c,pad,fy+i*25,w,24,{size:19,color:ink,font:sans,weight:400}));
  const y=top+82,h=footer-y-26,a=ctx.album(s.albumId);
  const quote=s.showReview?s.quote.trim():'';
  if(s.model==='album'){
    const landscape=H===1080,side=landscape?Math.min(480,h*.83):Math.min(w*.87,h*(quote?.50:.59));
    const cx=landscape?pad:(W-side)/2,cy=y+(landscape?Math.max(0,(h-side)/2):6);
    insert(p,pics[0],a,cx,cy,side,t,titulo(a?.title||''));
    const tx=landscape?cx+side+38:pad,ty=landscape?y+16:cy+side+25,tw=landscape?W-pad-tx:w,th=y+h-ty;
    const titleH=th*(quote?.36:.51),artistH=th*(landscape?.16:.15);
    const titleOpts={size:landscape?70:85,color:ink,font:titleFont,align:center?'centro':'esquerda'};
    if(desfoque)tituloEco(p,titulo(s.title),tx,ty,tw,titleH,titleOpts,bg);
    fit(p,titulo(s.title),tx,ty,tw,titleH,titleOpts);
    fit(p,a.artist,tx,ty+titleH+3,tw,artistH,{size:landscape?35:36,color:ink,font:bodyFont,weight:400,align:center?'centro':'esquerda'});
    const starY=ty+titleH+artistH+8,starsH=s.showStars&&s.entry?.rating?46:0;
    stars(p,center?tx+(tw-240)/2:tx,starY,s,t);
    if(quote)fit(p,quote,tx,starY+starsH+10,tw,Math.max(36,y+h-starY-starsH-10),{size:34,color:ink,font:bodyFont,weight:400,align:center?'centro':'esquerda'});
  }else if(s.model==='editorial'){
    const bar=12;rect(p,pad,y,bar,h,accent);
    const lx=pad+42,lw=w-42,starX=center?lx+(lw-240)/2:lx;
    if(invertido){
      const base=y+h;
      fit(p,a.artist.toUpperCase(),lx,base-h*.12-6,lw,h*.12,{size:28,color:ink,font:bodyFont});
      fit(p,titulo(s.title),lx,base-h*.47,lw,h*.35,{size:133,color:ink,font:editorialFont,weight:400,leading:1.08,align:'centro'});
      rule(p,lx,base-h*.50,lw,ink);stars(p,starX,base-h*.475,s,t);
      if(quote)fit(p,'“'+quote+'”',lx,y+2,lw,h*.34,{size:47,color:ink,font:editorialFont,weight:400,align:'centro'});
      else {p.save();p.beginPath();p.rect(lx,y+2,lw,h*.34);p.clip();grooves(p,lx+lw*.70,y+2,h*.34,ink);p.restore()}
    }else{
      fit(p,a.artist.toUpperCase(),lx,y+6,lw,h*.12,{size:28,color:ink,font:bodyFont});
      fit(p,titulo(s.title),lx,y+h*.16,lw,h*.35,{size:133,color:ink,font:editorialFont,weight:400,leading:1.08,align:center?'centro':'esquerda'});
      rule(p,lx,y+h*.54,lw,ink);stars(p,starX,y+h*.565,s,t);
      if(quote)fit(p,'“'+quote+'”',lx,y+h*.66,lw,h*.32,{size:47,color:ink,font:editorialFont,weight:400,align:center?'centro':'esquerda'});
      else {p.save();p.beginPath();p.rect(lx,y+h*.66,lw,h*.32);p.clip();grooves(p,lx+lw*.70,y+h*1.11,h*.44,ink);p.restore()}
    }
  }else if(s.model==='faixas'){
    const ordered=s.tracks.map(id=>a.tracks.find(t=>t.id===id)).filter(Boolean).slice(0,5);
    const stem=Math.min(h*.21,160);insert(p,pics[0],a,pad,y,stem,t,titulo(a?.title||''));
    fit(p,titulo(s.title),pad+stem+28,y,w-stem-28,stem*.7,{size:73,color:ink,font:titleFont});
    fit(p,a.artist,pad+stem+28,y+stem*.73,w-stem-28,stem*.26,{size:27,color:ink,font:bodyFont,weight:400});
    const yy=y+stem+26,qh=quote?Math.min(112,h*.15):0,rh=(y+h-yy-qh)/Math.max(4,ordered.length);
    if(!ordered.length)fit(p,'Nenhuma faixa selecionada',pad,yy+25,w,95,{size:42,color:ink,font:editorialFont,weight:400});
    ordered.forEach((tr,i)=>{const ry=yy+i*rh;rule(p,pad,ry,w,ink);label(p,String(i+1).padStart(2,'0'),pad,ry+rh*.18,Math.min(55,rh*.48),ink,editorialFont,400);fit(p,tr.title,pad+108,ry+rh*.18,w-110,rh*.69,{size:Math.min(48,rh*.52),color:ink,font:titleFont})});
    if(quote)fit(p,quote,pad,y+h-qh+8,w,qh-8,{size:27,color:ink,font:bodyFont,weight:400});
  }else if(s.model==='top'){
    fit(p,titulo(s.title),pad,y,w,h*.15,{size:73,color:ink,font:titleFont});
    const qh=quote?Math.min(104,h*.15):0,gy=y+h*.18,available=y+h-gy-qh;
    const cols=s.grid===4?2:3,tile=Math.min((w-12*(cols-1))/cols,(available-12*(cols-1))/cols),gw=tile*cols+12*(cols-1),gx=(W-gw)/2;
    for(let i=0;i<s.grid;i++){const xx=gx+(i%cols)*(tile+12),yy=gy+Math.floor(i/cols)*(tile+12);
      if(albums[i])insert(p,pics[i],albums[i],xx,yy,tile,t,titulo(albums[i]?.title||''));
      else {p.save();p.strokeStyle=ink;p.globalAlpha=.34;p.lineWidth=2;p.strokeRect(xx+1,yy+1,tile-2,tile-2);p.restore();label(p,String(i+1).padStart(2,'0'),xx+12,yy+8,23,ink,sans,400)}
    }
    if(quote)fit(p,quote,pad,y+h-qh+8,w,qh-8,{size:27,color:ink,font:sans,weight:400});
  }else{
    if(s.model==='lista')drawList(p,ctx,s,t,pad,y,w,h,quote);
    else drawPeriod(p,ctx,s,t,pad,y,w,h,quote);
  }
  const listSummary=s.model==='lista'?listPageItems(ctx,s).map(item=>item.rank+'. '+item.title).join(', '):'';
  canvas.setAttribute('aria-label',[model,titulo(s.title),s.format,s.showUser&&owner?'@'+owner.username:'',s.showReview?s.quote:'',listSummary].filter(Boolean).join(' · '));
}

function drawList(p,ctx,s,t,x,y,w,h,quote) {
  const items=listPageItems(ctx,s);
  const titleHeight=h*.18,quoteHeight=quote?h*.12:0;
  fit(p,s.title,x,y,w,titleHeight,{size:70,color:t.ink});
  const firstRow=y+titleHeight+20;
  const rowHeight=(h-titleHeight-46-quoteHeight)/Math.max(5,items.length);
  items.forEach((item,i)=>{
    const rowY=firstRow+i*rowHeight;
    rule(p,x,rowY,w,t.ink,1);
    label(p,String(item.rank).padStart(2,'0'),x,rowY+6,Math.min(36,rowHeight*.48),t.ink);
    fit(p,item.title,x+72,rowY+5,w-72,rowHeight*.52,{size:39,color:t.ink});
    fit(p,item.note,x+72,rowY+rowHeight*.59,w-72,rowHeight*.33,{size:22,color:t.ink,font:sans,weight:400});
  });
  if(quote)fit(p,quote,x,y+h-quoteHeight-18,w,quoteHeight,{size:28,color:t.ink,font:serif,weight:400});
  if(listPageCount(s)>1)label(p,'Página '+String(s.listPage+1)+' / '+String(listPageCount(s)),x,y+h-18,18,t.ink);
}

function drawPeriod(p,ctx,s,t,x,y,w,h,quote){
  const entries=periodEntries(ctx,s),monthly=s.model==='mensal';
  const period=monthly?new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(s.month+'-15T12:00:00')):s.year;
  const byAlbum=new Map(),artists=new Set();
  entries.forEach(e=>{const a=ctx.album(e.albumId);if(!a)return;byAlbum.set(a.id,(byAlbum.get(a.id)||0)+1);(a.artists||[{id:a.artistId}]).forEach(v=>artists.add(v.id))});
  const qh=quote?Math.min(h*.17,135):0,main=h-qh;
  fit(p,s.title,x,y,w,main*.13,{size:65,color:t.ink});
  if(monthly){
    fit(p,period,x,y+main*.14,w,main*.16,{size:81,color:t.ink,font:serif,weight:400});
    const gy=y+main*.34,chartH=main*.36,days=new Date(Number(s.month.slice(0,4)),Number(s.month.slice(5)),0).getDate(),counts=Array(days).fill(0);
    entries.forEach(e=>counts[Number(e.date.slice(8))-1]++);
    const max=Math.max(1,...counts),unit=w/days;
    counts.forEach((n,i)=>{const bh=Math.max(3,chartH*n/max);rect(p,x+i*unit,gy+chartH-bh,Math.max(3,unit-5),bh,t.accent)});
    label(p,'01',x,gy+chartH+7,20,t.ink);label(p,String(days),x+w-29,gy+chartH+7,20,t.ink);
    fit(p,entries.length+' escuta'+(entries.length===1?'':'s')+'  /  '+byAlbum.size+' disco'+(byAlbum.size===1?'':'s'),x,y+main*.81,w,main*.17,{size:60,color:t.ink});
  }else{
    const bx=x,by=y+main*.17,bw=w*.52,bh=main*.78;rect(p,bx,by,bw,bh,t.accent);
    fit(p,period,bx+20,by+24,bw-40,bh*.25,{size:135,color:t.onAccent});
    p.save();p.beginPath();p.rect(bx,by+bh*.31,bw,bh*.69);p.clip();grooves(p,bx+bw*.5,by+bh*.92,bw*.56,t.onAccent);p.restore();
    const scores=entries.flatMap(entry=>entry.rating==null?[]:[entry.rating]);
    const mean=scores.length?(scores.reduce((sum,score)=>sum+score,0)/scores.length).toLocaleString('pt-BR',{maximumFractionDigits:1}):'—';
    const stats=[[entries.length,'escutas'],[byAlbum.size,'discos'],[artists.size,'artistas'],[mean,'nota média']];
    const xx=bx+bw+35,ww=w-bw-35,row=bh/stats.length;
    stats.forEach(([n,name],i)=>{
      const yy=by+i*row;
      rule(p,xx,yy,ww,t.ink);
      fit(p,String(n),xx,yy+6,ww,row*.55,{size:86,color:t.ink});
      fit(p,name,xx,yy+row*.63,ww,row*.32,{size:28,color:t.ink,font:sans,weight:400});
    });
  }
  if(quote)fit(p,quote,x,y+h-qh+6,w,qh-6,{size:30,color:t.ink,font:serif,weight:400});
}


function instagramPage(ctx,entryId){
  const entry=ctx.s.entries.find(e=>e.id===entryId);
  if(!entry||!ctx.album(entry.albumId))return '<section class="wrap inner empty"><h1>Registro indisponível</h1><p>Abra uma escuta à qual você tenha acesso para criar seu Story.</p><a class="btn" href="/diario">Abrir diário</a></section>';
  return `<section class="wrap inner st-root ig-root" id="studio" data-destination="instagram"><header class="st-heading"><h1>Instagram Stories</h1></header><div class="st-space"><figure class="st-preview ig-preview"><div class="st-proof"><canvas width="1080" height="1920" id="st-canvas" aria-label="Prévia do Story"></canvas></div><figcaption class="st-caption"><span>Prévia do Story</span><span>1080 × 1920 px</span></figcaption></figure><section class="st-panel ig-panel" aria-label="Compartilhar o Story"><p class="st-note" id="ig-art-note"></p><div class="ig-actions"><button type="button" class="btn primary" id="ig-share" disabled hidden>${ctx.icon('share',18)} Compartilhar pelo dispositivo</button><button type="button" class="btn primary" id="ig-download" disabled>${ctx.icon('down',18)} Baixar PNG</button></div><p class="ig-guidance" id="ig-instructions"></p><p id="ig-status" role="status">Preparando a imagem…</p></section></div></section>`;
}

// Reduz a capa a uma pequena grade, aplica três passagens de desfoque separável e amplia.
// O bitmap exportado recebe o mesmo fundo em navegadores sem CanvasRenderingContext2D.filter.
function blurredCover(img){
  const bitmap=document.createElement('canvas'),w=54,h=96;
  bitmap.width=w;bitmap.height=h;
  const ctx=bitmap.getContext('2d',{willReadFrequently:true}),scale=Math.max(w/img.width,h/img.height);
  ctx.drawImage(img,(w-img.width*scale)/2,(h-img.height*scale)/2,img.width*scale,img.height*scale);
  const data=ctx.getImageData(0,0,w,h),temp=new Uint8ClampedArray(data.data.length);
  for(let pass=0;pass<6;pass++){
    const input=pass%2?temp:data.data,output=pass%2?data.data:temp;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const offset=4*(y*w+x);
      for(let channel=0;channel<3;channel++){
        let sum=0;
        for(let k=-3;k<=3;k++){
          const sx=pass%2?x:Math.max(0,Math.min(w-1,x+k));
          const sy=pass%2?Math.max(0,Math.min(h-1,y+k)):y;
          sum+=input[4*(sy*w+sx)+channel];
        }
        output[offset+channel]=sum/7;
      }
      output[offset+3]=255;
    }
  }
  ctx.putImageData(data,0,0);
  return bitmap;
}
function drawInstagram(canvas,entry,album,owner,picture){
  storyArt(canvas,album.tracks.find(t=>t.id===entry.trackId)?.title||album.title,entry.rating||0,picture,album.title,album);
}
function storyArt(canvas,title,rating,picture,placeholder,album){
  const p=canvas.getContext('2d'),W=1080,H=canvas.height,story=H===1920;
  const top=story?150:64,ink='#ffffff';
  const tema=temaDoAlbum(album);
  const titleFont=tema.fontes.titulo||display;
  const bodyFont=tema.fontes.texto||sans;
  const caseMode=tema.composicao?.caixaTitulo||'normal';
  const toCase=t=>caseMode==='minusculas'?t.toLocaleLowerCase('pt-BR'):caseMode==='maiusculas'?t.toLocaleUpperCase('pt-BR'):t;
  rect(p,0,0,W,H,'#161813');
  if(!picture){const neutral=p.createLinearGradient(0,0,W,H);neutral.addColorStop(0,'#3a4148');neutral.addColorStop(.55,'#252c31');neutral.addColorStop(1,'#171d23');p.fillStyle=neutral;p.fillRect(0,0,W,H);}
  if(picture){
    const background=blurredCover(picture),bp=background.getContext('2d');
    const pixels=bp.getImageData(0,0,54,96).data;
    let light=0;for(let i=0;i<pixels.length;i+=4)light+=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];
    light/=pixels.length/4*255;
    p.imageSmoothingEnabled=true;p.imageSmoothingQuality='high';
    p.drawImage(background,0,0,W,H);
    rect(p,0,0,W,H,'rgba(6,7,5,'+(.25+light*.35)+')');
  }
  // Marca CAPA no topo, discreta, sem competir com a capa.
  // Mesmo desenho vetorial da marca oficial em ui.js.
  p.save();p.translate(96,top+46);p.scale(1.12,1.12);p.strokeStyle=ink;p.lineWidth=3.6;
  for(const path of ['M25 6a16 16 0 1 0 0 32','M30 9a13 13 0 1 0 0 26','M35 13a9 9 0 1 0 0 18'])p.stroke(new Path2D(path));
  label(p,'capa.',54,0,40,ink,titleFont,700);p.restore();
  // Título se ajusta antes de posicionar o conjunto; estrelas ficam sempre próximas.
  let size=50,lines=[];
  do{p.font='700 '+size+'px '+titleFont;lines=linesFor(p,toCase(title),864);if(lines.length*size*1.12<=172)break;size--;}while(size>14);
  const titleHeight=lines.length*size*1.12,coverSize=story?756:H===1350?700:420,radius=16;
  const totalHeight=coverSize+38+titleHeight+(rating?46+88+26+48:0);
  const coverX=(W-coverSize)/2,coverY=(H===1080?H/2+50:H/2)-totalHeight/2;
  p.save();p.shadowColor='rgba(0,0,0,.34)';p.shadowBlur=38;p.shadowOffsetY=18;
  p.fillStyle='#252720';p.beginPath();p.roundRect(coverX,coverY,coverSize,coverSize,radius);p.fill();p.restore();
  p.save();p.beginPath();p.roundRect(coverX,coverY,coverSize,coverSize,radius);p.clip();
  if(picture){
    const scale=Math.max(coverSize/picture.width,coverSize/picture.height);
    p.drawImage(picture,coverX+(coverSize-picture.width*scale)/2,coverY+(coverSize-picture.height*scale)/2,picture.width*scale,picture.height*scale);
  }else{
    rect(p,coverX,coverY,coverSize,coverSize,'#323b43');
    let fallbackSize=Math.min(68,coverSize*.12),fallbackHeight;
    do{p.font='700 '+fallbackSize+'px '+titleFont;fallbackHeight=linesFor(p,toCase(placeholder),coverSize-112).length*fallbackSize*1.12;if(fallbackHeight<=coverSize*.5)break;fallbackSize--;}while(fallbackSize>14);
    fit(p,toCase(placeholder),coverX+56,coverY+(coverSize-fallbackHeight)/2,coverSize-112,fallbackHeight,{size:fallbackSize,color:'#e4e8eb',align:'centro'});
  }
  p.restore();
  const titleY=coverY+coverSize+38;
  fit(p,toCase(title),108,titleY,864,titleHeight,{size,color:ink,font:titleFont,leading:1.12,align:'centro'});
  if(rating){
    for(let i=0;i<5;i++)star(p,W/2+(i-2)*110,titleY+titleHeight+46+44,44,rating-i,ink,'rgba(255,255,255,.08)');
    p.save();p.textAlign='center';label(p,rating.toLocaleString('pt-BR',{maximumFractionDigits:1})+'/5',W/2,titleY+titleHeight+46+88+26,42,'rgba(255,255,255,.92)',bodyFont,700);p.restore();
  }
  canvas.dataset.cover=picture?'official':'editorial';
  canvas.setAttribute('aria-label',[title,rating?rating.toLocaleString('pt-BR')+' de 5 estrelas':'Sem nota',picture?'Capa do lançamento':'Arte editorial sem capa oficial'].join(' · '));
}

async function bindInstagram(ctx,root){
  const entry=ctx.s.entries.find(e=>e.id===new URLSearchParams(location.search).get('entry'));
  if(!entry)return;
  const album=ctx.album(entry.albumId),canvas=root.querySelector('canvas'),share=root.querySelector('#ig-share');
  const save=root.querySelector('#ig-download'),status=root.querySelector('#ig-status'),guidance=root.querySelector('#ig-instructions');
  const note=root.querySelector('#ig-art-note');
  const manual='Baixe o PNG. No celular, abra o Instagram, crie um Story e escolha a imagem na galeria.';
  let revision=0;
  async function prepare(selectedAlbum=album){
    const current=++revision;save.disabled=true;share.disabled=true;
    status.textContent='Carregando capa…';canvas.hidden=true;note.textContent='';root.dataset.coverState='carregando';
    try{
      const {image,message,status:coverState,creditAlbum}=await storyCover(selectedAlbum,{report:(text,state)=>{if(current===revision&&root.isConnected){status.textContent=text;root.dataset.coverState=state;}}});
      await garantirFontes({fontes:{carregar:[['700 50px Bricolage'],['400 28px Instrument']]}});
      const temaIg=temaDoAlbum(selectedAlbum);const fs=temaIg.fontes.carregar||[];await garantirFontes({fontes:{carregar:[...fs,['400 28px Instrument']]}});
    if(current!==revision||!root.isConnected)return;
      note.textContent=message;
      drawInstagram(canvas,entry,album,author(ctx,entry.userId),image);canvas.hidden=false;root.dataset.coverState=coverState;
      const raw=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!raw)throw new Error('PNG indisponível');
      const png=await withCredits(raw,creditAlbum?[creditAlbum]:[],'Fundo desfocado derivado da capa.');
      if(current!==revision||!root.isConnected)return;
      const name='capa-story-'+entry.id+'.png',file=typeof File==='function'?new File([png],name,{type:'image/png'}):null;
      const shareable=canShareFile(file);
      share.hidden=typeof navigator.share!=='function';share.disabled=!shareable;save.disabled=false;
      save.classList.toggle('primary',!shareable);
      guidance.textContent=shareable?'Toque em Compartilhar e escolha Instagram no menu do dispositivo.':!window.isSecureContext?'O navegador exige HTTPS para abrir o menu de compartilhamento. Acesse por uma conexão HTTPS para enviar ao Instagram.':manual;
      status.textContent=image?'Capa encontrada. Imagem pronta para compartilhar.':'Arte editorial pronta para compartilhar.';
      save.onclick=()=>{downloadFile(png,name);status.textContent='Download solicitado.';guidance.textContent=manual;};
      share.onclick=async()=>{
        share.disabled=true;
        try{
          const result=await shareFile(file);
          if(result==='unavailable'){status.textContent='O compartilhamento de arquivos está indisponível neste navegador.';guidance.textContent=window.isSecureContext?manual:'Abra o CAPA por HTTPS para compartilhar diretamente pelo menu do dispositivo.';save.focus();}
          else if(result==='cancelled')status.textContent='Compartilhamento cancelado. Sua arte continua disponível.';
          else status.textContent='O envio continua no aplicativo escolhido.';
        }finally{if(current===revision)share.disabled=false;}
      };
    }catch{if(current===revision)status.textContent='Não foi possível gerar o Story. Tente novamente.';}
  }
  const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Preparar novamente';
  retry.onclick=()=>prepare(chosen);root.querySelector('.ig-panel').append(retry);
  let chosen=album;
  const editionButton=document.createElement('button');editionButton.type='button';editionButton.className='btn';editionButton.textContent='Escolher capa de outra edição';
  const editionBox=document.createElement('div');editionBox.className='ig-editions';
  root.querySelector('.ig-panel').append(editionButton,editionBox);
  const releaseId=album.releaseId||album.source?.match(/musicbrainz\.org\/release\/([a-f0-9-]{36})/)?.[1];
  editionButton.hidden=!releaseId&&!album.groupId;
  let groupId=album.groupId,editionPage=1,versions=new Map();
  editionButton.onclick=async()=>{
    editionButton.disabled=true;
    try{
      if(!groupId){const data=await ctx.api('/catalog/releases/'+releaseId+'?enrich=1');groupId=data.album.groupId;}
      if(!groupId)throw new Error('A fonte ainda não relacionou esta edição a um lançamento.');
      const data=await ctx.api('/catalog/groups/'+groupId+'/versions?page='+editionPage);
      for(const v of data.versions||[])versions.set(v.mbid,v);
      editionBox.innerHTML='<label class="field">Capa da edição<select id="ig-edition"><option value="">Edição avaliada</option>'+[...versions.values()].filter(v=>v.status==='Official'&&v.hasCover).map(v=>'<option value="'+ctx.esc(v.mbid)+'">'+ctx.esc([v.title,v.disambiguation,v.date,v.country,v.format].filter(Boolean).join(' · '))+'</option>').join('')+'</select></label><p class="st-note">A escolha muda a arte. Sua nota continua vinculada à edição avaliada.</p>';
      const select=editionBox.querySelector('select');select.value=chosen===album?'':chosen.releaseId;
      select.onchange=async()=>{
        select.disabled=true;save.disabled=true;share.disabled=true;
        try{
          const data=select.value?await ctx.api('/catalog/releases/'+encodeURIComponent(select.value)):null;
          if(data&&data.album.groupId!==groupId)throw new Error('A capa não pertence a este lançamento.');
          chosen=data?.album||album;await prepare(chosen);
        }catch(error){status.textContent=error.message;select.value=chosen===album?'':chosen.releaseId;await prepare(chosen);}
        finally{select.disabled=false;}
      };
      if(data.next){editionPage=data.next;editionButton.textContent='Carregar mais edições';}
      else editionButton.hidden=true;
      if(![...versions.values()].some(v=>v.status==='Official'&&v.hasCover))editionBox.append('Nenhuma outra edição oficial com capa foi confirmada nesta consulta.');
    }catch(error){editionBox.textContent=error.message;}
    finally{editionButton.disabled=false;}
  };
  await prepare();
}

async function mountLocalComposer(ctx,root){
  const canvas=root.querySelector('#st-canvas'),select=root.querySelector('#local-album'),fileInput=root.querySelector('#local-cover'),status=root.querySelector('#local-status'),download=root.querySelector('#local-download');
  let custom=null,objectUrl=null,revision=0,png=null;
  async function draw(){
    const current=++revision;download.disabled=true;canvas.hidden=true;status.textContent='Preparando composição local…';
    const album=ctx.album(select.value);let picture=custom;
    if(!picture){try{const result=await storyCover(album,{localPreview:true});picture=result.image;if(!picture)status.textContent='A imagem do catálogo não carregou. Escolha um arquivo local.';}catch{}}
    if(!root.isConnected||current!==revision)return;
    canvas.width=1080;canvas.height=1920;drawInstagram(canvas,{trackId:null,rating:4.5},album,null,picture);canvas.hidden=false;
    png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!root.isConnected||current!==revision)return;
    download.disabled=!png;if(picture)status.textContent='Imagem exibida somente nesta composição local. A imagem original não foi enviada ao servidor.';
  }
  select.onchange=()=>{custom=null;draw()};
  fileInput.onchange=async()=>{
    const file=fileInput.files?.[0];if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)){status.textContent='Escolha uma imagem PNG, JPEG ou WebP.';return}
    if(file.size>20*1024*1024){status.textContent='A imagem deve ter até 20 MB.';return}
    if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);
    const image=new Image();image.onload=()=>{custom=image;draw()};image.onerror=()=>{status.textContent='Não foi possível abrir essa imagem.'};image.src=objectUrl;
  };
  download.onclick=()=>{if(!png)return;const link=document.createElement('a');link.href=URL.createObjectURL(png);link.download='capa-composicao-local.png';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)};
  draw();
}

export async function bindLocalComposer(ctx,root){return mountLocalComposer(ctx,root)}
export function localComposerPage(ctx,query=new URLSearchParams(location.search)){return renderLocalComposerPage(ctx,query)}

