# O que a experiência do Letterboxd ensina ao CAPA

Pesquisa de produto em 23 de novembro de 2026. As observações abaixo vêm de páginas públicas, da central de ajuda e das imagens promocionais publicadas pela Letterboxd Limited. As decisões propostas para o CAPA são de autoria do projeto.

## Da descoberta ao primeiro registro

A página inicial pública introduz o hábito de registrar filmes e oferece entrada na comunidade. Cartazes tornam a proposta reconhecível antes do cadastro. A sequência alterna descoberta por imagem e leitura das contribuições da comunidade. Uma coleção visual resolve a escolha de *qual obra abrir*, enquanto uma crítica responde *por que ela pode interessar*. No CAPA, o visitante deve conseguir abrir uma capa, conhecer o disco e ler críticas públicas antes de criar uma conta. [Página inicial](https://letterboxd.com/) · [Guia oficial](https://letterboxd.com/welcome/)

## A obra como ponto de encontro

Na página de *Parasita*, título, ano e direção identificam a obra. O diretor e os gêneros levam a outros recortes do catálogo. Créditos extensos ficam agrupados por função, e os títulos das seções distinguem conteúdo editorial, metadados e contribuições dos membros. Para um disco, essa identificação precisa de artista, tipo de lançamento, ano e edição. A sequência de faixas é um elemento de navegação central. Abrir uma faixa deve manter um caminho de volta ao álbum e creditar seus artistas. [Ficha de Parasita](https://letterboxd.com/film/parasite-2019/)

## O que significa uma estrela

A escala admite dez valores de meia a cinco estrelas. A curtida expressa afinidade independente da nota. O registro datado guarda a experiência de um dia e pode ser revisto posteriormente. A plataforma explica que seu cálculo público pondera votos e considera a nota mais recente de cada pessoa para o filme. No produto musical, múltiplas escutas precisam preservar suas notas históricas. A média pública de cada obra deve informar o número de avaliadores e o critério de contagem. Uma faixa e seu álbum devem ter identificadores e distribuições de notas próprios. [Avaliação e curtida](https://support.letterboxd.com/hc/en-us/articles/15178774202383-What-s-the-difference-between-liking-and-rating-a-film) · [Regras de avaliação e histórico](https://letterboxd.com/faq/)

## Diário, perfil e atividade

O diário dá significado à data da experiência. O perfil reúne favoritos, atividade recente e atalhos para o histórico. Isso oferece duas perspectivas sobre a mesma pessoa, o gosto escolhido para apresentação e os hábitos ao longo do tempo. Seguir alguém alimenta uma linha de atividade, e as críticas ajudam a descobrir outros autores. No CAPA, uma crítica deve vincular obra, autor e registro. O perfil deve permitir quatro discos favoritos, e a consulta por mês deve contar reescutas com indicação da data. A visibilidade de um registro precisa valer também para feed, estatísticas públicas e prévia de compartilhamento. [Registro datado](https://support.letterboxd.com/hc/en-us/articles/15178778774543-What-s-the-difference-between-marking-a-film-watched-and-logging-it) · [Exemplo público de perfil](https://letterboxd.com/helpmehelpme/) · [Atividade e listas](https://letterboxd.com/welcome/)

## Listas, rankings e busca

Uma lista de um membro tem autoria e intenção próprias. A classificação geral responde a outra pergunta e expõe um critério de ordenação. A busca pública permite restringir os resultados por entidade, incluindo filmes, críticas, listas e membros. Para música, é comum que disco e faixa tenham o mesmo título. Cada resultado deve indicar tipo, artista e obra relacionada, mantendo a consulta ao mudar de filtro. Um ranking precisa informar sua métrica e o número de avaliações para que o leitor interprete uma posição com poucos participantes. [Busca por Parasite](https://letterboxd.com/search/parasite/) · [Catálogo ordenado por avaliação](https://letterboxd.com/films/by/rating/) · [Listas no guia oficial](https://letterboxd.com/welcome/)

## Composição visual e navegação

A galeria Android da própria empresa mostra fundos escuros, texto claro, navegação por abas e um acento de cor abaixo da aba ativa. Na descoberta, pequenos intervalos permitem comparar vários cartazes. Na busca, miniaturas compactas deixam espaço para títulos alinhados. Na ficha, a fotografia ocupa a parte superior e a identificação da obra recebe maior peso. A navegação por textos curtos aproxima busca, listas e conteúdo da comunidade. O contraste de tamanho e peso entre títulos e metadados é mais relevante para a adaptação do que a reprodução de uma fonte específica. [Galeria oficial Android](https://play.google.com/store/apps/details?id=com.letterboxd.letterboxd)

Para o CAPA, uma capa quadrada tem mais área por item que um cartaz vertical na mesma linha. Reserve espaço próprio para título e artista, preserve as bordas da arte e permita nomes longos. Em telas estreitas, os controles de nota precisam admitir toque e teclado. Em telas largas, catálogo e contexto podem compartilhar a linha, mantendo uma ordem de leitura significativa sem CSS. As medidas de tipografia, intervalos e pontos de quebra do CAPA pertencem ao seu design system. As medidas exatas do CSS desktop do Letterboxd não foram coletadas.

## Estados e cobertura

A ajuda descreve ações sobre cartazes e feedback visual de itens já adicionados à lista de interesse. A página pública oferece entrada antes de ações de conta. No CAPA, foco visível, rótulo de ação e confirmação textual devem acompanhar seleção por cor. Erros de rede precisam preservar o texto da crítica. Um catálogo sem avaliações deve convidar ao primeiro registro. [Ajuda do Letterboxd](https://letterboxd.com/faq/)

O feed autenticado e os gestos do aplicativo nativo foram estudados pela documentação e pela galeria oficial. A inspeção visual móvel usou as capturas do desenvolvedor. A leitura desktop utilizou a estrutura publicada das páginas. Algumas URLs de perfil, diário e listas devolveram HTTP 403 ao leitor web. A biblioteca identifica essas limitações para evitar confundir documentação do produto com testes realizados em uma conta.

## Biblioteca

- [Fluxos de navegação por contexto](layouts/FLUXOS.md)
- [Padrões de componentes e critérios de adaptação](components/PADROES.md)
- [Galerias oficiais, créditos e condições de reprodução](screenshots/FONTES.md)
