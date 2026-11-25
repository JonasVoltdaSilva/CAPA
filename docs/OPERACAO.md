# Operação do CAPA

## Hospedagem no Render

O repositório inclui `render.yaml`. No dashboard do Render, crie um Blueprint ligado ao GitHub e selecione este repositório e a branch `main`. O serviço usa Node 24 e um disco persistente montado em `/var/data` para manter o SQLite entre implantações. Esse tipo de serviço é pago. Configure `APP_ORIGIN` com o endereço HTTPS que o Render atribuir ao serviço (por exemplo, `https://capa.onrender.com`) e `MUSICBRAINZ_CONTACT` com o contato institucional escolhido. O Render faz deploy automaticamente quando há novos commits na branch `main`.

## Processo e armazenamento

Use Node.js 24 com `node:sqlite`. O processo serve o navegador e a API pela mesma origem. Para experimentar na máquina, execute `npm start` na raiz e abra `http://127.0.0.1:3000`. A primeira execução cria `data/capa.sqlite`. A raiz de desenvolvimento está no OneDrive. Em uma instalação com usuários reais, configure um volume local persistente com acesso restrito à conta do serviço. O SQLite usa WAL e pode manter arquivos auxiliares ao lado do banco.

| Variável | Uso |
| --- | --- |
| `HOST` | Endereço de escuta. O padrão `127.0.0.1` atende à máquina local ou a um proxy no mesmo servidor. |
| `PORT` | Porta TCP. Padrão 3000. |
| `DATA_DIR` | Diretório persistente do arquivo `capa.sqlite`. O servidor e as ferramentas de moderação e backup devem apontar para o mesmo diretório. |
| `APP_ORIGIN` | Origem pública do site, incluindo esquema e porta quando necessária. O mesmo endereço deve ser usado nos links, na validação das requisições do navegador e no proxy. Uma origem HTTPS ativa cookie `Secure` e HSTS. |
| `TRUST_PROXY` | O valor `loopback` aceita `X-Real-IP` de um proxy conectado via loopback. Configure o proxy para substituir esse cabeçalho pelo IP do cliente. No padrão, os limites usam o IP da conexão TCP. |
| `MUSICBRAINZ_CONTACT` | E-mail institucional ou endereço HTTPS válido do responsável pela integração. A busca e importação remotas dependem desse contato. O catálogo incluído está disponível sem configuração externa. |

Configure HTTPS no proxy para uso externo. Aponte sua raiz HTTP para o processo Node. A pasta `public` é a única árvore de arquivos estáticos servida pelo aplicativo. O proxy pode comprimir CSS, JavaScript e JSON durante o transporte. Respostas da API e páginas dependentes da sessão devem preservar os controles de cache enviados pelo Node.

## Contas e privacidade

As senhas usam scrypt assíncrono com sal individual e os parâmetros N=32768, r=8 e p=2. O servidor guarda o SHA-256 dos tokens aleatórios de sessão. O cookie usa `HttpOnly`, `SameSite=Lax` e validade de 30 dias. Logout revoga a sessão atual. Excluir a conta exige a senha e remove registros sociais associados por chaves estrangeiras. A versão inicial não possui recuperação de senha por e-mail.

As dez notas possíveis vão de 0,5 a 5. O diário pode ter várias escutas da mesma obra. A média considera a última contribuição pública com nota de cada pessoa na obra consultada. Álbum e faixa possuem chaves distintas. A visibilidade da escuta privada é aplicada pelo servidor à resposta JSON e ao link de compartilhamento.

O bloqueio remove os seguimentos nas duas direções e filtra as contribuições entre as pessoas durante as respectivas sessões. O visitante anônimo pode ver conteúdo publicado como público. A área de configurações de quem fez o bloqueio recebe o nome e o identificador da pessoa para permitir o desbloqueio. Uma suspensão de moderação oculta o perfil e suas contribuições para visitantes e membros.

A foto enviada é decodificada como PNG RGB/RGBA de até 512 × 512 e 350 KiB. O servidor verifica os dados de pixels e recria o arquivo, descartando os metadados auxiliares. O perfil entrega uma URL local. A imagem é buscada separadamente e seu acesso considera bloqueios e suspensões. O e-mail aparece apenas no objeto privado da conta conectada.

## Backup e recuperação

O comando abaixo usa o backup online do SQLite. Escolha um arquivo novo em um diretório de backups já existente, com acesso restrito e espaço disponível. O exemplo usa um destino fictício a ser substituído pelo volume da instalação.

```powershell
node src/server-backup.mjs "D:\Backups\capa-2026-11-23.sqlite"
```

