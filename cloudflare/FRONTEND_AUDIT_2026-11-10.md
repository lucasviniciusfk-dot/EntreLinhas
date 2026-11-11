# Auditoria estática do frontend — Entre Linhas

Data: 2026-11-10  
Base analisada: `index.html` da branch `migration/cloudflare-integration`. O SHA-1 Git do arquivo analisado foi `380547b80adef1f90b9a3ffe49709ab6bdf2ae1d`, igual ao blob retornado pelo GitHub para `index.html`; portanto, esta auditoria corresponde exatamente ao arquivo versionado.

## Resultado da varredura

- 26 tabelas distintas ainda chamadas diretamente pelo frontend via Supabase Data API.
- 566 chamadas estáticas `.from(...)` referentes a essas tabelas (contagem de ocorrências no código; não representa chamadas em tempo de execução).
- 17 RPCs distintas, em 20 ocorrências estáticas.
- 3 buckets Supabase referenciados no Storage: `capas`, `epubs`, `comprovantes`, em 13 ocorrências.
- 23 ocorrências estáticas de `fetch(...)`.

## Ocorrências por tabela

| Tabela | Ocorrências |
|---|---:|
| livros_pessoais | 88 |
| usuarios | 85 |
| app_configuracoes | 70 |
| leituras | 32 |
| metas_diarias | 32 |
| metas_usuarios | 29 |
| usuario_medalhas | 22 |
| app_notificacoes | 22 |
| solicitacoes_validacao | 21 |
| chat_mensagens | 20 |
| clube_livro_atual | 20 |
| clube_livro_participantes | 17 |
| usuario_molduras | 13 |
| desafios | 13 |
| clube_albuns | 12 |
| usuario_desafios | 11 |
| clube_mural_reacoes | 9 |
| chat_reacoes | 9 |
| clube_fotos | 8 |
| admin_logs | 7 |
| clube_biblioteca | 7 |
| clube_livros_finalizados | 7 |
| livros | 5 |
| clube_mural | 4 |
| ranking_temporadas | 2 |
| push_subscriptions | 1 |

## RPCs encontradas

`admin_remover_conta_app_v69`, `entrel_admin_finish_club_v509`, `entrel_admin_finish_club_v511`, `entrel_apply_request_reward_v507`, `entrel_approve_club_finish_v507`, `entrel_approve_club_finish_v509`, `entrel_approve_club_finish_v511`, `entrel_approve_finish_request_v508`, `entrel_award_daily_epub_v507`, `entrel_award_period_goal_v507`, `entrel_finish_club_v507`, `entrel_reject_request_v507`, `entrel_repair_club_participants_v510`, `entrel_retry_pending_rewards_v510`, `entrel_submit_club_finish_v509`, `entrel_submit_club_finish_v511`, `entrel_verified_monthly_progress_v512`.

## Decisão técnica

Esta varredura é estática e não prova equivalência funcional, autorização/RLS, nem comportamento em todos os fluxos. Não substituir chamadas em massa nem interceptar `fetch` global. A migração das 26 tabelas deve ser feita por domínio, mapeando para cada operação: método, filtros, ordenação, paginação, payload, usuário autenticado, regra de autorização e efeitos colaterais. Manter Supabase como fallback para operações sem paridade comprovada.

## Próxima unidade segura de trabalho

Começar por leitura de perfil e configuração (`usuarios`, `app_configuracoes`), identificando todos os métodos e filtros usados no frontend e comparando com as rotas já existentes no Worker. Só implementar uma rota quando o contrato e a autorização forem conhecidos e testáveis.

Nenhum dado foi alterado no Supabase, D1 ou R2 durante esta auditoria. Nenhuma chamada do frontend foi substituída.
