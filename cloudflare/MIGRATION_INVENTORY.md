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
- Observação: o D1 contém também as duas tabelas auxiliares `file_assets` e `book_file_assets`, além das 48 tabelas da origem. As duas tabelas auxiliares foram populadas em staging em 10/11/2026: `file_assets` com 1.089 metadados verificados e `book_file_assets` com 56 associações verificadas. A contagem de negócio (48 tabelas) não foi alterada por essa operação.

### Etapa 2 — R2 (auditoria de arquivos)
- [x] Buckets Supabase identificados: `capas` (público) e `epubs` (privado); consulta a `storage.objects` retornou zero objetos.
- [x] Bucket R2 legado `entrelinhas` inventariado: 1.171 entradas listadas (inclui 4 marcadores de pasta sem conteúdo) e 1.167 objetos reais, totalizando 2.320.923.595 bytes (~2,16 GiB): 817 EPUBs, 219 capas, 112 fotos de encontros e 19 avatares.
- [x] Autorização do usuário para copiar objetos reais do bucket legado para o bucket privado de staging recebida em 10/11/2026.
- [x] Cópia concluída para `entrelinhas-staging-private`: 1.167/1.167 objetos reais, 2.320.923.595 bytes. Comparação final por chave, tamanho e ETag: 1.167 correspondências, zero ausências e zero divergências.
- [x] Os 7 objetos adicionais encontrados no destino são partes de um arquivo de snapshots de migração (`migration-archive/user-snapshots-v260/...`), não são contados como objetos do bucket legado.
- [ ] Reconciliar 14 chaves R2 distintas referenciadas em registros antigos, ausentes tanto no bucket legado quanto no staging. São referências concentradas em duplicatas antigas de dois títulos; existem registros paralelos dos mesmos títulos com arquivos mais recentes. Nenhuma referência de usuário foi reescrita automaticamente.
- [x] Popular `file_assets` com 1.089 metadados verificados: 784 EPUBs, 219 capas, 19 avatares e 67 fotos com proprietário identificado. Todos os 1.089 object_keys existem no R2 e os tamanhos conferem.
- [x] Popular `book_file_assets` com 56 vínculos verificados de livros pessoais ativos: 18 EPUBs e 38 capas. Zero vínculos quebrados e zero divergências entre proprietário do vínculo e do arquivo.
- [ ] Identificar o proprietário de mais 45 fotos de encontros antes de cadastrá-las em `file_assets`; não atribuir proprietário por suposição.
- Observação: 33 objetos R2 têm zero bytes e foram preservados, mas não podem ser cadastrados em `file_assets` devido à restrição `size_bytes > 0`. Os 7 objetos `migration-archive/...` são artefatos de snapshot e ficam fora do inventário de arquivos de usuário.
- Observação: existem também referências em data URI, caminhos locais/legados e URLs externas, que não devem ser tratadas como objetos R2.

### Limites de segurança preservados
- Nenhum objeto foi criado, alterado ou excluído nos buckets de produção.
- Nenhuma linha de usuário foi alterada nesta auditoria.
- Supabase Auth permanece preservado.
- Nenhuma publicação, merge ou alteração em GitHub Pages/main foi feita.


### Etapa 3 — autenticação Google e integração do app com Worker (iniciada em 10/11/2026)

**Verificações realizadas**
- [x] Confirmado no Cloudflare que o Worker `entrelinhas-api-staging` está implantado e com deployment ativo em 100%.
- [x] Confirmado binding D1 `DB` apontando para o banco `entrelinhas-staging`.
- [x] Confirmado binding R2 `FILES` apontando para `entrelinhas-staging-private`.
- [x] Confirmadas as configurações `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` usadas para validar tokens Supabase Auth no Worker.
- [x] Revisado o middleware do Worker: valida o Bearer token em `/auth/v1/user`, deriva o UID do token e consulta o perfil em D1; não confia em UID enviado pelo navegador.
- [x] Inventariadas rotas de staging existentes para perfil, biblioteca, leitura, metas, progresso, desafios, arquivos, clube, notificações, chat, solicitações administrativas e recompensas.
- [x] Confirmada a existência do cliente isolado `cloudflare-api-client.js` e do adaptador `cloudflare-club-adapter.js`.
- [x] GitHub Actions `Cloudflare staging checks` concluiu com sucesso no commit `acbdbb42a6d6288ae1458ccc0db40e7de1e1ad23`, incluindo sintaxe do Worker, sintaxe do cliente e testes de contrato locais.

