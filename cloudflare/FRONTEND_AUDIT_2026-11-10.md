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


## Atualização de implementação — 2026-11-11

Foi adicionada ao Worker de staging a rota autenticada `PATCH /api/v1/me`.

- Autentica o token pela sessão Supabase Auth existente; o ID do usuário vem exclusivamente do token validado, nunca do corpo.
- Permite atualizar somente `nome`, `bio`, `livro_favorito`, `perfil_privado` e `biblioteca_publica`.
- Não permite alterar `id`, `email`, `xp`, `pontos`, `nivel`, `is_admin`, `admin_principal`, banimento ou campos de auditoria.
- Mantém os bindings existentes de D1, R2 e Supabase Auth ao atualizar o script.
- Upload do Worker de staging confirmado pela API Cloudflare: tag `7f4f365bdfe84a19bbb44abbfada48a4`, deployment ID `c3efa67e93804ce6904ca0b7265a205d`.

### Limitação de validação
A tentativa de testar a URL pública do Worker a partir deste ambiente retornou uma página `Forbidden` do ambiente de execução, antes de ser possível validar o JSON da resposta. Portanto, a publicação do script foi confirmada, mas o teste HTTP funcional/autenticado ainda não foi aprovado.

### Situação do item 1
**Não concluído.** Esta alteração cobre somente uma operação do domínio de perfil. O frontend ainda precisa ser integrado para usar a rota, e continuam pendentes as operações das outras tabelas, as RPCs, as configurações `app_configuracoes`, as operações administrativas e o Storage. Não fazer cutover nem remover Supabase.


## Cliente frontend opt-in — 2026-11-11

Foi criado `cloudflare/entrelinhas-api-client.js` na branch de migração (commit `3b6ce0514fecf38ef548e629959193c3873b5a5f`). O módulo oferece `getMe()` e `updateMe()`, obtém o access token da sessão Supabase Auth existente e chama o Worker de staging. Ele é opt-in: não intercepta `fetch`, não substitui o SDK Supabase e não foi incluído no `index.html` principal.

A integração automática no HTML principal foi deliberadamente suspensa porque a auditoria encontrou 26 tabelas, 17 RPCs e três buckets ainda usados diretamente. Trocar o cliente globalmente antes de implementar e testar os contratos quebraria fluxos não cobertos. O cliente isolado não constitui cutover nem prova de compatibilidade funcional.

### Estado real
- Perfil próprio: GET existente; PATCH publicado em staging; cliente isolado criado; integração e teste autenticado pendentes.
- Configurações: schema D1 consultado. `app_configuracoes` tem PK em `usuario_id` e campos `configuracoes`, `chave`, `valor`, `ativo`; não há índice único separado por chave. Não implementar upsert por `(usuario_id,chave)` sem reconciliar a diferença entre schema e padrões de uso do frontend.
- Migração completa: ainda não aprovada; frontend continua dependente do Supabase para operações sem equivalência verificada.


## Correção de validação do PATCH de perfil — 2026-11-11

O Worker de staging recebeu uma revisão adicional (deployment `732ad39d-342e-4c69-9947-6dd9b25e18a7`, versão `4c5e2a79-8b6a-48d2-b6fa-f47ed75b9507`, 100% do tráfego do Worker de staging):
- `bio` e `livro_favorito` agora aceitam string vazia ou `null` para permitir limpar esses campos opcionais.
- A atualização só é considerada confirmada quando D1 informa exatamente uma linha alterada; antes a condição não detectava o caso de zero linhas.
- As quatro bindings originais (D1, R2 e as duas configurações Supabase Auth) foram preservadas.

A publicação e a versão ativa foram confirmadas pela API de deployments do Cloudflare. O teste funcional autenticado ainda precisa ser executado no navegador com a conta Google do proprietário; não foi declarado aprovado.


## Marco 1/10 — staging e CI do pull request — 2026-11-11

