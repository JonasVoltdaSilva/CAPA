# Trabalhar no CAPA

Use esta raiz (`…/OneDrive/Área de Trabalho/CAPA`) para código, documentação e referências. Comece por `docs/PROGRESSO.md` e `docs/ARQUITETURA.md`. Examine os arquivos existentes antes de editar. Preserve as fontes originais da Área de Trabalho (`SKILLS PARA O CODEX`) e a pasta antiga `CONTRACAPA` vazia não é mais necessária; nenhum dado foi apagado na migração.

Consulte `references/letterboxd/ANALISE_LETTERBOXD.md`, `docs/PESQUISA_DE_PRODUTO.md` e `docs/DESIGN_SYSTEM.md` antes de decisões visuais importantes. A marca, o texto e a composição são do CAPA. Use as skills locais indicadas em `docs/SKILLS_UTILIZADAS.md`.

Desenvolva primeiro para toque, teclado e telas pequenas. Mantenha textos em português brasileiro, preserve o contraste e ofereça recuperação de erros. Separe catálogo, persistência, interação e apresentação. Respeite a edição, a licença e a origem de cada disco. Médias e retrospectivas derivam de escutas persistidas.

## Instruções permanentes

1. Trabalhe apenas dentro desta pasta. Não crie projetos paralelos nem apague arquivos existentes.
2. Consulte as referências (`references/letterboxd/` e `references/album-identities/`) antes de decisões visuais importantes.
3. Utilize as skills pertinentes (`skills/` e os manifestos em `.agents/skills/`) de forma efetiva, não apenas as liste.
4. Preserve o design system: tokens em `public/style.css` conforme `docs/DESIGN_SYSTEM.md`. Identidades de álbum personalizam áreas específicas, nunca a navegação nem os formulários.
5. Priorize a experiência mobile: toque, foco visível, alvos de 44 px, leitura em telas estreitas.
6. Mantenha o código organizado: catálogo, persistência e apresentação separados; textos em pt-BR.
7. Teste as funcionalidades: `node --test tests/server.test.mjs`, fluxos no navegador e conferência do PNG exportado (dimensões, acentos, margens).
8. Registre mudanças importantes, comandos executados, resultados observados e limitações em `docs/PROGRESSO.md`.
9. Não invente resultados de testes. Só declare concluído o que foi executado e observado.
10. Não modifique arquivos desnecessariamente: faça alterações concentradas na solicitação.

## Estado do produto

- Stack: Node.js 24 (`node:sqlite`) servindo arquivos estáticos e JSON pela mesma origem; frontend em módulos ES sem build; PWA com service worker.
- Banco: `data/capa.sqlite` (WAL). Testes usam diretórios temporários isolados.
- Skills: `frontend-design`, `canvas-design`, `webapp-testing`, `responsive-layout-reviewer`.
- Compartilhamento: Estúdio desenha em canvas na resolução final (1080×1080, 1080×1350, 1080×1920) com download e Web Share API.
- Identidades visuais por álbum: `references/album-identities/` com metadados estruturados; três níveis (personalizada, semiautomática, padrão).