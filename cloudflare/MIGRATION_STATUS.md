# Migração Entre Linhas — 2026-11-11

**Ainda não aprovada para cutover de produção.** O Supabase Auth/Google permanece ativo.

## Base verificada

- PR #4 aberto, head inicial `a49da07`, sobre `main c1dd361`.
- Actions run `43037087094` falhou em `Apply guarded profile bridge`: `Profile function boundary not found; aborting.` Nenhuma alteração no HTML foi feita pelo workflow.
- Causa: o script procurava os caracteres literais `\\n` em vez da quebra de linha e ignorava CRLF.
- Os oito commits recentes de main continuam ancestrais desta branch. Sem rebase nem force push.
- Worker publicado recuperado e versionado em `worker.mjs`, com schema e índices capturados. Não se presumiu que o código estivesse no repositório.
- Endereço confirmado por HTTP: `https://entrelinhas-api-staging.lucasviniciusfk.workers.dev`. Os clientes anteriores omitiam o segundo `f`.

## Perfil implementado

- Login/bootstrap e edição real `saveProfileV166` ligados ao cliente de API.
- O canário usa `index.html?cf_profile=1`. A entrada normal mantém Supabase durante a validação com Google.
- Um escritor por conta/página. A leitura inicial pode escolher Supabase se D1 estiver indisponível; após confirmar Cloudflare, erros não provocam escrita no Supabase.
- PATCH envia apenas campos editáveis. Não atualiza XP, pontos, IDs ou papel administrativo.
- Backend valida identidade pelo Supabase Auth, moldura desbloqueada, propriedade do avatar e campos parciais. Bootstrap não concede administração a partir de metadata.
- Foto nova: upload privado R2, referência estável em D1 e Blob URL apenas para exibição autenticada.
- Campos vazios e booleanos false preservados; interface atualizada após resposta confirmada.
- Não se cria uma nova conquista ao selecionar uma moldura.

## Validação

- Testes de integração com Miniflare/workerd, D1 e R2 locais; autenticação externa é substituída explicitamente nos testes.
- Testes de cliente cobrem fonte única, falha ambígua, fallback inicial, identidade e normalização.
- Os 264 scripts inline são compilados para verificar sintaxe.
- Google real e gravação autenticada no Worker remoto ainda dependem de execução com a conta do usuário no navegador. Não foram simulados como testes remotos.

## Bloqueios de cutover

- Vários domínios e rotinas de sincronização ainda usam Supabase Data API/Storage.
- Fontes antigas de perfil em outros sincronizadores e telas sociais ainda exigem revisão antes de ativar Cloudflare globalmente.
- Comparação integral de dados e arquivos deve terminar e as diferenças devem ser reconciliadas com backup.
- Push continua dependente do webhook/Edge Function Supabase; mover leitura de notificações não comprova entrega de push.
- Nenhuma tabela, usuário, histórico, arquivo existente ou dado extra do R2 foi apagado.

## Etapas adicionais executadas

| Etapa | Arquivos principais | Commits | Validação |
|---|---|---|---|
| Base implantada versionada | worker.mjs, schema.staging.sql, indexes.staging.sql | 20ed86d | fonte do Worker e bindings conferidos |
| Perfil real | index.html, entrelinhas-profile-data.js, domains/profile.mjs | edcc05c | leitura, PATCH parcial, identidade, campos vazios, fallback único |
| Chat canário | index.html, domains/chat.mjs | c9f2eba | reenvios concorrentes, resposta, reação, edição e remoção lógica |
| Notificações canário | index.html, worker.mjs | 0229445 | leitura, paginação, estado individual e concorrência |
| Recompensas | worker.mjs, tests/rewards.test.mjs | 9762688 | cálculo no servidor; pagamentos únicos sob concorrência |
| Arquivos | worker.mjs, domains/profile.mjs | e39df9f, 75aa7a0 | referências protegidas, limpeza idempotente, disputa entre vincular e excluir |
| Clube | worker.mjs, tests/club.test.mjs | e3ff229 | aprovação real no D1 local, ID da leitura, recompensa já paga, booleanos JSON SQLite |
| Snapshot completo | domains/snapshots.mjs, migrations/0001_snapshot_archives.sql | c3f052a | SHA-256 remoto, dono correto e detecção de corrupção |

### Testes e implantação

