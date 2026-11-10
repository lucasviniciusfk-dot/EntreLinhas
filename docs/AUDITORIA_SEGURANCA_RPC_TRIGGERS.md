# Auditoria de segurança e lógica do Supabase — base para portar ao Worker

> Consulta somente leitura ao projeto Supabase em 2026-11-09. Nenhuma tabela, política, função ou dado foi alterado.

## Descobertas que mudam o plano de migração

### 1. O frontend chama RPCs com lógica de negócio crítica

Foram confirmadas no banco funções com versões e assinaturas reais, incluindo:

| Função | Argumentos confirmados | Tipo |
|---|---|---|
| entrel_award_daily_epub_v507 | p_user_id text, p_date date | recompensa diária EPUB |
| entrel_award_period_goal_v507 | p_user_id text, p_kind text, p_period_key text, p_current integer, p_target integer, p_xp integer, p_points integer | recompensa de meta |
| entrel_finish_club_v507 | p_participant_id text, p_user_id text | conclusão de participação |
| entrel_submit_club_finish_v511 | p_cycle_id text | envio de finalização do clube |
| entrel_admin_finish_club_v511 | p_ref text, p_cycle_id text | finalização administrativa |
| entrel_approve_club_finish_v511 | p_request_id text, p_reason text | aprovação administrativa |
| entrel_approve_finish_request_v508 | p_request_id text, p_reason text | aprovação de solicitação |
| entrel_apply_request_reward_v507 | p_request_id text, p_user_id text, p_xp integer, p_points integer | aplicar recompensa |
| entrel_reject_request_v507 | p_request_id text, p_reason text | rejeição de solicitação |
| entrel_repair_club_participants_v510 | sem argumentos | reparo administrativo |
| entrel_retry_pending_rewards_v510 | p_user_id text | reprocessamento de recompensas |
| entrel_verified_monthly_progress_v512 | p_user_id text, p_period_key text | progresso mensal verificado |
| admin_remover_conta_app_v69 | admin_user_id text, target_user_id text | remoção administrativa de conta |

Há versões anteriores e overloads UUID/text de algumas funções. A versão chamada pelo HTML deve ser respeitada, não simplesmente escolher a mais nova pelo nome.

### 2. As RPCs usam auth.uid() e várias são SECURITY DEFINER

A maioria das funções de recompensa, aprovação e finalização está marcada SECURITY DEFINER e consulta auth.uid(). Um Worker que usa uma conexão administrativa com D1 não herda automaticamente o contexto JWT/Postgres do usuário. Não se deve chamar uma função privilegiada confiando em user_id enviado pelo navegador.

Portabilidade segura: validar Bearer no Worker, derivar o usuário exclusivamente da resposta Auth, validar papel e propriedade no Worker, e implementar a operação como uma transação idempotente no D1. As ações de recompensa devem usar chave única de reivindicação e atualizar saldo/registro de forma atômica. Não expor endpoint genérico para executar SQL ou chamar RPC arbitrária.

### 3. Existem triggers com efeitos colaterais que precisam ser substituídos

A auditoria encontrou triggers para:
- atualizar snapshots globais e individuais após alterações em usuários, biblioteca, leituras, metas, clube, mural, ranking, medalhas e notificações;
- disparar push após INSERT em app_notificacoes e chat_mensagens;
- validar solicitações de revisão manual de metas;
- corrigir identificadores de metas diárias.

Os snapshots são materializações/cache, não devem ser copiados como se fossem tabelas de origem sem entender o consumidor. Push precisa virar integração própria (Cloudflare Queues/serviço de envio) ou rotina explícita. A validação manual deve ser executada no endpoint transacional correspondente.

### 4. RLS atual contém políticas permissivas amplas

A consulta a pg_policies encontrou, em várias tabelas do aplicativo, políticas antigas do tipo ALL com qual=true e with_check=true para anon/authenticated. Há também políticas específicas de propriedade e papel que coexistem com essas regras amplas.

Consequência: não usar as políticas atuais como prova de autorização correta nem copiá-las literalmente. O Worker precisa adotar uma matriz explícita e mais restritiva:
- dados pessoais: proprietário autenticado;
- conteúdo público: somente campos efetivamente públicos;
- clube: participante ou papel autorizado conforme ação;
- chat/mural: leitura de conteúdo visível, edição pelo autor e moderação por admin;
- validações, recompensas, ranking e administração: endpoints específicos com verificação de papel;
- push subscriptions: somente o próprio usuário;
- nenhuma permissão administrativa derivada de parâmetro do cliente.

### 5. Cuidado especial: remoção de conta

admin_remover_conta_app_v69 é SECURITY DEFINER. Seu corpo tenta apagar objetos do Storage e percorre colunas de usuário em várias tabelas para apagar registros. Isso é uma operação destrutiva transversal. Não portar nem disponibilizar essa ação durante a migração inicial. Exige plano específico, inventário de dependências, confirmação explícita, auditoria e estratégia de retenção.

## Sequência segura para destravar a implementação

1. Fechar contratos de domínio a partir do código do frontend e das funções reais.
2. Implementar primeiro leitura/escrita pessoal e perfil com autorização no Worker.
3. Implementar metas/recompensas em transações D1 idempotentes, com testes de repetição e concorrência.
4. Implementar clube e solicitações de validação com checagem de participante/admin em cada rota.
5. Implementar chat, mural e notificações com regras de visibilidade, edição e moderação.
6. Substituir triggers de push e snapshots por rotinas explícitas.
7. Só então adaptar fila offline, anexos e storage legados.
8. Rodar testes de integração e autorização antes de qualquer corte.

## Bloqueios de deploy

O deploy staging mais recente foi bloqueado pela ferramenta de segurança. Esse bloqueio não deve ser contornado por chamadas alternativas ou credenciais diferentes. É possível continuar a implementação e os testes locais/estáticos na branch, mas validação HTTP real exige que o deploy seja permitido pelo mecanismo normal.

## Limites da auditoria

Esta nota registra assinaturas, atributos de segurança e efeitos observados. A implementação ainda deve revisar os corpos completos das funções por operação e testar os resultados esperados. Não houve escrita no Supabase, não houve cópia de dados e não houve alteração de produção.
