# Diagnóstico e correção dos Stories — 24/11/2026

## Causa verificada

O registro real de **petal**, de Ariana Grande, aponta para a edição clean, Digital Media, XW, com data 2026-07-31:
- Álbum CAPA: mb-29dcf4d0-196a-412d-8e0e-badd4cf478cb
- MusicBrainz release: 29dcf4d0-196a-412d-8e0e-badd4cf478cb
- Release group: 2b8f453f-ffd6-4860-8742-7cff1c2feae3
- Artista: f4fdbb4c-e4b7-47a0-b83b-d91bbfcfa387

A URL armazenada é https://coverartarchive.org/release/29dcf4d0-196a-412d-8e0e-badd4cf478cb/front-1200 e exportCover é false. O código interrompia o caminho da imagem antes de carregá-la: o motivo original era autorização ausente, não CSS.

Na consulta desta sessão, os metadados do CAA e a imagem responderam HTTP 200. A imagem redirecionou ao Internet Archive, com Content-Type image/jpeg e Access-Control-Allow-Origin: *. Não havia expiração na URL nem rate limit nessa consulta. Isso verifica disponibilidade e cabeçalho CORS, não concede direitos de exportação. O campo approved do CAA também não é uma licença.

Foi removida a exceção global que liberava qualquer imagem CAA por “uso pessoal”, sem evidência individual. Também foi corrigido um await em função não assíncrona de studio.js, que impedia importar o módulo.

## Fontes e autorização

MusicBrainz identifica o lançamento e CAA fornece a imagem. Não foi encontrada autorização verificável para transformar/exportar a capa desta edição de petal nas fontes consultadas. Sua capa real, portanto, continua indisponível para o PNG; a interface informa que a composição é editorial e que não há blur real sem imagem utilizável.

Referências consultadas:
- [Cover Art Archive](https://musicbrainz.org/doc/Cover_Art_Archive)
- [Diretrizes oficiais do Spotify](https://developer.spotify.com/documentation/design): não tratar acesso à imagem como autorização para recortar, sobrepor ou transformar a arte.
- [Termos da API Discogs](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use): distinguir metadados e conteúdo restrito, incluindo imagens.

Não foi importada imagem protegida de Spotify ou Discogs. Outras edições verificadas são apresentadas para escolha explícita; o sistema não troca silenciosamente o lançamento.

## Implementação

cover-policy.js valida as fontes. cover-art.js tenta a fonte permitida, verifica decodificação e resolução, e consulta fontes alternativas autorizadas da mesma edição. Para CAA, as tentativas 1200/500 permanecem no mesmo release; não há troca automática por release group. Há limites de tempo e caches limitados, incluindo cache de falhas.

GET /api/cover-sources?albumId=... consulta o catálogo e o registro local references/cover-sources.json, sem proxy arbitrário nem concessão pelo cliente. O registro começa vazio: não inventa permissões. Uma entrada em sources requer url HTTPS, releaseId exato (ou albumId para registro sem releaseId), exportAllowed: true, derivativesAllowed: true, license e evidence. Acrescentar credit, licenseUrl, source e expiresAt quando aplicável. A evidência deve registrar autorização real para o uso e transformação, antes de cadastrar. Fontes expiradas ou de outra edição são rejeitadas. O catálogo curado existente mantém exportCover explícito como autorização prévia.

Estados distinguem carregamento, procura de alternativa, capa encontrada, baixa resolução, indisponibilidade e falta de autorização. A prévia fica oculta e os botões desabilitados durante a preparação.

O mesmo canvas gera prévia e PNG. A função compartilhada mantém símbolo CAPA, quadrado arredondado com sombra, título, estrelas pessoais e número. Imagem válida fornece o fundo ampliado/desfocado e contraste, mantendo a capa frontal nítida. Sem imagem permitida, usa quadrado editorial com título centralizado e gradiente neutro, sem simular capa oficial. A origem efetivamente selecionada acompanha os metadados de atribuição.

## Validação

- npm test: 13 testes aprovados, incluindo política de autorização e correspondência de edição.
- node --check: studio.js, cover-art.js e server-routes.mjs aprovados.
- tests/continuity_browser.py executado com Chromium/Playwright e banco em memória: avaliações novas e antigas, álbum e faixa, meias estrelas, persistência, edição, exclusão, falha de salvamento, notas ausentes, edições, PNG e oito larguras de 320 a 1920 px.
- petal testado com os identificadores acima em fixture sem dados pessoais: nenhuma requisição da imagem proibida; aviso editorial; PNG idêntico após recarregar e entre Story e Estúdio.
- Casos visuais incluem brasileiro Ancestral, independente, single, EP Cru sem capa, deluxe em fixture, capas claras/escuras/coloridas e artista popular com capa não autorizada. As fixtures de recuperação de fonte e deluxe são testes controlados, não novas licenças reais.
- Recuperação simulada: primeira fonte 503, alternativa de outro álbum ignorada, fonte autorizada da mesma identidade selecionada e atribuição preservada.
- PNGs inspecionados: test-results/story_album.png e story_petal_diagnosticado.png. Demais capturas em test-results.

Compartilhamento nativo tem contratos de sucesso/cancelamento/falha simulados no navegador; a entrega ao Instagram em aparelho físico ainda não foi validada. A consulta HTTP bem-sucedida ao CAA não foi tratada como teste de exportação autorizada da capa de petal.
