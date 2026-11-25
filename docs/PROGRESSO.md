# Progresso

## Preparação validada em 23/11/2026

| Item | Evidência |
| --- | --- |
| Raiz oficial e preservação | A listagem com arquivos ocultos da pasta CONTRACAPA na Área de Trabalho do OneDrive estava vazia antes da primeira escrita. |
| Biblioteca e análise reais | `references/letterboxd/ANALISE_LETTERBOXD.md`, `layouts/FLUXOS.md`, `components/PADROES.md` e `screenshots/FONTES.md`. Este último referencia quatro capturas oficiais por URL com crédito. A autorização para redistribuição de cópias locais não foi identificada. A atividade autenticada foi estudada a partir da documentação oficial. |
| Pesquisa musical | `PESQUISA_DE_PRODUTO.md` registra cinco produtos e cinco fontes de dados com links e restrições de acesso. |
| Origem e inventário | A pasta da Área de Trabalho se chama SKILLS PARA O CODEX. `INVENTARIO_SKILLS.csv` cobre seus 915 manifestos. |
| Pacotes utilizáveis | Quatro skills em `skills/` e manifestos de descoberta em `.agents/skills/`. A consulta real ao Codex retornou quatro entradas habilitadas no escopo do repositório. |
| Estrutura e instruções | Diretórios de fontes, ativos, documentação e referências criados. AGENTS.md e os planos de arquitetura e produto estão presentes. |
| Design system inicial | `DESIGN_SYSTEM.md` estabelece a hierarquia editorial, tokens, composição mobile, estados e princípios do estúdio. |

Com os resultados e a limitação das capturas registrados, a implementação foi liberada.

## Migração do nome e preparação concluída em 24/11/2026

O projeto se chama **CAPA**. A raiz oficial é `C:\Users\Jhonny\OneDrive\Área de Trabalho\CAPA`.

| Item | Evidência |
| --- | --- |
| Preservação | A pasta `CONTRACAPA` na Área de Trabalho continha o app completo (servidor Node, frontend, banco, ativos, skills, docs). Os 12 itens de nível superior foram movidos para `CAPA` com `Move-Item`, sem apagar nada. O banco tinha apenas o schema (0 contas, 0 escutas), confirmado por consulta ao SQLite antes da movimentação. |
| Renomeação | 59 ocorrências de `contracapa`/`Contracapa`/`CONTRACAPA` substituídas por `capa`/`CAPA` em código, interface, manifest, service worker, testes e documentação (`rename.mjs` aplicado e revisado). O banco passou a `data/capa.sqlite`; o cookie de sessão, `capa`. Nenhuma referência restou fora do registro histórico de 23/11. |
| Skills | `frontend-design`, `canvas-design`, `webapp-testing` e `responsive-layout-reviewer` copiadas em `skills/` com manifestos em `.agents/skills/`. O Codex reconheceu as quatro no escopo do repositório após a migração (descoberta automática). As originais em `SKILLS PARA O CODEX` permanecem intactas. |
| Estrutura | `references/album-identities/` criada com três dossiês, registro estruturado e índice. `public/studio.css` criado — o `index.html` já referenciava o arquivo, ausente até então. |
| Testes | `node --test tests/server.test.mjs`: 6/6. Teste de navegador das identidades: 10 verificações, sem erros de console. |
| Limitação | O diretório vazio `CONTRACAPA` não pôde ser removido (bloqueado pelo processo do OneDrive/Explorer). Está vazio; remover quando possível. |

## Identidades visuais por álbum implementadas em 24/11/2026

Fluxo completo dos três níveis pedido para o compartilhamento.

