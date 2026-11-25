# Biblioteca de identidades visuais por álbum

Cada álbum pode ter uma identidade visual própria dentro do CAPA — na página do disco, nos cartões especiais e, sobretudo, no Instagram Share Studio. A biblioteca é a fonte da verdade: o servidor entrega `identities.json` ao navegador pela rota `/api/identidades`.

## Como o sistema funciona (três níveis)

| Nível | Nome | O que acontece |
| --- | --- | --- |
| 1 | Identidade personalizada | Álbuns com dossiê pesquisado e configuração em `identities.json`. Paleta, tipografia licenciada e regras de composição específicas. |
| 2 | Identidade semiautomática | Sem dossiê: a cor dominante é extraída da capa e combinada a um preset tipográfico licenciado (`cru`, `editorial`, `classico`). |
| 3 | Tema padrão | Sem identidade e sem capa utilizável: design system oficial do CAPA (`public/style.css`). |

A identidade **nunca** altera a navegação, os formulários nem os componentes principais do site. Ela atua em áreas específicas: faixa de identidade na página do disco, prévias de avaliação e artes do Estúdio.

## Estrutura

```
references/album-identidades/
├── README.md               ← este arquivo
├── identities.json         ← registro estruturado (consumido pelo app)
├── brat/IDENTIDADE.md      ← dossiê de pesquisa
├── sweetener/IDENTIDADE.md
└── positions/IDENTIDADE.md
```

## Como cadastrar uma nova identidade

1. **Pesquise antes de criar.** Levante cores, tipografia, composição e direção de arte em fontes verificáveis. Registre as URLs no dossiê.
2. **Confira as licenças.** A fonte original da capa costuma ser software licenciado (Arial, Bodoni etc.). Escolha uma alternativa gratuita com licença verificada (SIL OFL) que preserve o espírito visual. Nunca redistribua arquivos de fontes comerciais.
3. **Adicione os arquivos da fonte** em `public/assets/fonts/` com o arquivo de licença `.txt` ao lado.
4. **Crie o dossiê** em `references/album-identities/<album>/IDENTIDADE.md` (paleta, tipografia, regras, fontes).
5. **Registre em `identities.json`** usando o **ID do álbum no catálogo** (`albumId`), nunca o nome — títulos se repetem entre artistas. IDs importados do MusicBrainz seguem o formato `mb-<mbid>`.
6. **Teste no Estúdio**: selecione "Estética do álbum", exporte o PNG e confira dimensões, acentos, quebras de linha e contraste.

## Identidades implementadas

| Identidade | Álbum (ID no catálogo) | Estilo | Dossiê |
| --- | --- | --- | --- |
| BRAT | `mb-0aa87f3e-a91a-4355-ad9e-6d60be378841` (Charli XCX, 2024) | cru | [brat/IDENTIDADE.md](brat/IDENTIDADE.md) |
| Sweetener | `mb-029bb5e7-f051-4a0f-8c57-a5b89d914300` (Ariana Grande, 2018) | editorial | [sweetener/IDENTIDADE.md](sweetener/IDENTIDADE.md) |
| Positions | `mb-9ad6641b-e9c6-462e-a039-f3255ded0c2c` (Ariana Grande, 2020) | clássico | [positions/IDENTIDADE.md](positions/IDENTIDADE.md) |

Os três álbuns foram importados do MusicBrainz pela própria API do aplicativo (`POST /api/catalog/import/<mbid>`), com metadados reais e capas do Cover Art Archive. As capas dessas importações ficam com `exportCover: false` — servem para exibição no site, e o Estúdio usa a composição tipográfica quando não pode embutir a imagem.