O comando lê o banco ativo, cria o arquivo com exclusividade, remove as sessões da cópia, compacta o banco copiado e executa verificações de integridade e de chaves estrangeiras. O banco ativo continua disponível. O resumo retorna `integridade: ok`. A cópia contém cadastros, hashes de senha, conteúdo privado, denúncias e imagens. Dê às cópias o mesmo controle de acesso do banco principal e defina retenção, criptografia do volume e descarte segundo a operação. [Backup online da API SQLite do Node](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)

Para ensaiar uma restauração:

1. Escolha um diretório de dados novo, exclusivo do ensaio. Copie o snapshot verificado para esse diretório com o nome `capa.sqlite`.
2. Abra um novo processo apontando `DATA_DIR` para o diretório de ensaio, `HOST` para `127.0.0.1` e `PORT` para uma porta livre. Deixe `APP_ORIGIN` compatível com o endereço do ensaio.
3. Confira o catálogo, o login de uma conta de validação e o acesso ao respectivo diário. A restauração exige novo login para todas as contas.
4. Para recuperação efetiva, interrompa o processo anterior e promova o diretório verificado pela configuração de `DATA_DIR`. Preserve o diretório antigo para conferência. Recuperar um snapshot retorna ao estado da data da cópia. Reconcile exclusões e decisões de moderação posteriores antes de oferecer acesso público.

O teste automatizado mantém o banco original aberto durante o backup, reabre a cópia com outro servidor, confirma a visibilidade privada, efetua novo login e verifica o registro restaurado. Também confere a recusa de substituir uma cópia já existente.

## Fila de moderação

A ferramenta `src/server-moderation.mjs` opera diretamente sobre o banco. O operador precisa de acesso local ao volume. O comando `listar` inclui motivo e conteúdo para a tomada de decisão. Identificadores de denúncia e de conta têm funções distintas.

| Ação | Comando |
| --- | --- |
| Ver fila | `node src/server-moderation.mjs listar` |
| Encerrar denúncia | `node src/server-moderation.mjs arquivar ID_DA_DENUNCIA` |
| Remover crítica, comentário ou lista denunciada | `node src/server-moderation.mjs remover ID_DA_DENUNCIA` |
| Suspender conta denunciada e revogar suas sessões | `node src/server-moderation.mjs suspender ID_DA_DENUNCIA` |
| Reativar uma conta | `node src/server-moderation.mjs reativar ID_DA_CONTA` |

A remoção de conteúdo é definitiva no banco ativo. Confira o alvo no resultado de `listar` antes de agir. Encerrar uma denúncia retira o item da fila. A ferramenta não mantém um histórico de decisões administrativas. O responsável pela comunidade deve definir quem opera a fila e como registrar e responder a contestações.

## Capacidade e acompanhamento

O armazenamento e os limitadores de frequência atendem a uma única instância. Há limites de cadastro e login por IP, um limite geral de 200 mutações por minuto por IP e no máximo oito cálculos de senha concorrentes no processo. As tentativas de login estão limitadas a 30 por dez minutos e o cadastro a 12 por dez minutos por IP. Uma resposta HTTP 429 indica que o limite foi alcançado.

O carregamento inicial ainda envia o catálogo, os perfis visíveis e todas as contribuições acessíveis à sessão em uma única resposta. As fotos são carregadas em requisições próprias. As consultas de comentários e curtidas filtram as obras e os autores no SQLite antes da serialização. Monitore latência, volume de JSON transferido, memória e tamanho do WAL. A paginação de feed, comentários e catálogo e as consultas de agregação no servidor passam a ser prioritárias quando o volume crescer. Antes de usar múltiplos processos, distribua os contadores e a fila das fontes externas e revise o banco de dados.

Em um ensaio local em memória com 200 perfis e 3.000 escutas sintéticas, das quais 2.000 públicas, cada escuta recebeu uma curtida e um comentário. O bootstrap anônimo serializado ocupou 839.703 bytes e a consulta com serialização levou entre 18 e 21 ms em sete execuções. A medição exclui tráfego HTTP, disco, navegador, imagens e acessos concorrentes. O tamanho do documento já é relevante para redes móveis.

Execute `node --test tests/server.test.mjs` com acesso de loopback para validar cadastro, sessões, diário, autoria, listas, relações sociais, moderação, imagens, persistência e recuperação. A suíte usa bancos de teste isolados. Configuração pública de HTTPS e proxy, envio de e-mail e operação com carga real ainda precisam de verificação no ambiente escolhido.