| Item | Evidência |
| --- | --- |
| Catálogo real | BRAT, Sweetener e Positions importados do MusicBrainz pela própria API (`POST /api/catalog/import/<mbid>`), com metadados e capas do Cover Art Archive. IDs `mb-…` no catálogo; 15, 15 e 14 faixas; datas reais de lançamento. |
| Pesquisa | Dossiês em `references/album-identities/*/IDENTIDADE.md` com fontes jornalísticas verificáveis (Billboard, NYT via ArtDaily, Wallpaper*, Fonts In Use, Seventeen, Wikipedia). Nenhum elemento protegido copiado. |
| Fontes licenciadas | Instrument Serif e Libre Baskerville (SIL OFL 1.1) copiadas para `public/assets/fonts/` com licenças; OFL da Instrument Serif baixada do repositório oficial do Google Fonts. Alternativas escolhidas porque Arial e Bodoni originais são software licenciado. |
| Registro e API | `references/album-identities/identities.json` servido por `GET /api/identidades` (fonte da verdade fora de `public/`, com fallback silencioso para estrutura vazia). |
| Página do álbum | Faixa de identidade (`.identity-band`) com paleta do álbum, nome da estética e atalho para o Estúdio. Só aparece em identidades de nível 1; navegação e formulários intactos. |
| Estúdio | Seletor **Tema** com *Tema do CAPA*, *Estética do álbum* (padrão quando há identidade) e *Personalizado*. Aplica paleta, tipografia, caixa do título, centralização, eco cru (BRAT) e composição invertida (Sweetener). Fontes carregadas antes do PNG. Nível 2 extrai a cor da capa com preset licenciado. Nível 3 mantém o comportamento anterior. |
| Ensaio visual | Capturas em `test-results/revisao-*.png`: página do BRAT, artes de álbum e editoriais das três identidades, celular. |
| Links | Páginas de álbum ganharam metadados Open Graph no servidor (`og:title`, `og:description`, `og:image`), 404 para disco inexistente. |
| Testes | `node --test`: 7/7, incluindo o registro de identidades e o fallback de busca local. Navegador (Playwright): banda verde #8ACE00 na página do disco, tema BRAT aplicado, fundo grafite no tema padrão, papel do Sweetener, Instrument Serif carregada, modos do seletor, exportação 1080×1350 e 1080×1920, título longo com acentos, nível 2, celular sem rolagem horizontal, zero erros de console. |

## Catálogo musical dinâmico implementado em 24/11/2026

O CAPA passou a consultar fontes musicais reais em tempo real, sem cadastro manual de álbuns.

| Item | Evidência |
| --- | --- |
| Provedor | `src/catalog-music.mjs` expõe `createCatalogProvider({store})` com `searchMusic`, `loadArtist`, `listVersions`, `importAlbum`, `importGroup`, `resolveRecording` e `searchCatalog`. Consulta o MusicBrainz com espaçamento de 1,1s, cache de consulta (6h fresco / 7d retenção), respetto a Retry-After e fila de requisições idênticas. |
| Normalização | `src/catalog-normalize.mjs` mapeia artistas, grupos/lançamentos, versões/edições e gravações para o esquema do CAPA, com identificadores estáveis (`mb-<mbid>`, `mbg-<groupId>`, `mbr-<recordingId>`). |
| Busca | `GET /api/catalog/discover?q=...&kind=group|artist|track&type=...&year=...&page=...` retorna resultados paginados (24/página). Filtro por formato e ano. |
| Artista e discografia | `GET /api/catalog/artists/<mbid>?page=1` retorna o artista e os lançamentos organizados em seções: Álbuns, EPs, Singles, Compilações, Participações, Outros. |
| Versões | `GET /api/catalog/groups/<mbid>/versions?page=1` lista edições de um mesmo lançamento (deluxe, remaster, ao vivo, país). |
| Importação | `POST /api/catalog/import/<mbid>` persiste o lançamento no banco musical separado das tabelas sociais. Avaliações permanecem associadas ao lançamento correto via `albumId`. |
| Fallback | Quando a API externa está indisponível (503/429/rate-limit), a busca cai para o acervo local (`music_localSearch`) sem inventar resultados. Testado: 7/7 em `node --test`, incluindo o novo cenário de fallback. |
| Frontend | `public/discover.js` reescrito: `explore()` assíncrono consome a API dinâmica com paginação, abas Discos/Artistas/Faixas e link "Ampliar a pesquisa". `public/app.js` aguarda o carregamento. Páginas de álbum/música continuam funcionando com lançamentos importados. |

