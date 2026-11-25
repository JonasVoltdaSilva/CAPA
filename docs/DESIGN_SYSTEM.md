# Design system

## Identidade

Um clube de discos brasileiro. A capa e o selo circular do vinil dão forma à identidade. O símbolo parte de dois discos deslocados. A descoberta abre com uma única escolha editorial, seguida por uma estante de capas quadradas. A conta entra no fluxo quando o ouvinte deseja registrar ou guardar algo.

## Composição

No desktop, o cabeçalho reúne marca, destinos primários, pesquisa e registro. A coluna central acompanha a largura da estante. O destaque combina uma ficha editorial alinhada à esquerda e uma reprodução de disco à direita. No celular, o conteúdo mantém a ordem de leitura e distribui as ações essenciais em uma navegação fácil de alcançar. Listas longas usam linhas com separadores.

```text
marca    descobrir  comunidade  diário            busca    registrar
--------------------------------------------------------------------
Descobrir
| destaque, disco e artista                 paisagem, selo e vinil |
Seleção da curadoria                                    ver catálogo
| capa |    | capa |    | capa |    | capa |    | capa |    | capa |
```

A alternativa de abrir com uma grade de estatísticas exigiria dados da comunidade antes da primeira escuta. A seleção editorial consegue apresentar música desde a primeira visita.

## Tokens

| Papel | Valor |
| --- | --- |
| Fundo e superfície | #111210 e #1b1d19 |
| Texto principal e secundário | #f5f1e8 e #b5b7aa |
| Ação, foco e avaliação | #e9ae76, cobre inspirado em tinta de encarte |
| Divisor | #383a33 |
| Tipos | Bricolage Grotesque em títulos, Instrument Sans em controles e texto. Fontes locais OFL. |
| Escala | 13, 15, 16, 20, 26, 36, 48 e 76 px com escala fluida nos títulos |
| Espaços | 4, 8, 12, 16, 24, 32, 48, 64 px |
| Contornos | 1 px; foco de 2 px afastado em 3 px |
| Raios | 4 px em capas, 8 px em controles, 12 px em painéis; círculo em selos e avatares |
| Elevação | Sombra de contato na capa em destaque. Diálogos usam sombra de separação e fundo escurecido. |
| Adaptação | Revisar 320, 375, 667, 768, 1024, 1280, 1440 e 1920 px. A grade se adapta ao conteúdo. |

## Componentes e estados

O botão primário tem preenchimento cobre, texto escuro e alvo de toque de 44 px. Controles secundários usam borda ou contraste de fundo. Cada campo tem rótulo persistente. Pesquisa aceita teclado e submissão direta. Diálogos mantêm o foco e podem ser fechados com Escape. Superfícies interativas usam foco e mudança de contorno.

Uma ficha de disco tem capa 1:1, título vinculado e artista. Fichas tipográficas de substituição usam selo de disco e a indicação de arte editorial no detalhe. Críticas distinguem obra, autor, nota e data. Avaliações usam dez meios pontos com valor textual. A distribuição apresenta contagens legíveis junto às barras. Tabelas preservam a ordem das faixas.

O estado vazio oferece o próximo gesto possível. Carregamentos sinalizam atividade e erros permitem tentar novamente. O movimento responde ao toque e obedece à preferência de movimento reduzido.

## Arte do estúdio

A linguagem do encarte combina uma frente de disco dominante, respiro, alinhamentos recorrentes e os dados da audição. No Stories, afastar texto dos controles superiores e inferiores. As composições de álbum e ranking usam hierarquias distintas. A arte de lista preserva a ordem e distingue discos de faixas, com até nove obras por página. A retrospectiva anual reúne escutas, discos, artistas e a média das notas do período. Reservar área própria para créditos. Recalcular quebras e tamanhos no canvas de saída. A prévia deriva da mesma composição usada para o PNG.

## Identidade visual por álbum

Cada álbum pode carregar uma estética própria em áreas específicas: faixa de identidade na página do disco, prévias de avaliação e artes do Estúdio. A identidade **nunca** altera a navegação, os formulários nem os componentes principais — o design system acima continua valendo para tudo o mais.

### Três níveis de resolução

| Nível | Nome | Como resolve |
| --- | --- | --- |
| 1 | Identidade personalizada | Dossiê pesquisado em `references/album-identities/<álbum>/IDENTIDADE.md` e configuração em `identities.json`. Paleta, tipografia e regras de composição do álbum. |
| 2 | Identidade semiautomática | Sem dossiê: cor dominante extraída da capa combinada a um preset tipográfico licenciado (`cru`, `editorial`, `clássico`). |
| 3 | Tema padrão | Sem identidade ou sem capa utilizável: tokens oficiais do CAPA. |

### Tokens de uma identidade

| Token | Efeito |
| --- | --- |
| `paleta.fundo`, `paleta.tinta`, `paleta.destaque`, `paleta.sobreDestaque` | Cores das artes e da faixa de identidade. |
| `tipografia.fonteTitulo`, `tipografia.fonteTexto`, pesos | Famílias OFL locais aplicadas ao canvas e à folha. |
| `composicao.alinhamento` | `centro` centraliza títulos, artista, estrelas e crítica nas artes. |
| `composicao.caixaTitulo` | `minusculas`, `maiusculas` ou `normal`. |
| `composicao.desfoqueTitulo` | Eco cru: cópias levemente deslocadas do título (estética brat). |
| `composicao.inverterComposicao` | Inverte a ordem dos blocos (gesto do Sweetener). |

### Controle no Estúdio

Seletor **Tema** com três modos: *Tema do CAPA*, *Estética do álbum* (padrão quando o álbum tem identidade) e *Personalizado* (fundo e cor manuais). Os controles manuais só aparecem no modo personalizado. Uma nota descreve a decisão em vigor. A troca de tema recompõe a arte e recarrega as fontes antes de exportar.

### Fontes e licenças

Todas as famílias usadas nas identidades são SIL OFL 1.1 e ficam em `public/assets/fonts/` com o arquivo de licença ao lado: Bricolage Grotesque, Instrument Sans, Instrument Serif e Libre Baskerville. A fonte original de uma capa costuma ser software licenciado (Arial em BRAT, Bodoni em Sweetener); o CAPA usa apenas equivalentes gratuitos que preservam o espírito visual. Nunca redistribuir arquivos de fontes comerciais.

### Identidades implementadas

| Identidade | Estilo | Traço dominante |
| --- | --- | --- |
| BRAT (Charli XCX) | cru | Verde ácido #8ACE00, título em caixa baixa centralizado, eco cru. |
| Sweetener (Ariana Grande) | editorial | Papel pêssego, serifada delicada, composição invertida. |
| Positions (Ariana Grande) | clássico | Grafite quente, serifada clássica centralizada, verde-neutro. |

## Exceção de composição: Stories minimalistas

O destino Instagram usa a composição definida em DESIGN_STORIES.md. Nela, créditos de imagens licenciadas acompanham os metadados PNG e a interface, sem rodapé visível; não há artista, número da nota nem linhas. Os outros modelos do Estúdio conservam seus controles e composições. A confirmação de uma nota salva diz “Avaliado!”, mostra as estrelas pessoais e oferece Stories e outros formatos.