- 28 testes automatizados aprovados com D1/R2 locais no runtime workerd, além de compilação dos 264 scripts inline e do teste de navegador. O serviço de autenticação é substituído apenas nesses testes locais.
- npm audit: zero vulnerabilidades após fixar as dependências e overrides.
- Worker de staging publicado; versão `a5a076e7-8c03-43fe-8408-5a1cedf5f85d`. D1/R2/Auth bindings preservados, logs e traces habilitados e query strings ocultadas dos logs.
- Verificação HTTP remota: health 200; APIs de perfil/chat/notificações/snapshot sem token respondem 401; CORS do preview confirma origem e If-Match. Isso não substitui uma sessão Google real.
- Página `cloudflare-validation.html` executa o teste real com a própria conta Google, restaura a biografia com controle de versão, verifica bytes de uma imagem sintética, testa reenvio de chat e faz consultas autenticadas. Relatório baixável não contém tokens.

### Integridade e alterações de dados

- 48 tabelas públicas examinadas por chave/conteúdo ou checksum normalizado: 40 correspondem, sete ainda têm diferenças e uma possui preservação complementar no R2. Comparações de JSON por hash registram a possibilidade de diferenças de serialização numérica; esses casos não foram declarados equivalentes.
- As sete tabelas ainda diferentes são admin_logs, app_configuracoes, livros_pessoais, ranking_snapshots, entrel_app_snapshot_v257, entrel_app_snapshot_v260 e entrel_user_library_snapshot_v259.
- O snapshot inválido de 8.000.000 caracteres foi preservado integralmente no R2: 8.849.397 bytes, nove partes e manifesto, SHA-256 igual ao original. Três das outras 16 linhas da tabela ainda têm diferenças de checksum. A linha antiga não foi substituída.
- 1.089 arquivos ativos encontrados no R2 com tamanhos iguais aos metadados; 85 objetos extras anteriores preservados. O arquivo de preservação adicionou nove objetos de partes e um manifesto. A comparação de tamanho não é uma comparação byte a byte de todos os arquivos.
- Oito logs e três metas diárias ausentes foram copiados para staging com backup local privado, IDs preservados e sem sobrescrever registros. As 11 linhas foram consultadas novamente e coincidem com o backup.
- Supabase de produção e suas 13 contas Auth não foram alterados. O aplicativo ativo pode produzir novos deltas; não houve congelamento para cutover.

### Domínios ainda pendentes

| Domínio | Situação real |
|---|---|
| Perfis | edição própria em canário; listagem social, avatares de terceiros e outros sincronizadores ainda precisam de paridade |
| Configurações | preferências e escopos pessoais/globais implementados em canário; migration remota pendente; demais chaves continuam com operações específicas |
| Biblioteca e leituras | CRUD pessoal, progresso e pedido de conclusão integrados em canário; leitura/escrita EPUB e migração de arquivos legados ainda pendentes |
| Metas/progresso | gravação diária idempotente por livro/dia, metas canônicas semanais/mensais e leitura do progresso/recompensas no canário; outras rotinas de desafios e calendário ainda exigem revisão |
| Desafios/medalhas/molduras | autorização de seleção própria validada e reconciliação de medalhas/molduras implementada em canário; fluxos administrativos e desafios ainda legados |
| Clube | RPCs canário e correções de aprovação; mural, gestão completa de ciclos e interface de álbuns ainda incompletos |
| Chat | operações normais integradas; editor administrativo de cards fixados e demais wrappers legados pendentes |
| Notificações | leitura/lida/ocultação em canário; composição administrativa e entrega push ainda Supabase |
| Administração | fila Cloudflare limitada à finalização de livros pessoais em canário; remoção de conta, ranking, logs e demais ações não migrados integralmente |
| Recompensas | metas e aprovação testadas localmente; reconciliação histórica e contratos restantes pendentes |
| Arquivos | avatar e arquivos privados próprios testados; novas capas pessoais podem vincular asset R2; migração dos três buckets e leitores legados pendente |

A varredura AST de 2026-11-11 encontrou 566 acessos estáticos a tabelas em 26 tabelas, 20 RPCs em 17 nomes, 13 operações Storage e 28 chamadas `fetch` (nenhuma com URL estática). Também registrou 312 chamadas dinâmicas `from`/`rpc`/`fetch`. O inventário está em `FRONTEND_INVENTORY_2026-11-11.json`; inclui funções antigas sobrescritas e caminhos de fallback, portanto não prova o que executa. Não houve substituição global de `from`/`rpc`/`fetch`.