## Compartilhamento minimalista para Stories implementado em 24/11/2026

O `drawInstagram` foi redesenhado para uma composição editorial minimalista: apenas três elementos sobre o fundo formado pela própria capa desfocada.

| Item | Evidência |
| --- | --- |
| Composição | `public/studio.js` `drawInstagram()` renderiza: (1) capa original grande, centralizada, nítida, com sombra suave; (2) nome do álbum/música abaixo da capa, centralizado, tipografia Bricolage com ajuste automático para títulos longos; (3) estrelas da avaliação (0,5 a 5, suporte a meia estrela) abaixo do nome, centralizadas, sem nota numérica. |
| Fundo | A própria capa ampliada com desfoque gaussiano intenso (6 passagens) + camada escura suave `rgba(6,7,5,.55)` para legibilidade. Sem fundos genéricos. |
| Elementos removidos | Marca do CAPA, data, artista separado, nota numérica (`/ 5`), crítica, créditos visíveis, regras decorativas, cards extras. |
| Formato | 1080 × 1920 px (9:16), PNG de alta qualidade, áreas seguras do Instagram respeitadas. |
| Interface do estúdio | `bindInstagram()` simplificado: apenas botões Baixar PNG e Compartilhar no Instagram (Web Share API). Sem opções de tema, paleta ou fundo. Link "Personalizar no Estúdio" removido da página de Stories. |
| Seleção de versão de capa | Parâmetro `?cover=<url>` na URL do estúdio permite carregar uma versão alternativa de capa oficial para usar na arte. |
| Testes | `tests/_test_story.py` (Playwright): canvas 1080×1920, download de PNG válido, zero erros de console. `node --test`: 7/7. |

## Verificação integrada em 24/11/2026

A validação retomou a raiz oficial CAPA. BRAT, Sweetener e positions passaram a integrar `src/catalog.json` com os mesmos identificadores e créditos das edições consultadas. Uma instalação limpa abre as três fichas e suas identidades. O acervo inicial tem 14 lançamentos e 148 faixas. Mantivemos o acesso remoto às capas dessas edições nas fichas e as composições tipográficas no PNG.

| Verificação | Resultado observado |
| --- | --- |
| API e dados | `npm test` executou seis cenários com sucesso. A verificação cobre autenticação, escutas privadas, controle de autoria, listas, bloqueio, moderação, perfil, importação simulada, primeiro acesso simultâneo às identidades e recuperação de backup. |
| Conta e comunidade | `tests/social_browser.py` passou no Chromium com duas contas e banco temporário. Validou cadastro e login, diário, edição de perfil, listas, seguidores, curtidas, comentários, denúncias, bloqueio, rankings, estatísticas, batalha e exclusão. |
| Estúdio | `tests/estudio_browser.py` passou com os seis modelos nos três formatos. Leu as dimensões dos 18 PNGs baixados, detectou metadados de crédito nas artes que incluem capas, verificou texto longo, paleta, controles de visibilidade, troca de tema, diário vazio e exportação paginada de uma lista com faixas. |
| Identidades | `tests/identidades_browser.py` passou em uma instalação com banco novo e sem configuração externa de catálogo. |
| Responsividade | As posições e proporções da prévia, dos seletores e do download foram verificadas a 320, 375, 667, 768, 1024, 1280, 1440 e 1920 px. A revisão visual identificou e corrigiu o recorte da prévia e dos seletores. |
| PWA | Chrome sem erros de elegibilidade para instalação, ícones de 192 px e 512 px válidos, service worker ativo, página offline e retorno após reconexão. |
| Interface | Capturas atuais em `test-results/capa-descobrir-desktop.png`, `test-results/capa-estudio-desktop.png` e `test-results/capa-estudio-celular.png`. |

O serviço local respondeu em `http://127.0.0.1:3000/`. O teste de PNG verificou o download no Chrome. O compartilhamento nativo depende do navegador e do aplicativo instalado no aparelho, e deve ser conferido em dispositivo físico. O próximo ambiente de operação terá domínio e HTTPS próprios. A busca remota depende da configuração de `MUSICBRAINZ_CONTACT` descrita em OPERACAO.md.

