# Recompensas semanais e mensais — staging

## Origem das regras

A implementação foi comparada com as funções do Supabase:
- `entrel_award_period_goal_v507(p_user_id, p_kind, p_period_key, p_current, p_target, p_xp, p_points)`
- `entrel_verified_monthly_progress_v512(p_user_id, p_period_key)`

A identidade do usuário no Worker vem exclusivamente do token Supabase validado; o cliente não informa um usuário-alvo.

## Endpoint adicionado

`POST /api/v1/rewards/period`

Corpo:
- `kind`: `weekly` ou `monthly`
- `period_key`: data inicial `YYYY-MM-DD` para semanal; `YYYY-MM` para mensal
- `current`, `target`, `xp`, `points`: valores numéricos da meta/recompensa

Regras preservadas:
- Rejeita tipos e chaves de período inválidos.
- O intervalo semanal tem sete dias; o mensal vai do primeiro dia ao primeiro dia do mês seguinte.
- Limites de data são interpretados no fuso America/Manaus, como no RPC.
- Mensal recalcula o progresso no D1: soma páginas das metas diárias quando a configuração global é de páginas; retorna zero para tipo manual; para livros, conta solicitações aprovadas elegíveis e deduplica por identificador/ciclo/livro, excluindo recompensas automáticas ocultas.
- Sem meta atingida, não credita recompensa.
- Verifica registro automático anterior e recompensas manuais aprovadas no período para evitar pagamento duplicado.
- Usa chave única `period:<usuario>:<tipo>:<período>` em `entrel_reward_claims_v510`; o crédito e o registro de auditoria são feitos em lote D1.
- Registra a recompensa como `system_reward`, `approved`, com `system_hidden=true` e origem `auto_reward_v507:<tipo>:<período>`.

## Cliente

Disponível em `EntreLinhasCloudflare.rewards.awardPeriodGoal(kind, periodKey, current, target, xp, points)`.

## Validação realizada

- Consultadas as definições originais das duas funções no Supabase (somente leitura).
- Conferidas as colunas de `solicitacoes_validacao`, `metas_diarias`, `app_configuracoes` e `entrel_reward_claims_v510` no D1 de staging.
- Executados três `EXPLAIN` com valores sintéticos para validar as consultas de soma mensal, contagem mensal e inserção do registro de recompensa. Todos retornaram sucesso, sem alterar dados (`changed_db=false`, `rows_written=0`).

## Limitações / próximos passos

- A função semanal original confia nos valores `current` e `target` enviados pelo próprio cliente após validar apenas o tipo de meta. O endpoint preserva esse contrato; antes da integração de produção, convém substituir por cálculo server-side se a origem do progresso semanal puder ser definida com fidelidade.
- O endpoint ainda não foi publicado no Worker: a tentativa anterior de deploy de staging foi bloqueada pela proteção da plataforma. Não foi tentado contornar o bloqueio.
- O frontend principal ainda não foi conectado globalmente ao adaptador Cloudflare. Nenhuma mudança foi feita em produção, Supabase ou GitHub Pages.
