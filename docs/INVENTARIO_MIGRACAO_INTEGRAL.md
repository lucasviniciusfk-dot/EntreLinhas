# Inventário funcional do Entre Linhas — base para migração integral

> Fonte: análise estática do HTML enviado pelo proprietário (build v505), comparada ao schema atual de D1 staging.
> Escopo: inventário e planejamento técnico. Não altera o HTML publicado nem dados de usuários.

## Resultado do inventário

O frontend contém chamadas diretas ao Supabase em **29 tabelas** e usa **3 buckets** de Storage. A camada Cloudflare atual cobre apenas um subconjunto inicial. Portanto, não é seguro substituir globalmente o endpoint Supabase nem declarar a migração concluída com o adaptador atual.

### Tabelas detectadas no frontend

| Tabela | Chamadas detectadas | Domínio provável |
|---|---:|---|
| livros_pessoais | 88 | Biblioteca pessoal, metadados e progresso |
| usuarios | 85 | Perfil, permissões e estatísticas |
| app_configuracoes | 70 | Preferências e configuração por usuário |
| leituras | 32 | Progresso e histórico de leitura |
| metas_diarias | 32 | Metas diárias |
| metas_usuarios | 29 | Metas e sequência |
| usuario_medalhas | 22 | Medalhas por usuário |
| app_notificacoes | 22 | Notificações |
| solicitacoes_validacao | 21 | Solicitações e revisão administrativa |
| chat_mensagens | 20 | Chat |
| clube_livro_atual | 20 | Livro atual do clube |
| clube_livro_participantes | 17 | Participantes e progresso coletivo |
| usuario_molduras | 13 | Molduras do perfil |
| desafios | 13 | Catálogo de desafios |
| clube_albuns | 12 | Álbuns do clube |
| usuario_desafios | 11 | Progresso individual em desafios |
| clube_mural_reacoes | 9 | Reações ao mural |
| chat_reacoes | 9 | Reações do chat |
| clube_fotos | 8 | Fotos do clube |
| epubs | 7 | Metadados/legado de EPUB |
| admin_logs | 7 | Auditoria administrativa |
| clube_biblioteca | 7 | Biblioteca coletiva |
| clube_livros_finalizados | 7 | Histórico de livros coletivos |
| livros | 5 | Catálogo de livros |
| capas | 4 | Referências legadas de capas |
| clube_mural | 4 | Mural |
| ranking_temporadas | 2 | Temporadas do ranking |
| comprovantes | 2 | Referências legadas de comprovantes |
| push_subscriptions | 1 | Assinaturas de notificações push |

A contagem é por ocorrência textual de chamadas .from('tabela') no HTML; não representa volume de dados nem número de operações distintas.

### Buckets de Storage identificados
- capas
- epubs
- comprovantes

Além deles, o build v505 contém integração legada a R2 público e ao Worker antigo de upload. Essa integração precisa ser substituída cuidadosamente pelo R2 privado, sem quebrar leitores EPUB, capas e anexos já existentes.

## Estado do adaptador Cloudflare

O cliente isolado cloudflare-api-client.js já implementa autenticação Bearer via sessão Supabase, perfil, biblioteca pessoal, leitura, metas, desafios e operações básicas de arquivos. O Worker staging já possui rotas correspondentes para esse subconjunto.

A associação privada de arquivos de livros foi adicionada em staging: D1 book_file_assets; Worker GET/POST /api/v1/library/books/:id/assets; cliente library.listFiles() e library.attachFile().

O Worker ainda precisa de publicação da versão mais recente; a tentativa anterior de deploy foi bloqueada. Não afirmar que as novas rotas estão ativas até validar o deploy.

## Dependências que impedem um corte global imediato

### 1. Cliente e autenticação
O HTML inicializa o cliente em uma variável local cloudDb e também publica window.entSupabaseClient. O adaptador consegue obter a sessão desse cliente. O fluxo de autenticação continua dependente do Supabase Auth por decisão arquitetural atual.

### 2. Fila offline
A fila principal é IndexedDB entrel_offline_v348, store queue, com fallback em localStorage. Ela armazena operações REST com host Supabase e faz replay posterior. Há ainda uma camada v400 que consolida progresso de leitura e outras filas de mídia. A migração deve manter os itens enfileirados, introduzir dispatcher por domínio/versão, mapear operações antigas, manter idempotência e não apagar a fila.