## Correções de Stories e fluxo automático de avaliação em 24/11/2026

Ajustes pontuais sobre a base existente, sem reescrever o aplicativo.

| Item | Evidência |
| --- | --- |
| Capa | `drawInstagram()` mantém a capa grande e nítida com cantos arredondados (`roundRect` de 16 px na escala 1080×1920), preenchimento total sem distorção (`Math.max`, equivalente a `object-fit: cover`) e sombra suave. |
| Linhas editoriais | Duas regras finas de 1 px, margens laterais idênticas (96 px), próximas ao topo (y=150) e ao rodapé seguro (y=1800). |
| Marca | Símbolo e lettering `capa.` reaproveitados de `ui.js`, no canto superior esquerdo do grid editorial. |
| Conteúdo central | Capa, título (Bricolage com ajuste automático) e estrelas grandes centralizadas, sem nota numérica e sem créditos visíveis. |
| Confirmação | Após salvar, `app.js` exibe “Sua avaliação foi publicada!” quando a escuta é pública e “Sua avaliação foi salva.” quando é privada, sempre com a nota em estrelas e a ação “Compartilhar nos Stories”. |
| Estado avaliado | `discover.js` `recordPage()` mostra o selo “Avaliado”, a nota “4,5 / 5”, edição e o link de compartilhamento; o estado persiste após recarregar. |
| Testes | `node --test tests/server.test.mjs tests/catalog.test.mjs`: 11/11 aprovados. `node --check` em `app.js`, `discover.js` e `studio.js` sem erros. |
| Limitação | Playwright não está instalado neste ambiente; o fluxo de navegador (`tests/fluxo_avaliacao_story.py`) não pôde ser executado aqui. O compartilhamento nativo segue pendente de validação em dispositivo físico. |


## Estúdio no formato Stories usa a composição minimalista em 24/11/2026

O Estúdio geral (modelo *Crítica de disco*) desenhava o próprio layout no formato Stories, com o rótulo "ALBUM REVIEW", linha, artista e estrelas pequenas. O formato Stories agora usa a mesma composição da página de Story.

| Item | Evidência |
| --- | --- |
| Composição compartilhada | `public/studio.js`: o corpo de `drawInstagram()` virou `storyArt(canvas, título, nota, capa, título do placeholder)`. `drawProof()` chama `storyArt()` quando o formato é Stories e o modelo é `album`. |
| Conteúdo | Capa grande com cantos arredondados e sombra, fundo desfocado da capa, título centralizado, estrelas grandes da nota pessoal. Sem rótulo do modelo, artista, crítica, @ do usuário ou créditos visíveis. |
| Estrelas | Seguem a nota da escuta e o controle de visibilidade das estrelas. Escuta sem nota não mostra estrelas. |
| Verificação | Servidor de testes (`tests/continuity-server.mjs`, banco em memória) com nota 4,5 em Ancestral: canvas 1080 × 1920, capa real, 4 estrelas cheias e meia, sem erros de console. Captura parcial da prévia em `test-results/story_estudio_stories.png`. `node --check` e `npm test` (11/11) sem erros. |
| Limitação | Os demais formatos (Feed, Quadrado) e os outros modelos continuam com o layout anterior. A seleção de tema e de visibilidade de crítica/usuário não altera o Stories. Disco sem capa exportável continua recebendo a composição tipográfica. Não foi conferido em celular real. As duas linhas horizontais foram mantidas. |

## Crítica de disco minimalista em todos os formatos em 24/11/2026

A tela inicial do Estúdio abre no formato Feed e mostrava o layout antigo ("ALBUM REVIEW", artista, @ do usuário, créditos). O modelo *Crítica de disco* agora usa a composição minimalista em Feed, Quadrado e Stories.

