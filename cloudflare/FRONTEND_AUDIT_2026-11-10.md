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


## Confronto com o Worker de staging (leitura direta do script implantado)

O script `entrelinhas-api-staging` foi lido pela API da conta Cloudflare; o snapshot retornado tinha 95.808 caracteres. Foram identificadas rotas para perfil (`GET /api/v1/me`), leitura, metas, progresso mensal, biblioteca pessoal, notificações, chat, desafios, álbuns/fotos do clube, solicitações administrativas, recompensas e arquivos.

O código SQL do Worker referencia estas tabelas do frontend: `usuarios`, `app_configuracoes`, `app_notificacoes`, `chat_mensagens`, `chat_reacoes`, `clube_albuns`, `clube_biblioteca`, `clube_fotos`, `clube_livro_atual`, `clube_livro_participantes`, `desafios`, `leituras`, `livros_pessoais`, `metas_diarias`, `metas_usuarios`, `solicitacoes_validacao`, `usuario_desafios`.

Estas nove tabelas encontradas no frontend não apareceram nas instruções SQL do Worker nesta leitura: `admin_logs`, `clube_livros_finalizados`, `clube_mural`, `clube_mural_reacoes`, `livros`, `push_subscriptions`, `ranking_temporadas`, `usuario_medalhas`, `usuario_molduras`.

**Importante:** aparecer em uma consulta SQL não prova que todas as operações do frontend naquela tabela já estejam cobertas. Por exemplo, a rota de perfil observada é somente GET; não foi identificada nessa rota uma operação de atualização de perfil. A compatibilidade deve ser conferida por operação e não apenas por nome de tabela.


## Detalhamento do primeiro domínio proposto: perfil e configurações

A inspeção do HTML integral (5.225.332 caracteres) confirmou que o domínio `usuarios` não é somente leitura. O frontend usa:
- leitura do próprio perfil por `id`;
- criação do perfil durante o login (insert);
- atualização de perfil e preferências (update);
- upsert do perfil;
- listagem de membros para telas administrativas e recursos sociais;
- leitura/atualização de XP, pontos e ranking;
- alterações de moldura e visibilidade pública.

No Worker observado existe `GET /api/v1/me`, que devolve campos do próprio perfil. Nesta leitura não foi identificada uma rota equivalente de PATCH/PUT para atualizar perfil, nem rota de listagem administrativa de usuários com verificação explícita de admin. Portanto, não se pode trocar as operações de escrita ou listagem por essa rota GET.

A tabela `app_configuracoes` tem operações de select, insert, update, upsert e delete, tanto para preferências por usuário quanto para configurações globais, metas e marcadores de recompensa. O Worker lê `app_configuracoes` internamente para algumas rotas, mas não foi identificada uma API CRUD genérica equivalente. Uma rota genérica sem autorização por chave/escopo seria insegura: configurações globais, configurações pessoais e marcadores de recompensa têm regras diferentes.

### Critério de implementação
Não alterar o frontend ainda. Primeiro especificar endpoints separados e validar:
1. perfil próprio: somente campos permitidos, nunca permitir que o cliente altere `is_admin`, `admin_principal` ou identidade;
2. administração de membros: exigir papel admin validado no servidor;
3. configurações pessoais: restringir sempre ao usuário autenticado;
4. configurações globais e recompensas: autorização administrativa e idempotência por chave;
5. login: manter criação/recuperação de perfil compatível com Supabase Auth/Google.

Essa análise fecha o contrato do primeiro domínio e evita uma substituição insegura por CRUD irrestrito. Ainda não é implementação de endpoint nem teste autenticado.