### 3. Arquivos
O build v505 ainda define Worker antigo entrelinhas-upload e R2 público. É necessário migrar caminhos e metadados de forma compatível; objetos antigos não podem ser removidos antes da verificação de cópia, associação e leitura pelo novo endpoint autenticado.

### 4. Autorização e segurança
As tabelas do clube, chat, mural, ranking e administração possuem regras diferentes de visibilidade e papel. Cada rota precisa impor autorização no Worker; não basta validar que o usuário tem sessão. Consultas coletivas devem ser revisadas para não expor dados privados de outros membros.

## Plano integrado de implementação

1. Contratos e segurança: mapear cada chamada do frontend por tabela, operação, filtros, ordenação, relacionamentos, papel e payload; definir rotas e schemas no Worker.
2. API por domínio: perfil/configurações; biblioteca/leitura; metas/estatísticas; desafios/recompensas/medalhas; clube/biblioteca coletiva/participantes; mural/chat/reação; validações/administração; notificações/push; ranking.
3. Camada de compatibilidade: criar facade para migrar módulos por domínio, sem interceptação global de fetch ou mudança cega de PostgREST.
4. Fila offline: adaptar replay e preservar itens antigos; testar desconexão, reconexão, conflito e repetição.
5. Arquivos: associar arquivos privados a livros/álbuns/solicitações, migrar leitores e anexos com verificação de integridade e URLs autenticadas.
6. Migração de dados: reconciliar dados existentes e divergências por chave primária, com relatórios antes de qualquer escrita; preservar IDs.
7. Testes: testes unitários, integração, autorização por papel, regressão das telas e testes offline.
8. Corte: só depois da paridade funcional e autorização explícita para produção.

## Limitações e decisões pendentes

- O inventário estático não identifica sozinho todas as regras RLS, triggers, funções RPC, Edge Functions ou efeitos colaterais de cada módulo.
- A migração dos registros divergentes entre Supabase e D1 exige plano de reconciliação e autorização específica antes de copiar dados.
- O deploy do Worker staging mais recente está pendente por bloqueio da ferramenta; não contornar esse bloqueio.
- Não publicar, mesclar PR, alterar main, GitHub Pages ou recursos de produção durante a preparação.

## Sinais adicionais encontrados no código

- Foram identificadas **20 chamadas a RPC** do Supabase. Seus nomes, argumentos e efeitos precisam ser inventariados antes de substituição; não podem ser traduzidas automaticamente para SQL.
- Foram encontradas chamadas de upload no Storage e muitas chamadas a remoção de arquivos. A contagem textual de .remove inclui métodos encadeados e não equivale a exclusões confirmadas.
- O padrão de acesso é misto: SELECT, INSERT, UPDATE, UPSERT e DELETE aparecem nos domínios principais. A compatibilidade precisa preservar filtros, retornos de linhas, ordenação e semântica de conflito do PostgREST.
- O código da fila offline v348 guarda URLs REST Supabase e faz replay. A camada v400 trata consolidação de progresso de leitura; a camada de mídia v349 mantém jobs separados. Essas estruturas devem ser preservadas e migradas por adaptadores.


## Endpoints acrescentados nesta etapa

- `GET /api/v1/progress/monthly?period=AAAA-MM`: calcula o progresso mensal do próprio usuário autenticado. Reproduz os três modos identificados na RPC `entrel_verified_monthly_progress_v512`: soma de páginas, meta manual (zero verificado) ou contagem distinta de livros/solicitações aprovadas. Filtra registros internos de recompensa e exige marcadores de aprovação para contagem de livros.
- `POST /api/v1/rewards/daily-epub`: concede 20 XP e 10 pontos para meta diária EPUB elegível, com claim idempotente em `entrel_reward_claims_v510`. O usuário é derivado do token Supabase Auth.
- O cliente isolado expõe `progress.monthly(period)` e `rewards.awardDailyEpub(date)`. Os testes de contrato validam datas e formatos inválidos.
- A consulta SQL principal da contagem mensal foi executada somente para um identificador sintético inexistente no D1 de staging; retornou zero, sem escrita. Isso valida sintaxe, não validação funcional ponta a ponta.
