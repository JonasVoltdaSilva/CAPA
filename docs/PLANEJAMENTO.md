# Planejamento

| Fase | Entrega verificável | Estado |
| --- | --- | --- |
| 0. Preparação | Raiz inspecionada, referências com procedência, pesquisa das plataformas e APIs, inventário da Área de Trabalho, skills carregáveis, instruções e tokens de design. | Concluída em 24/11/2026: raiz `CAPA` preservada de `CONTRACAPA`, nome atualizado em código e documentos, skills reconhecidas pelo Codex, `references/album-identities/` criada, `README.md` e `public/studio.css` adicionados. |
| 1. MVP | Descoberta pública, catálogo pesquisável, álbum/artista/faixa, cadastro e sessão, avaliação editável, diário de escutas repetidas, perfil e PNG. | Concluída e verificada: `node --test` 6/6; teste social de navegador cobre conta, perfil, diário, listas, comunidade, moderação, rankings, estatísticas e batalha. |
| 2. Comunidade | Listas, seguidores, comentários, bloqueio e denúncia, rankings calculados e registro faixa a faixa. | Concluída e verificada no teste social de navegador. |
| 3. Experiência pessoal | Comparação de álbuns, gêneros e estatísticas, retrospectivas mensal e anual, personalização de seis artes, **identidades visuais por álbum**. | Identidades concluídas em 24/11/2026 (três níveis, três álbuns demonstrativos, fontes licenciadas, arte revisada). Batalha e estatísticas verificadas. Recomendações seguem pendentes. |
| 4. Estabilização | Testes de API e de navegação, privacidade entre contas, verificação de PNG e responsividade, PWA e instruções de operação. | Testes de API, navegador, PNG e responsividade em execução contínua. Pendente: configuração pública de HTTPS/proxy, e-mail de recuperação de senha e operação com carga real no ambiente escolhido. |

O estado observado de cada entrega, os testes e as pendências ficam em PROGRESSO.md.

## Próximos passos sugeridos

1. Novas identidades de álbum seguindo o índice de `references/album-identities/README.md` (cadastro sem alterar código).
2. Recomendação de discos a partir das avaliações (fase 3).
3. Recuperação de senha por e-mail e configuração de proxy HTTPS para publicação.