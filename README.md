# CAPA

Rede social brasileira para descobrir, avaliar, catalogar e compartilhar música. O CAPA registra a relação das pessoas com a música — como o Letterboxd faz com o cinema — e transforma avaliações em artes prontas para o Instagram.

Não é serviço de streaming: o foco é descoberta, opinião, coleção, crítica e comunidade.

## Executar

Requisitos: Node.js 24 (usa `node:sqlite`). Sem build, sem dependências externas.

```powershell
npm start              # http://127.0.0.1:3000
npm run dev            # recarrega ao salvar
```

Variáveis de ambiente em `docs/OPERACAO.md`. `MUSICBRAINZ_CONTACT` (e-mail ou URL HTTPS do responsável) habilita a busca e a importação de discos do MusicBrainz; sem ela, o acervo local continua disponível.

## O que existe hoje

- **Descoberta pública** antes do cadastro: catálogo inicial com 14 lançamentos e 148 faixas, ampliável com edições do MusicBrainz.
- **Avaliações** de 0,5 a 5 estrelas em discos e faixas, com crítica editável, favorito, data de escuta e visibilidade pública ou privada. Média da comunidade calculada sobre contribuições reais.
- **Diário musical** com escutas repetidas, filtros por data, mês, artista, disco e nota.
- **Perfis** com quatro discos favoritos, artistas favoritos, seguidores, estatísticas e link público com metadados Open Graph.
- **Comunidade**: seguidores, curtidas, comentários, listas, rankings, batalha de discos, bloqueio e denúncia com fila de moderação.
- **Estúdio de compartilhamento**: seis modelos (crítica de disco, editorial, ranking de faixas, discos favoritos, resumo mensal, ano em música) em três formatos (1080×1080, 1080×1350, 1080×1920), extração de paleta da capa, créditos embutidos no PNG, download e Web Share API. Listas preservam discos e faixas na ordem original, em páginas exportáveis.
- **Identidade visual por álbum** (`references/album-identities/`): BRAT, Sweetener e Positions com dossiês pesquisados, fontes licenciadas e três níveis de resolução (personalizada, semiautomática, padrão).
- **PWA** instalável com service worker e página offline.

## Estrutura

```
src/            servidor Node: rotas, banco, catálogo, moderação, backup
public/         frontend em módulos ES (app, discover, social, studio, identidades)
data/           banco SQLite (criado na primeira execução; fora do git)
references/     análise do Letterboxd e identidades visuais de álbuns
skills/         skills locais (+ manifestos em .agents/skills/)
docs/           arquitetura, design system, operação, progresso, pesquisa
tests/          suíte de API (node --test) e testes de navegador (Playwright)
```

## Testes

```powershell
npm test
& "..\SKILLS PARA O CODEX\.venv\Scripts\python.exe" tests\social_browser.py
& "..\SKILLS PARA O CODEX\.venv\Scripts\python.exe" tests\estudio_browser.py
```

Os dois testes de navegador acima iniciam servidores locais e bancos temporários. Instale Playwright e Chromium se usar outro ambiente Python. Para executar `tests/identidades_browser.py` e gerar as ilustrações de `tests/screenshots_identidades.py`, inicie antes o CAPA em `http://127.0.0.1:3000`.

## Documentação

Comece por `docs/PROGRESSO.md` e `docs/ARQUITETURA.md`. Decisões visuais passam por `docs/DESIGN_SYSTEM.md` e por `references/`. `AGENTS.md` orienta novas sessões de desenvolvimento.