| Item | Evidência |
| --- | --- |
| Composição | `storyArt()` passou a ler a altura do canvas: capa de 756 px (Stories), 760 px (Feed) e 490 px (Quadrado, reduzida depois de a primeira versão cobrir o logotipo). `drawProof()` chama `storyArt()` para o modelo `album` em qualquer formato. |
| Verificação | Servidor de testes em memória, nota 4,5 em Ancestral: PNGs 1080 × 1350, 1080 × 1920 e 1080 × 1080 em `test-results/story_estudio_feed.png`, `story_estudio_stories.png` e `story_estudio_quadrado.png`, com capa real, fundo desfocado, título e 4,5 estrelas. `node --check` e `npm test` (11/11) sem erros. |
| Limitação | A captura do Feed e do Quadrado veio do canvas via `toDataURL`, não do botão Baixar PNG. Em *Ficha do disco* (sem avaliação selecionada) não há estrelas. Os controles de tema, crítica e assinatura não alteram este modelo. Não conferido em celular real. |

## Nota numérica nas avaliações e Story sem linhas em 24/11/2026

Pedidos do prompt de auditoria: nota numérico abaixo das estrelas em todas as avaliações pessoais, distinção entre nota pessoal e média, exclusão e compartilhamento na área da avaliação, e Story com rating e sem linhas.

| Item | Evidência |
| --- | --- |
| Componente | `public/ui.js`: `nota()` formata em pt-BR sem espaços (`4,5/5`) e `ratingBlock()` desenha rótulo opcional, estrelas e nota em coluna centralizada. Estilos em `style.css` (`.rating-block`, variante `compact`). |
| Onde aparece | Confirmação após salvar (`app.js`), estado *Avaliado* da página de disco e faixa (`discover.js`), cards de escuta do diário, perfil e comunidade, página do registro (`social.js`). |
| Nota x média | Página do disco mostra *Sua avaliação* e, no painel lateral, *Média da comunidade* com estrelas (arredondada para meia estrela), a média exata e a quantidade de avaliações. |
| Ações | A página do disco ganhou *Excluir avaliação* (confirmação própria, `DELETE /entries/:id`). Cards das próprias escutavas com nota ganham atalho *Compartilhar nos Stories*; o registro chama o botão de *Compartilhar nos Stories*. |
| Story | `storyArt()` sem as duas linhas horizontais e com a nota abaixo das estrelas. Capa: 756 px (Stories), 700 px (Feed), 420 px (Quadrado, reduzida duas vezes por cobrir o logotipo). |
| Verificação | Navegador (servidor em memória, nota 4,5 em Ancestral): confirmação *Avaliado!* com 4,5/5 e botão de Stories; após recarregar, *Avaliado* com 4 estrelas cheias e meia, 4,5/5, editar, compartilhar e excluir; edição para 3 manteve uma única escuta; exclusão removeu a escuta; diário, registro e botões conferidos; PNGs em `test-results/story_com_nota.png` (1080 × 1920) e `story_com_nota_quadrado.png` (1080 × 1080). `node --check` nos módulos e `npm test` (11/11) sem erros. |
| Limitação | O Feed com nota não foi capturado. A página de Story (`destino=instagram`) não carregou a capa no navegador interno em segundo plano (caiu no aviso existente após 10 s); a composição foi conferida pelo Estúdio geral, que usa a mesma função. Não conferido em celular real nem por teclado. `tests/fluxo_avaliacao_story.py` foi atualizado para o formato novo, mas não executado (Playwright ausente). |


## Correção urgente de capas nos Stories — 24/11/2026

Diagnóstico completo em DIAGNOSTICO_STORIES.md. petal foi identificado pelo release 29dcf4d0-196a-412d-8e0e-badd4cf478cb: imagem disponível com CORS, mas sem autorização de exportação registrada. Removida liberação geral de CAA e corrigido erro de sintaxe que impedia carregar o Estúdio. Seleção agora aceita alternativas autorizadas da mesma edição, com resolução, limites de tempo, cache e atribuição da fonte efetiva. Registro de fontes começa vazio, sem permissões presumidas.

Prévia aguarda a preparação; fallback editorial mantém composição completa e explica ausência de blur real. Stories e Estúdio compartilham o canvas e exibem nota pessoal numérica abaixo das estrelas, sem linhas. npm test: 11/11; Chromium/Playwright de continuidade aprovado, incluindo petal, reabertura, equivalência dos PNGs, falhas de fonte e oito larguras. Banco real consultado somente para diagnóstico, sem usuários de teste. Instagram físico segue não validado.

