# Arquitetura

Aplicação de mesma origem para o navegador e a API. Node.js 24 serve arquivos estáticos e JSON. SQLite guarda contas, sessões e contribuições em disco. A descoberta pública deve funcionar antes do cadastro. O navegador carrega módulos ES e renderiza as rotas sobre URLs que abrem diretamente. As páginas compartilháveis recebem metadados de link no servidor.

## Decisões

- **Node e SQLite.** A máquina já dispõe de Node 24 e `node:sqlite`. Uma instância com volume persistente permite começar sem provisionar serviços. SQLite exige armazenamento local ao processo. Para várias instâncias, migrar os dados sociais para PostgreSQL e distribuir o limitador de requisições.
- **Interface.** CSS com tokens e módulos de navegador cobrem esta aplicação. Next.js, TypeScript e Tailwind foram considerados. A escolha inicial reduz instalação e build. A organização em módulos mantém separadas as rotas, o catálogo e as telas sociais.
- **Serviços gerenciados.** Supabase pode assumir identidade, banco e armazenamento numa implantação futura. A operação local funciona com contas reais desde o início e independe de credenciais de terceiros.
- **Metadados.** O catálogo inicial documenta a origem de cada edição. Consultas remotas complementam a base local. Ausência de duração, capa ou dia exato deve ser visível como dado desconhecido. O estúdio verifica a permissão de cada arte.
- **Métricas.** Cada escuta tem ID, dono e data. A contribuição vigente de cada pessoa para a média pública é a última avaliação pública com nota da obra. Faixa e álbum têm agregações próprias. Retrospectivas contam escutas no período.
- **Privacidade.** O servidor determina acesso antes de serializar. Sessões usam tokens opacos em cookies e senhas derivadas com sal. As rotas de mutação validam origem e propriedade. Dados personalizados ficam fora do cache offline.
- **Compartilhamento.** O estúdio desenha em canvas na resolução final, com download e compartilhamento nativo quando suportado. O álbum continua identificável por uma composição tipográfica quando a capa tem licença desconhecida.

## Operação

Executar uma única instância inicialmente. Manter o banco fora do diretório público e das pastas sincronizadas em produção. Usar HTTPS com proxy reverso, volume persistente, backups restauráveis e monitoramento de erros. A disponibilização pública exige escolher o ambiente e configurar domínio, responsáveis pela moderação e contato real de API.
