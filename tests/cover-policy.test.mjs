import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coverUse,authorizedSources} from '../public/cover-policy.js';
const id='29dcf4d0-196a-412d-8e0e-badd4cf478cb';
const album={id:'mb-'+id,releaseId:id,cover:'https://coverartarchive.org/release/'+id+'/front-1200',exportCover:false};
const grant={url:'/assets/covers/ancestral.jpg',releaseId:id,exportAllowed:true,derivativesAllowed:true,license:'CC BY-SA 3.0',evidence:'https://example.test/license'};
test('CAA aprovado e acessível não equivale a licença; fonte licenciada da mesma edição funciona',()=>{
 assert.equal(coverUse(album).usable,false);
 assert.equal(coverUse({...album,exportCover:true}).usable,true);
 assert.equal(coverUse({...album,cover:'/assets/covers/ancestral.jpg',exportCover:true}).usable,true);
 assert.equal(coverUse({...album,coverSources:[grant]}).usable,true);
});
test('permissão de uma edição nunca se aplica a outra; evidência, derivação e validade são exigidas',()=>{
 for(const invalid of [{...grant,releaseId:'outro'},{...grant,evidence:''},{...grant,derivativesAllowed:false},{...grant,exportAllowed:false},{...grant,expiresAt:'2020-01-01'},{...grant,url:'javascript:alert(1)'},{...grant,url:'https://coverartarchive.org/release/33333333-3333-4333-8333-333333333333/front-1200'}])
   assert.equal(authorizedSources({...album,coverSources:[invalid]}).length,0);
 assert.equal(authorizedSources({...album,coverSources:[grant,grant]}).length,1);
});
