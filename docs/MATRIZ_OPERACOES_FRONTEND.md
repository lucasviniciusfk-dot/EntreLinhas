# Matriz de operações do frontend — migração Cloudflare

> Extraída por análise estática do HTML v505 anexado. Contagens são ocorrências aproximadas de métodos encadeados próximas a cada `.from()`; podem sobrepor trechos e não substituem revisão de cada fluxo.

## Tabelas e operações observadas

| Tabela | SELECT | INSERT | UPDATE | UPSERT | DELETE |
|---|---:|---:|---:|---:|---:|
| admin_logs | 0 | 7 | 1 | 0 | 0 |
| app_configuracoes | 33 | 14 | 22 | 20 | 3 |
| app_notificacoes | 9 | 12 | 6 | 3 | 0 |
| chat_mensagens | 11 | 6 | 5 | 0 | 5 |
| chat_reacoes | 3 | 0 | 1 | 4 | 5 |
| clube_albuns | 6 | 3 | 5 | 0 | 0 |
| clube_biblioteca | 6 | 1 | 1 | 0 | 0 |
| clube_fotos | 5 | 1 | 2 | 1 | 2 |
| clube_livro_atual | 15 | 0 | 6 | 3 | 0 |
| clube_livro_participantes | 7 | 1 | 8 | 2 | 2 |
| clube_livros_finalizados | 5 | 2 | 0 | 0 | 0 |
| clube_mural | 0 | 1 | 3 | 0 | 0 |
| clube_mural_reacoes | 1 | 2 | 0 | 0 | 8 |
| desafios | 7 | 4 | 5 | 0 | 0 |
| leituras | 15 | 20 | 13 | 7 | 1 |
| livros | 3 | 1 | 2 | 0 | 0 |
| livros_pessoais | 69 | 15 | 22 | 18 | 1 |
| metas_diarias | 16 | 3 | 7 | 11 | 0 |
| metas_usuarios | 14 | 3 | 3 | 14 | 0 |
| push_subscriptions | 1 | 0 | 0 | 0 | 0 |
| ranking_temporadas | 0 | 2 | 1 | 0 | 0 |
| solicitacoes_validacao | 13 | 1 | 7 | 0 | 2 |
| usuario_desafios | 9 | 0 | 1 | 2 | 0 |
| usuario_medalhas | 7 | 3 | 6 | 7 | 2 |
| usuario_molduras | 4 | 2 | 4 | 6 | 2 |
| usuarios | 48 | 4 | 48 | 10 | 1 |

Storage buckets observados no frontend: capas, epubs e comprovantes. Esses nomes representam buckets, não tabelas D1.

## RPCs encontradas

| RPC | Ocorrências |
|---|---:|
| entrel_award_daily_epub_v507 | 2 |
| entrel_finish_club_v507 | 2 |
| entrel_award_period_goal_v507 | 2 |
| admin_remover_conta_app_v69 | 1 |
| entrel_apply_request_reward_v507 | 1 |
| entrel_reject_request_v507 | 1 |
| entrel_approve_finish_request_v508 | 1 |
| entrel_approve_club_finish_v507 | 1 |
| entrel_submit_club_finish_v509 | 1 |
| entrel_admin_finish_club_v509 | 1 |
| entrel_approve_club_finish_v509 | 1 |
| entrel_repair_club_participants_v510 | 1 |
| entrel_retry_pending_rewards_v510 | 1 |
| entrel_submit_club_finish_v511 | 1 |
| entrel_admin_finish_club_v511 | 1 |
| entrel_approve_club_finish_v511 | 1 |
| entrel_verified_monthly_progress_v512 | 1 |

## Ordem de migração recomendada por dependência

1. Identidade, perfil e configurações: usuarios, app_configuracoes, app_notificacoes.
2. Biblioteca e leitura: livros, livros_pessoais, leituras, file_assets e associação privada de arquivos.
3. Gamificação pessoal: metas_usuarios, metas_diarias, desafios, usuario_desafios, usuario_medalhas, usuario_molduras.
4. Operações de clube: clube_livro_atual, clube_livro_participantes, clube_biblioteca, clube_albuns, clube_fotos, clube_livros_finalizados.
5. Comunidade: chat_mensagens, chat_reacoes, clube_mural, clube_mural_reacoes.
6. Moderação e administração: solicitacoes_validacao, admin_logs, ranking_temporadas, push_subscriptions.
7. Storage: migrar os três buckets e o legado R2 com inventário, checksum e reconciliação das referências antes de qualquer remoção.

## Regras para implementar os endpoints

- Toda escrita deve validar a sessão e as permissões no Worker; nunca confiar em user_id enviado pelo navegador.
- Respeitar filtros e escopo originais: dados pessoais por usuário, clube por associação/visibilidade e administração por papel.
- Preservar comportamento de `.select()` após escrita, `.single()`, `.maybeSingle()`, ordenação, limites e conflitos do UPSERT.
- Ações de recompensa e conclusão devem ser transacionais/idempotentes; RPCs de gamificação não devem ser convertidas em múltiplas escritas independentes.
- Exclusões devem ser revisadas por semântica: soft-delete, remoção de relação ou exclusão definitiva não são equivalentes.
- Operações offline antigas devem continuar sendo interpretadas pelo replay atual até existir migração versionada e testada.

## Limite desta matriz

A matriz não revela RLS, triggers, código interno das RPCs, regras de papéis nem payloads completos. Esses pontos precisam ser extraídos do schema e das funções reais antes de implementar cada rota. Não usar esta tabela isoladamente para liberar operações administrativas ou de recompensa.