**Pendências desta etapa**
- [ ] Validar a sessão Google/Supabase Auth em execução real no ambiente de staging, sem compartilhar senha ou token.
- [ ] Integrar/carregar o cliente Cloudflare no `index.html` do app; o cliente permanece isolado e a integração real do frontend ainda não está ativa. O `index.html` tem 5,24 MB e não pôde ser recuperado pelo conector de leitura do GitHub nesta sessão; não fazer substituição parcial ou regravação do arquivo inteiro sem cópia íntegra.
- [ ] Migrar os módulos do frontend gradualmente para os contratos do Worker, começando por perfil, biblioteca e leitura.
- [ ] Mapear e portar as regras/RPCs/triggers restantes com autorização, idempotência e semântica equivalente.
- [ ] Adaptar a fila offline sem perder nem descartar operações antigas.
- [ ] Testar permissões de usuário comum e administrador, erros de sessão e isolamento de dados.

**Limites desta verificação**
- A leitura da configuração e dos deployments foi feita pela API Cloudflare. O deployment ativo está em 100%, com D1/R2/Auth bindings confirmados. O teste HTTP direto de `/health` e o teste autenticado de upload/download ainda precisam ser executados no navegador do usuário; não declarar a rota funcional com base apenas na configuração.
- Nenhum segredo foi exibido ou alterado.
- Nenhum deploy, alteração em produção, merge ou cutover foi realizado nesta auditoria.


### Atualização da cópia R2 — 10/11/2026
- Resultado final da comparação: origem com 1.167 objetos reais / 2.320.923.595 bytes; destino com os mesmos 1.167 objetos, além de 7 partes de arquivo de snapshots previamente existentes.
- Todos os objetos da origem têm correspondência no destino com tamanho e ETag iguais; zero divergências.
- Os objetos de origem incluem 33 arquivos de zero bytes; também foram preservados no destino com o mesmo ETag.
- Nenhum objeto foi alterado ou removido no bucket legado `entrelinhas`.
- Nenhuma linha D1 foi modificada durante a cópia.
- Próximos passos da Etapa 2: resolver as 13 chaves referenciadas mas ausentes e popular as tabelas auxiliares somente com associações verificadas; testar download/controle de acesso pelo Worker.


### Atualização de reconciliação de metadados R2 — 10/11/2026
- Inventário completo do bucket de staging: 1.174 objetos, sendo 1.167 copiados do legado, 7 artefatos `migration-archive`, e 33 objetos de zero bytes preservados.
- Tabelas auxiliares D1 preenchidas: `file_assets` = 1.089 linhas; `book_file_assets` = 56 linhas.
- Distribuição de `file_assets`: 784 `epub`, 219 `cover`, 19 `avatar`, 67 `club-photo`.
- Auditoria cruzada R2 ↔ D1: zero chaves ausentes entre os 1.089 metadados, zero divergências de tamanho, zero vínculos quebrados e zero divergências de proprietário nos 56 vínculos.
- Permanecem 14 referências antigas sem objeto no bucket legado nem no staging; não foram alteradas para evitar modificar silenciosamente livros de usuários.
- Permanecem 45 fotos sem proprietário comprovável e 33 objetos vazios sem metadados D1 (restrição `size_bytes > 0`).
- Nenhum objeto do bucket legado ou de produção foi alterado/excluído. Nenhuma das 48 tabelas de negócio foi modificada; as escritas ocorreram apenas nas duas tabelas auxiliares do D1 de staging.

### Próximo bloqueio de Etapa 3
- O Worker já tem rotas e middleware, e o CI local do cliente/Worker passou. A migração do frontend não pode ser marcada como feita enquanto `index.html` não carregar `cloudflare-api-client.js` e os módulos não chamarem os endpoints. A validação real da sessão Google/Supabase Auth e o teste HTTP autenticado continuam pendentes.