Verificações concluídas neste marco:
- Worker `entrelinhas-api-staging`: deployment ativo `732ad39d-342e-4c69-9947-6dd9b25e18a7`, versão `4c5e2a79-8b6a-48d2-b6fa-f47ed75b9507`, 100% do tráfego do Worker de staging.
- Bindings lidas após o deploy: D1 `DB`, R2 `FILES`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_URL` presentes.
- PR #2: head `06d405bd16e9054aa514991f1bdd4775c3542845`; os dois checks de deploy preview Netlify retornaram `success` para esse head.
- PR permanece draft e `mergeable=false`; nenhum merge/cutover foi feito.

Limite deste marco: os checks `success` confirmam a geração dos previews, não o comportamento funcional no navegador. A URL pública do Worker e os previews não puderam ser abertos por este ambiente de execução, e a API D1 retornou `SQLITE_AUTH` nas consultas de inventário desta tentativa. Portanto, login Google, chamadas autenticadas e fluxo de arquivos continuam aguardando teste funcional real.


## Marco 2/10 — teste autenticado de leitura de perfil no staging

A página `cloudflare-staging.html` agora carrega o cliente de API Cloudflare junto ao adaptador RPC, captura a instância real do Supabase criada pelo frontend sem substituir o fluxo de login e adiciona o botão **Testar perfil**. Após login Google, o botão obtém o access token da sessão Supabase e chama `GET /api/v1/me` no Worker. O teste é somente leitura: não altera perfil nem dados.

A página mostra o resultado real da chamada e registra o payload no console. Se não houver sessão, se o Worker negar a chamada ou se a resposta falhar, mostra a falha sem recorrer automaticamente ao Supabase. O staging não faz cutover de operações diretas de tabelas.

Este marco implementa o teste no ambiente, mas ainda não foi executado por uma sessão Google real do usuário; portanto, não declarar a leitura autenticada aprovada até o botão retornar sucesso no navegador.


## Marco 3/10 — bloqueio de RPCs do clube sem paridade comprovada

Auditoria do adaptador encontrou cinco RPCs de conclusão do clube encaminhadas ao Worker apesar de a documentação de migração registrar que essas operações ainda não têm paridade funcional comprovada. Isso criava risco de alterar aprovação, ciclo ou recompensa ao usar staging. Removi os cinco encaminhamentos (`entrel_approve_club_finish_v507/v509/v511` e `entrel_submit_club_finish_v509/v511`): agora caem no `default` e executam a RPC original do Supabase. Nenhuma operação de dados foi executada por essa mudança; é uma correção preventiva do roteamento.

Verificação após commit: os cinco nomes não aparecem mais como casos encaminhados e o fallback `originalRpc(name, args)` permanece ativo. Isso não prova a paridade do Worker; mantém a operação original até que ela seja implementada e testada.


## Marco 4/10 — bateria de leituras autenticadas no staging

Ampliei o botão de teste da página `cloudflare-staging.html`: após login Google, executa nove requisições GET autenticadas e somente de leitura para perfil, livro atual do clube, biblioteca do clube, biblioteca pessoal, metas, leituras, notificações, chat e desafios. Cada resultado mostra HTTP, sucesso/falha e mensagem de erro; também é exibido no console e em um relatório na tela. Nenhuma escrita, recompensa ou alteração de dados é feita por essa bateria.

Verificação realizada no código: as nove rotas estão presentes no teste e os resultados são contabilizados individualmente. A execução depende de abrir o preview, fazer login Google e clicar em **Testar perfil** (o botão foi mantido, embora agora execute a bateria). Até essa execução, os endpoints não estão declarados funcionalmente aprovados.


## Marco 5/10 — validação do preview após as alterações dos marcos 2–4

Consultei novamente o status combinado do commit atual do PR #2 (`a20c7fbcecb69b6a7365becdde4279d57ed2c1b4`). Os dois deploy previews reportaram `success`:
- `netlify/imaginative-biscotti-5dfac8/deploy-preview`
- `netlify/entrelinhasoff/deploy-preview`

Os cinco arquivos esperados permanecem no PR, incluindo a página de staging, cliente API, adaptador RPC e auditoria. O PR segue draft e `mergeable=false`; nenhum merge foi feito. Este resultado valida publicação do preview para o commit consultado, não substitui o teste funcional autenticado no navegador nem aprova cutover.


## Marco 6/10 — cobertura de álbuns e fotos do clube no smoke test

A inspeção do Worker confirmou que existem rotas autenticadas de leitura para `GET /api/v1/club/albums` e `GET /api/v1/club/albums/photos?album_id=...`. Ampliei a bateria do preview para testar a listagem de álbuns e, quando existir um álbum ativo, consultar até cinco fotos desse álbum. Quando não houver álbum ativo, a consulta de fotos é marcada como não aplicável, sem criar registros nem alterar dados.

O teste usa o token da sessão Google/Supabase e a URL correta do Worker de staging. A alteração foi verificada estaticamente no arquivo; a execução real no navegador continua pendente.


## Marco 7/10 — validação do conteúdo privado das fotos

Ampliei o teste somente-leitura do clube: depois de listar álbuns e fotos, ele tenta baixar o conteúdo da primeira foto retornada pela rota autenticada `/api/v1/club/albums/photos/:id/content`. O resultado só é aprovado se a resposta HTTP for bem-sucedida, o corpo tiver bytes e o `Content-Type` for de imagem. Se o álbum não tiver fotos, o teste registra corretamente que essa verificação não se aplica. Nenhum arquivo é enviado, alterado ou removido.

Commit da alteração: `31fd2c6e65d71011c9f6713b6920034d2e945ab8`. A validação foi estática; ainda depende de execução no navegador com a sessão Google real.


## Marco 8/10 — cliente Cloudflare com leitura do clube

O cliente reutilizável `cloudflare/entrelinhas-api-client.js` agora expõe `getClubAlbums(limit)`, `getClubAlbumPhotos(albumId, limit)` e `getClubPhotoContent(photoId)`. As chamadas usam o token da sessão Supabase Auth, validam os IDs antes de montar as rotas e limitam os parâmetros de paginação. O download de foto trata resposta binária, exige `Content-Type` de imagem e rejeita conteúdo vazio. O módulo continua opt-in: não intercepta `fetch`, não redireciona chamadas antigas e não altera dados.

Commit: `7241433cf316b408160465942011b00c553b71d8`. Implementação registrada; execução funcional com a sessão Google ainda pendente.


## Marco 9/10 — teste do cliente integrado, não apenas das rotas

A bateria autenticada do preview agora chama os métodos públicos do módulo `EntreLinhasCloudflareApi` para listar álbuns, listar fotos e baixar o conteúdo binário da primeira foto. Assim o teste cobre também a integração entre o módulo reutilizável e as rotas do Worker, incluindo validação de tipo e tamanho do arquivo. A etapa é somente leitura e não muda dados do clube.

Commit de código: `ab2485bc8a52b4e5df854d5005b5fbeb2dae2041`. A alteração estática foi registrada; falta executar o preview autenticado com Google para obter resultados HTTP reais.
