// Verificação opcional com fontes reais; executa somente leitura e respeita Retry-After.
import {createCatalogProvider} from '../src/catalog-music.mjs';
import {writeFile} from 'node:fs/promises';
const provider=createCatalogProvider();
const cases=[
  ['brasileiro','Milton Nascimento',{kind:'artist'}],
  ['internacional','Björk',{kind:'artist'}],
  ['independente','Sertanília',{kind:'artist'}],
  ['antigo','Kind of Blue',{kind:'group'}],
  ['recente','',{kind:'group',year:'2026',type:'Álbum'}],
  ['ep','Liniker',{kind:'group',type:'EP'}],
  ['single','Espresso',{kind:'group',type:'Single'}],
  ['deluxe','brat deluxe',{kind:'group'}],
  ['faixa','Garota de Ipanema',{kind:'track'}]
];
const report=[];let pause=0;
for(const [category,q,options] of cases){
  if(pause>15000){report.push({category,q,skipped:'Aguardando prazo solicitado pelo provedor'});continue;}
  if(pause)await new Promise(resolve=>setTimeout(resolve,pause));
  try{const data=await provider.searchMusic(q,options);report.push({category,q,total:data.total,first:data.results[0]?.title});pause=0;}
  catch(error){pause=(error.retryAfter||1)*1000+100;report.push({category,q,error:error.message,retryAfter:error.retryAfter});}
  console.log(JSON.stringify(report.at(-1)));
}
await writeFile('test-results/catalogo-real.json',JSON.stringify(report,null,2)+'\n');
