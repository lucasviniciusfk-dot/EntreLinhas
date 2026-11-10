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


## Auditoria de reconciliação — 10/11/2026

### Etapa 1 — D1 (reconciliação de dados)
- [x] Comparadas as 48 tabelas públicas da origem Supabase com as 48 tabelas de negócio correspondentes no D1 staging.
- [x] Contagens iguais em todas as 48 tabelas: 9.347 registros na origem e 9.347 no D1.
- [x] Divergências anteriormente observadas foram reconciliadas: `solicitacoes_validacao` 232/232, `ranking_snapshots` 1.573/1.573 e `entrel_user_snapshot_v260` 17/17.
- [x] `PRAGMA foreign_key_check` retornou zero violações.
- [ ] `PRAGMA integrity_check` não pôde ser executado: a API D1 retornou SQLITE_AUTH para esse PRAGMA. Não declarar integridade física total verificada por esse comando.
- Observação: o D1 contém também as duas tabelas auxiliares `file_assets` e `book_file_assets`, além das 48 tabelas da origem. As duas auxiliares estão vazias neste momento.

### Etapa 2 — R2 (auditoria de arquivos)
- [x] Buckets Supabase identificados: `capas` (público) e `epubs` (privado); consulta a `storage.objects` retornou zero objetos.
- [x] Bucket R2 legado `entrelinhas` auditado somente por metadados: 1.171 objetos, 2.320.923.595 bytes (~2,16 GiB): 818 EPUBs, 220 capas, 113 fotos de encontros e 20 avatares.
- [x] Bucket privado de staging `entrelinhas-staging-private` confirmado vazio.
- [x] Referências em `livros` e `livros_pessoais` comparadas com as chaves do R2 legado: 222 referências públicas R2, 127 chaves únicas; 206 referências encontradas e 16 referências ausentes (13 chaves únicas). Também existem referências em data URI, caminhos locais/legados e URLs externas, que não devem ser tratadas como objetos R2.
- [ ] Cópia dos objetos para o bucket privado de staging e criação das linhas em `file_assets`/associações ainda pendentes. Não copiar dados reais de usuários para staging sem fluxo de migração aprovado; não modificar nem apagar o bucket legado de produção.
- [ ] Corrigir ou reconciliar as 13 chaves R2 referenciadas mas ausentes antes de marcar a migração de arquivos como concluída.

### Limites de segurança preservados
- Nenhum objeto foi criado, alterado ou excluído nos buckets de produção.
- Nenhuma linha de usuário foi alterada nesta auditoria.
- Supabase Auth permanece preservado.
- Nenhuma publicação, merge ou alteração em GitHub Pages/main foi feita.
