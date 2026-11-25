// Qualquer capa disponível é exibida nos Stories, independentemente de autorização.
// A atribuição de crédito é registrada nos metadados do PNG (não visível na imagem).
const safeUrl=value=>typeof value==='string'&&(/^(https:\/\/)[^\s]+$/.test(value)||/^\/assets\/(?!.*(?:\.\.|\\))[\w/%.()-]+$/i.test(value));
export function authorizedSources(album,{localPreview=false}={}) {
  if(!album)return [];
  const sources=[];
  if(safeUrl(album.cover)&&!album.cover.endsWith('/sem-capa.svg')){
    for(const url of [album.coverHighResolution,album.cover].filter(Boolean).filter(url=>safeUrl(url)))
      sources.push({url,albumId:album.id,releaseId:album.releaseId,credit:album.credit,license:album.license,licenseUrl:album.licenseUrl,source:album.coverSource,primary:true});
  }
  for(const source of album.coverSources||[]){
    if(source.url&&safeUrl(source.url)&&!sources.some(s=>s.url===source.url)){
      sources.push({...source,primary:false});
    }
  }
  return sources;
}
export function coverUse(album,{localPreview=false}={}) {
  if(!album?.cover||album.cover.endsWith('/sem-capa.svg'))return {usable:false,motivo:'sem-capa'};
  if(authorizedSources(album,{localPreview}).length)return {usable:true,motivo:'disponivel'};
  return {usable:false,motivo:'sem-autorizacao'};
}
