# Stories: referências e decisões
Consulta em 24/11/2026. Complementa ANALISE_LETTERBOXD.md e a galeria oficial já registrada.

## Referências de produto

A [página do desenvolvedor de Stories for Letterboxd na App Store](https://apps.apple.com/us/app/stories-for-letterboxd/id1547107511) descreve um aplicativo independente, sem vínculo com Letterboxd: recebe links de filmes, críticas e listas, oferece estilos e prévia durante a edição. O histórico publicado na [loja italiana](https://apps.apple.com/it/app/stories-for-letterboxd/id1547107511?platform=tv) descreve o uso de pôster desfocado quando não existe imagem de fundo. A adaptação para CAPA usa a própria capa e a avaliação persistida, sem copiar modelos ou identidade proprietária.

As referências oficiais do Letterboxd já documentadas mostram a obra como entrada visual, hierarquia entre título e metadados e nota pessoal em meios pontos. Nesta consulta a FAQ respondeu 403; não foi executado um teste autenticado no aplicativo. A descrição de Stories for Letterboxd é evidência dos recursos declarados pelo desenvolvedor, não validação física do envio ao Instagram.

## Composição adotada

Capa quadrada de 756 px, raio de 18 px e sombra discreta; título Bricolage com quebra e tamanho calculados; cinco estrelas vetoriais de 88 px; assinatura com o mesmo símbolo vetorial do cabeçalho. A área central se ajusta ao título. A cor do fundo vem da capa, com seis passagens de desfoque separável e contraste conforme luminosidade. Sem divisórias, artista, números ou rodapé técnico. Medidas pertencem ao CAPA. A direção completa está em ../../docs/DESIGN_STORIES.md.

## Compartilhamento oficial

| Ambiente | Recurso | Decisão |
| --- | --- | --- |
| Web/PWA | [Web Share API, W3C](https://www.w3.org/TR/web-share/) entrega arquivos aos destinos oferecidos pelo sistema. Exige contexto seguro, suporte a arquivos e ativação do usuário. | PNG preparado antes do clique; testar canShare; botão “Compartilhar pelo dispositivo”; tratar cancelamento e erro; sempre permitir download. Não presumir que Instagram estará na lista nem que o envio foi publicado. |
| Android/iOS nativos | [Sharing to Stories, Meta](https://developers.facebook.com/documentation/instagram-platform/sharing-to-stories) usa intents Android e esquema de URL/pasteboard iOS, com Facebook App ID. | Depende de aplicativo nativo, configuração Meta e teste em aparelho. Uma URL aberta pelo navegador não equivale à transferência da imagem ao compositor. |
| Publicação por API | [Content Publishing, Meta](https://developers.facebook.com/documentation/instagram-platform/content-publishing) depende de conta profissional, login/permissões e mídia acessível pelo servidor. | Não implementado no CAPA web. Não usar credenciais de contas pessoais, automação de login nem afirmar publicação automática. |

Os testes de navegador simulam sucesso, cancelamento e rejeição de navigator.share para validar o contrato do CAPA. Eles não substituem teste com Instagram instalado em Android/iOS.
