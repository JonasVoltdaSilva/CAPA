import {authorizedSources,coverUse} from './cover-policy.js';

const TIMEOUT=6500,DEADLINE=20000,cache=new Map(),registries=new Map();
function load(url,wait){
  const prior=cache.get(url);if(prior&&prior.until>Date.now())return prior.job;
  const job=new Promise(resolve=>{
    const image=new Image();image.crossOrigin='anonymous';image.decoding='async';
    let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);const item=cache.get(url);if(item)item.until=Date.now()+(value?600000:120000);resolve(value);};
    const timer=setTimeout(()=>{image.src='';finish(null);},wait);
    image.onerror=()=>finish(null);
    image.onload=async()=>{try{await image.decode();}catch{}finish(image.naturalWidth>=128&&image.naturalHeight>=128?image:null);};
    image.src=url;
  });
  cache.set(url,{job,until:Date.now()+600000});if(cache.size>32)cache.delete(cache.keys().next().value);return job;
}
async function lookup(album){
  if(!album.id)return [];
  const cached=registries.get(album.id);if(cached&&cached.until>Date.now())return cached.job;
  const job=fetch('/api/cover-sources?albumId='+encodeURIComponent(album.id),{signal:AbortSignal.timeout(4000)})
    .then(r=>{if(!r.ok)throw Error('Registro indisponível');return r.json();}).then(d=>d.sources||[]).catch(()=>[]);
  registries.set(album.id,{job,until:Date.now()+120000});if(registries.size>64)registries.delete(registries.keys().next().value);return job;
}
function candidates(album){
  const result=[];
  for(const source of authorizedSources(album)){
    const match=/^https:\/\/coverartarchive\.org\/release\/([a-f0-9-]{36})\/front(?:-\d+)?$/.exec(source.url);
    // Somente resoluções da MESMA edição; nunca trocar silenciosamente pelo grupo.
    for(const url of match?['https://coverartarchive.org/release/'+match[1]+'/front-1200',source.url,'https://coverartarchive.org/release/'+match[1]+'/front-500']:[source.url])
      if(!result.some(s=>s.url===url))result.push({...source,url});
  }
  return result;
}
export const coverCandidates=album=>candidates(album).map(s=>s.url);
export async function storyCover(album,{report,lookupSources=lookup,localPreview=false}={}){
  const began=Date.now(),attempts=[],tried=new Set();
  let best=null,chosen=null,known=localPreview?authorizedSources(album,{localPreview}):candidates(album);
  const emit=(state,message)=>report?.(message,state);
  async function attempt(sources){
    for(const source of sources){
      if(tried.has(source.url))continue;
      const left=DEADLINE-(Date.now()-began);if(left<1000)break;
      emit(attempts.length?'buscando':'carregando',attempts.length?'Procurando outra fonte…':'Carregando capa…');
      tried.add(source.url);
      const image=await load(source.url,Math.min(TIMEOUT,left));
      attempts.push({url:source.url,result:image?'carregada':'indisponível, bloqueada por CORS ou pequena demais'});
      if(image&&(!best||Math.min(image.width,image.height)>Math.min(best.width,best.height))){best=image;chosen=source;}
      if(best&&Math.min(best.width,best.height)>=756)return true;
    }
    return false;
  }
  if(!await attempt(known)){
    emit('buscando','Procurando outra fonte…');
    const additional=await lookupSources(album);
    const enriched={...album,coverSources:[...(album.coverSources||[]),...additional]};
    known=candidates(enriched);await attempt(known);
  }
  if(!best){
    const status=known.length?'falhou':coverUse(album).motivo==='sem-capa'?'sem-capa':'sem-autorizacao';
    const headline=status==='sem-autorizacao'?'Imagem sem autorização de exportação.':'Imagem indisponível.';
    const message=headline+' Esta é uma arte editorial, não a capa oficial. Sem uma imagem utilizável, não há fundo desfocado da capa. Você pode consultar outras edições.';
    emit(status,headline);
    return {image:null,status,message,origem:'',attempts,creditAlbum:null};
  }
  const side=Math.min(best.width,best.height),status=side<756?'baixa-resolucao':'pronto';
  emit(status,'Capa encontrada.');
  return {image:best,status,message:side<756?'Capa encontrada em '+best.width+' × '+best.height+' px. O PNG pode ter menos nitidez.':'',
    origem:chosen.url,attempts,
    creditAlbum:{...album,credit:chosen.credit||album.credit,license:chosen.license||album.license,
      licenseUrl:chosen.licenseUrl||album.licenseUrl,coverSource:chosen.source||chosen.evidence||album.coverSource}};
}
