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
| Configurações | 70 referências legadas; esquema usuario_id/chave exige contrato e não foi convertido em CRUD genérico |
| Biblioteca e leituras | rotas existentes; frontend completo, arquivos EPUB e conflitos entre aparelhos ainda não migrados |
| Metas/progresso | recompensas e JSON corrigidos; escritores de metas e calendário continuam legados |
| Desafios/medalhas/molduras | autorização de seleção própria validada; catálogo, concessões e administração ainda legados |
| Clube | RPCs canário e correções de aprovação; mural, gestão completa de ciclos e interface de álbuns ainda incompletos |
| Chat | operações normais integradas; editor administrativo de cards fixados e demais wrappers legados pendentes |
| Notificações | leitura/lida/ocultação em canário; composição administrativa e entrega push ainda Supabase |
| Administração | guardas e fluxos de aprovação testados localmente; remoção de conta, ranking, logs e demais ações não migrados integralmente |
| Recompensas | metas e aprovação testadas localmente; reconciliação histórica e contratos restantes pendentes |
| Arquivos | avatar e arquivos privados próprios testados; três buckets e todos os leitores antigos ainda precisam de migração |

A varredura AST continua encontrando 566 acessos estáticos a tabelas e 20 RPCs em 17 nomes, porque inclui funções antigas sobrescritas e caminhos de fallback. Esse total não prova quais funções executam. O inventário registra linhas e operações para a continuação por domínio. Não houve substituição global de from/rpc/fetch.

### Reversão

A entrada normal index.html mantém Supabase como fonte até validação. O canário pode ser desativado removendo seus parâmetros/entrada. Para o código remoto, a versão anterior ao trabalho é `febf2e0f-6fe3-4163-ab6a-0c73c48236d6`; reverter código não reverte os dados. Não apagar o snapshot preservado, seus manifestos nem os históricos adicionados.