## Continuação local — configurações, biblioteca e conquistas

Foram concluídos localmente novos contratos de backend e integração opt-in do frontend:

- Configurações: rotas autenticadas para preferências da própria conta e leitura/escrita por escopo; alterações globais exigem permissão administrativa e marcadores de recompensa permanecem exclusivos do servidor. A migration `0002_scoped_settings.sql` cria armazenamento com escopo e importa as configurações legadas sem sobrescrever chaves irmãs.
- Biblioteca/leitura: rotas para listar, criar, editar, remover logicamente e sincronizar progresso preservando IDs; validação de identidade, proteção contra regressão de progresso antigo, prevenção de livros duplicados e solicitação idempotente de finalização sem conceder recompensa antes da aprovação. A migration `0003_library_identities.sql` adiciona a chave de deduplicação. Assets privados ficam vinculados ao livro e não são removidos enquanto referenciados.
- Conquistas: `POST /api/v1/me/awards/reconcile` calcula medalhas e molduras a partir de evidência no D1, é idempotente e não altera XP nem pontos. O corpo da requisição não escolhe usuário nem prêmios.
- Frontend: `index.html` carrega o adaptador opt-in. `cf_settings=1` e `cf_library=1` encaminham os fluxos cobertos ao Cloudflare; `cf_admin=1` limita a fila e a revisão às finalizações pessoais originadas no canário. O caminho padrão permanece no Supabase. A reconciliação manual de conquistas é exposta apenas com `cf_awards=1`.

Validação local: **37 testes aprovados**, incluindo D1/R2 em workerd, e `npm run check` compilou os 264 scripts inline e módulos do navegador; `git diff --check` passou. Esses resultados não substituem autenticação Google real nem execução contra o staging remoto.

**Estado da publicação:** as migrations `0002`, `0003` e `0004` e as novas rotas ainda não foram aplicadas ao D1/Worker remoto. O conector Cloudflare continuou retornando `UNAUTHORIZED` após a tentativa de reconexão desta continuação. Não executar cutover de produção. O teste real do Google e a reconciliação das diferenças de dados listadas acima também continuam pendentes.

## Continuação local — metas e progresso diário/semanal/mensal

- A leitura das metas globais canônicas semanais e mensais usa o Worker quando `cf_settings=1`; gravações globais seguem restritas a administradores e são relidas antes de atualizar a interface.
- A migration `0004_daily_book_progress.sql` cria o controle diário por usuário, livro e data. O Worker calcula deltas de página a partir de livros próprios, impede dupla contagem em reenvios e sincroniza o total diário em D1.
- Com `cf_library=1`, os escritores legados de leitura diária não gravam no Supabase. A recompensa diária é pedida apenas após a conclusão confirmada no servidor e continua idempotente.
- O progresso semanal e mensal pode ser consultado no Worker. Meta semanal alterada durante a semana usa o mesmo início efetivo na tela e na validação da recompensa; uma alteração no meio da semana não conta páginas anteriores para alcançar o novo alvo.
- No modo normal, os parâmetros do canário permanecem desligados e Supabase continua ativo. Nenhuma alteração foi aplicada à produção.

Validação local desta etapa: **40 testes aprovados** com D1/R2 em workerd; `npm run check` compilou os 264 scripts inline e módulos Cloudflare; `git diff --check` passou. Os testes não substituem sessão Google real nem validação no D1/R2 remoto.

**Pendências externas e de cobertura:** reautenticar a conexão Cloudflare para aplicar migrations e publicar o Worker de staging; executar a página de validação com a sessão Google real; comparar/reconciliar as diferenças de dados já listadas; migrar os leitores e escritores ainda legados nos demais domínios. Supabase Auth segue ligado. Não houve mudança em produção.

### Reversão

A entrada normal index.html mantém Supabase como fonte até validação. O canário pode ser desativado removendo seus parâmetros/entrada. Para o código remoto, a versão anterior ao trabalho é `febf2e0f-6fe3-4163-ab6a-0c73c48236d6`; reverter código não reverte os dados. Não apagar o snapshot preservado, seus manifestos nem os históricos adicionados.
