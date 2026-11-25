# Skills do CAPA

Em 23/11/2026, o Windows indicou a Área de Trabalho em `C:\Users\Jhonny\OneDrive\Área de Trabalho`. A coleção se chama `SKILLS PARA O CODEX` e fica ao lado do projeto.

## Inventário e seleção

O levantamento percorreu a coleção incluindo pastas ocultas, backups, dependências e distribuições aninhadas. A leitura integral dos **915** arquivos `SKILL.md` abrangeu **3.265.155 bytes** e encontrou **907** conteúdos distintos por SHA-256. A planilha CSV contém caminho, nome, descrição declarada, decisão, tamanho, assinatura e número de títulos de cada manifesto. [Inventário completo](INVENTARIO_SKILLS.csv)

As origens se dividem em 880 manifestos de `awesome-codex-skills`, 23 de `skills-do-artigo`, três de `skills-personalizadas`, três da instalação Python e seis de cópias de projetos. Boa parte descreve automações para serviços externos. A coleção também contém ferramentas de vídeo, slides e integrações. O lançador de Impeccable pode baixar um executável na primeira chamada. A seleção abaixo cobre as tarefas planejadas com ferramentas já disponíveis.

| Skill e localização | Finalidade no produto | Dependências e ativação | Verificação |
| --- | --- | --- | --- |
| [frontend-design](../skills/frontend-design/SKILL.md) | Definir cores, escala tipográfica, hierarquia editorial, texto de ações e estados vazios. Aplicar nas páginas do catálogo e no diário. | Markdown. Usar `$frontend-design`. | Manual lido e critérios aplicados à preparação da interface. |
| [canvas-design](../skills/canvas-design/SKILL.md) | Compor os PNGs do Estúdio com capa, nota, título e autoria. Revisar equilíbrio, margens e ajuste de textos em cada formato. | Markdown, fontes locais e respectivas licenças em `canvas-fonts/`. Usar `$canvas-design`. | Manual lido e recursos conferidos, incluindo 54 fontes TTF. |
| [webapp-testing](../skills/webapp-testing/SKILL.md) | Inspecionar o DOM renderizado, acionar controles pelos rótulos, verificar console, navegação e exportação no navegador. | Python, Playwright e Chromium. Usar `$webapp-testing`. | Playwright 1.65.2 disponível na máquina. O auxiliar revisado respondeu a `--help`. |
| [responsive-layout-reviewer](../skills/responsive-layout-reviewer/SKILL.md) | Revisar títulos longos, navegação por toque, largura dos cards, campos, alvos e rolagem nas telas pequenas. | Markdown. Usar `$responsive-layout-reviewer`. | Checklist lido. As larguras de verificação vão de 320 a 1920 pixels. |

## Uso efetivo em 24/11/2026

- **canvas-design** guiou a composição das identidades: uso das fontes OFL já licenciadas em `canvas-fonts/` (Instrument Serif, Libre Baskerville), verificação de licença antes de embutir e cópia para `public/assets/fonts/` com os arquivos `.txt`.
- **frontend-design** orientou a faixa de identidade na página do disco e o painel do Estúdio: um elemento de maior peso por tela, contraste sobre o verde ácido, ação explicativa ("Usar no Estúdio") e nota de tema em vez de controle mudo.
- **responsive-layout-reviewer** foi aplicado no painel do Estúdio (`.st-pair` em coluna única abaixo de 520 px, ações em largura cheia no celular) e na verificação de ausência de rolagem horizontal a 375 px.
- **webapp-testing** sustentou os testes de navegador: `tests/identidades_browser.py` (10 verificações, incluindo cores medidas no canvas e dimensões do PNG exportado) e `tests/screenshots_identidades.py` (revisão visual). O Chromium do cache local (build 1248) foi apontado explicitamente porque o ambiente espera a 1255; os dois arquivos detectam o executável sozinhos.

As três primeiras skills vieram da Área de Trabalho. `frontend-design` e `webapp-testing` vieram de `skills-do-artigo` e `canvas-design` veio de `awesome-codex-skills`. Seus 91 arquivos foram comparados byte a byte por SHA-256 com a origem. A revisão responsiva complementa a coleção e veio da instalação do usuário em `~/.codex/skills/responsive-layout-reviewer`.

## Descoberta no Codex

Os pacotes originais ficam em `skills/`. Cada manifesto em `.agents/skills/<nome>/SKILL.md` registra nome, descrição e uma referência relativa ao manual integral. Assim a descoberta funciona em outros checkouts sem duplicar fontes ou scripts. Uma consulta local a `skills/list` no app server do Codex, com a raiz do projeto e recarga habilitada, retornou as quatro entradas com escopo `repo` e `enabled: true`. A documentação oficial descreve a instalação no escopo do projeto. [Diretórios de skills do Codex](https://developers.openai.com/api/reference/cli)

## Aplicação e reprodução

Princípios derivados dos manuais para a implementação:

- Definir um elemento de maior peso visual por página. Nas fichas de obras, a capa identifica o lançamento e o texto mantém título e artista juntos. A tela vazia oferece a ação disponível com um verbo que explica o resultado.
- Verificar as dimensões da imagem exportada. Conferir o título mais longo, a crítica no limite permitido, acentos e margem segura vertical de Stories com o arquivo baixado.
- Exercitar o DOM após a renderização e executar operações pelo papel acessível dos controles. Capturar falhas de página e mensagens do console durante os fluxos. As variáveis, navegadores e testes executados no produto estão em [Progresso](PROGRESSO.md).
- Rever grid e formulários a 320, 375, 667, 768, 1024, 1280, 1440 e 1920 px quando pertinentes. Verificar que a busca aceita toque, o foco é visível e uma linha de texto extensa não alarga a página.

O auxiliar `webapp-testing/scripts/with_server.py` aceita um comando explícito de servidor, aguarda a porta local e encerra o processo criado. A revisão identificou o uso de `shell=True` para esse comando. Usar comandos de desenvolvimento conhecidos do próprio projeto. Os exemplos distribuídos têm caminhos ilustrativos de Linux. O Python instalado na máquina original fica em `../SKILLS PARA O CODEX/.venv/Scripts/python.exe` e o navegador headless está no cache local do Playwright.
