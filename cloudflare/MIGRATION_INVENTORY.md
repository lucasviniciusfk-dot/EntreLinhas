# Entre Linhas — inventário de migração (staging)

Fonte auditada: index.html da branch migration/cloudflare-staging-adapter (blob SHA 380547b80adef1f90b9a3ffe49709ab6bdf2ae1d).
Objetivo: checklist verificável para substituir todos os acessos de dados do frontend por APIs Cloudflare. Não autoriza cutover de produção.

## Estado da integração
- [x] Worker de staging com D1 e R2 vinculados.
- [x] Cliente HTTP Cloudflare isolado em cloudflare-api-client.js.
- [ ] Carregar cliente no index.html e validar sessão Supabase Auth.
- [ ] Substituir todos os acessos PostgREST diretos.
- [ ] Substituir todos os acessos Storage diretos.
- [ ] Portar/revisar RPCs com semântica equivalente.
- [ ] Reproduzir triggers, notificações push, snapshots e realtime.
- [ ] Testes funcionais ponta a ponta em staging.
- [ ] Cutover somente após autorização explícita.

## Tabelas encontradas no frontend
Contagens são ocorrências aproximadas de .from('nome') no HTML; incluem operações select/insert/update/upsert/delete misturadas.

| Tabela | Ocorrências |
|---|---:|
| admin_logs | 7 |
| app_configuracoes | 70 |
| app_notificacoes | 22 |
| chat_mensagens | 20 |
| chat_reacoes | 9 |
| clube_albuns | 12 |
| clube_biblioteca | 7 |
| clube_fotos | 8 |
| clube_livro_atual | 20 |
| clube_livro_participantes | 17 |
| clube_livros_finalizados | 7 |
| clube_mural | 4 |
| clube_mural_reacoes | 9 |
| desafios | 13 |
| leituras | 32 |
| livros | 5 |
| livros_pessoais | 88 |
| metas_diarias | 32 |
| metas_usuarios | 29 |
| push_subscriptions | 1 |
| ranking_temporadas | 2 |
| solicitacoes_validacao | 21 |
| usuario_desafios | 11 |
| usuario_medalhas | 22 |
| usuario_molduras | 13 |
| usuarios | 85 |

## Storage buckets encontrados
- capas (4 referências)
- epubs (7 referências)
- comprovantes (2 referências)

## RPCs encontrados
- admin_remover_conta_app_v69
- entrel_admin_finish_club_v509
- entrel_admin_finish_club_v511
- entrel_apply_request_reward_v507
- entrel_approve_club_finish_v507
- entrel_approve_club_finish_v509
- entrel_approve_club_finish_v511
- entrel_approve_finish_request_v508
- entrel_award_daily_epub_v507
- entrel_award_period_goal_v507
- entrel_finish_club_v507
- entrel_reject_request_v507
- entrel_repair_club_participants_v510
- entrel_retry_pending_rewards_v510
- entrel_submit_club_finish_v509
- entrel_submit_club_finish_v511
- entrel_verified_monthly_progress_v512

## Regras de migração
1. Manter Supabase Auth para login Google e validação de sessão enquanto necessário.
2. Dados de negócio devem ser acessados pelo Worker autenticado; UID vem do token validado, nunca de um userId enviado pelo navegador.
3. Arquivos privados devem usar R2 privado com autorização por proprietário e associação.
4. Não expor uma rota RPC genérica. Cada operação deve ter autorização e validação próprias.
5. Não migrar nem executar admin_remover_conta_app_v69 até revisão específica por ser operação destrutiva.
6. Não desligar Supabase, não alterar GitHub Pages/main e não alterar buckets/Workers de produção durante esta etapa.
7. Nenhum módulo será marcado como migrado só por ter endpoint: a interface deve chamar o endpoint e passar teste funcional.