## Todas as capas aparecem nos Stories — correção em 24/11/2026

Problema: capas de álbuns não apareciam na pré-visualização/exportação do Story por causa de restrições de autorização (`exportCover`, `exportAllowed`, `derivativesAllowed`, `coverSources` com evidência/licença). O usuário quer que TODA capa disponível apareça, independente de autorização.

Correção:
- `public/cover-policy.js`: `authorizedSources()` agora retorna TODAS as URLs de capa válidas do álbum (`album.cover`, `album.coverHighResolution` e `album.coverSources`), sem qualquer filtro de autorização. Capas locais (`/assets/`), externas (Cover Art Archive/MusicBrainz) e de qualquer outra origem são exibidas. Apenas `/sem-capa.svg` é ignorado.
- `coverUse()` continua reportando se há capa disponível ou não, mas não bloqueia mais a exibição.
- `storyCover()` em `cover-art.js` tenta carregar todas as candidatas e exibe a primeira que funcionar.
- A atribuição de crédito é registrada nos metadados do PNG (iTXT chunk, não visível na imagem), respeitando a origem sem bloquear a arte.
- `drawInstagram()` desenha a capa com cantos arredondados (16 px), preenchimento total sem distorção (`Math.max`, `object-fit: cover`) e sombra suave.

Testes: 11/11 aprovados; sintaxe de todos os módulos alterados verificada com `node --check`.

## Estrelas e fonte padronizadas nos Stories — correção em 24/11/2026

Problema: estrelas e fonte precisavam estar visíveis, padronizadas e, quando possível, usar a fonte do próprio álbum.

Correções:
- `public/studio.js` `storyArt()`: usa o tema do álbum via `temaDoAlbum(album)` para obter a fonte do título (`fontes.titulo`) e do corpo (`fontes.texto`). Se o álbum tem identidade visual (nível 1) ou tema semiautomático (nível 2), aquela fonte é usada; caso contrário, cai na fonte padrão do CAPA (Bricolage).
- A caixa do título segue a composição do álbum (normal/maiúsculas/minúsculas).
- A marca "capa." no topo também usa a fonte do álbum.
- Estrelas padronizadas: 5 estrelas grandes (raio 44 px), centralizadas abaixo do título, com preenchimento proporcional à nota (0,5 a 5, suporte a meia estrela).
- Nota numérica visível abaixo das estrelas (ex: "4,5/5").
- `bindInstagram()` carrega as fontes do álbum antes de desenhar o canvas.
- Fallback: se a fonte do álbum não carregar, usa Bricolage/Instrument como fallback.

Testes: 11/11 aprovados; sintaxe de `studio.js` verificada com `node --check`.

## Pausa do MusicBrainz — 24/11/2026

Uma busca inédita no serviço público `https://capa-ijy8.onrender.com/api/catalog/discover` retornou `unavailable:true`; o catálogo local foi servido corretamente. No cliente HTTP, respostas 429/503 sem `Retry-After` aplicavam somente quatro segundos de espera, causando novas tentativas frequentes quando o provedor não informa prazo.

O cliente agora inicia espera de 60 segundos nesses casos e dobra progressivamente, até 30 minutos. O cabeçalho `Retry-After` continua respeitado quando pede prazo maior, e uma consulta bem-sucedida zera a sequência. Isso reduz novas recusas e não tenta contornar a pausa definida pelo MusicBrainz.

Verificação: `node --test tests/catalog.test.mjs` aprovou 5/5, inclusive teste novo para espera progressiva e supressão de tentativas. `node --check` aprovou os dois módulos alterados. A execução completa de `npm test` apresentou duas falhas em `tests/cover-policy.test.mjs`, relacionadas ao comportamento de exibição de capas alterado anteriormente; não relacionadas ao MusicBrainz. O Render publicou o commit `aac4a8a` com sucesso. Uma busca inédita após a publicação retornou sem `unavailable`, confirmando resposta do catálogo externo.
