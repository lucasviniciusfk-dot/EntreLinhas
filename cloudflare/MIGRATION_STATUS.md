# Entre Linhas — status da migração Cloudflare

Atualizado em 2026-11-10 (horário de Manaus).

## Ambiente de trabalho
- Repositório: `lucasviniciusfk-dot/EntreLinhas`
- Branch: `migration/cloudflare-integration`
- PR: https://github.com/lucasviniciusfk-dot/EntreLinhas/pull/2
- Produção: `main` permanece sem alteração/cutover.
- Autenticação: Supabase Auth/Google preservado.
- Banco de staging: D1 `entrelinhas-staging`.
- Arquivos: R2 `entrelinhas-staging-private`.
- API: Worker `entrelinhas-api-staging`.

## Reconciliação confirmada
Contagens consultadas diretamente no Supabase e no D1 após a correção dos registros:

| Tabela | Supabase | D1 | Resultado |
|---|---:|---:|---|
| usuarios | 13 | 13 | Igual |
| livros_pessoais | 177 | 177 | Igual |
| clube_fotos | 22 | 22 | Igual |
| clube_livro_participantes | 35 | 35 | Igual |
| entrel_reward_claims_v510 | 61 | 61 | Igual |
| admin_logs | 5.187 | 5.187 | Igual |

A diferença de sete linhas em `admin_logs` foi identificada por UUID, conferida no Supabase e inserida no D1 com `INSERT OR IGNORE`, preservando os IDs, dados e timestamps originais. A contagem foi consultada novamente nos dois bancos e ficou igual.

Auditoria anterior de arquivos: 1.089 registros ativos em `file_assets`, todos com objeto correspondente no R2; existem objetos adicionais que não devem ser apagados sem auditoria de referência.

## Integração de backend
O Worker de staging tem rotas específicas para perfil, livros, leitura, metas, progresso mensal, solicitações administrativas, clube, notificações, chat, desafios, recompensas e arquivos. O adaptador RPC é instalado apenas na página de staging e não intercepta o `fetch` global.

O adaptador encaminha somente operações com rota e argumentos conhecidos. Operações de finalização administrativa do clube e finalização com recompensa permanecem no Supabase até comprovar paridade funcional: a rota de staging atual tem comportamento de desfazer conclusão em determinadas condições, diferente da RPC original. A exclusão administrativa de conta também permanece no Supabase, pois a função original faz uma cascata extensa envolvendo dados, Storage e Auth.

## Pendências reais antes do cutover
1. Migrar as operações diretas do frontend nas 26 tabelas ainda acessadas via Supabase Data API, preservando a semântica das políticas RLS.
2. Portar e testar as RPCs ainda em fallback, incluindo exclusão de conta e conclusão/recompensa do clube.
3. Comparar todas as linhas de todas as tabelas (não apenas as contagens principais) e reconciliar divergências.
4. Executar testes autenticados de leitura/escrita, permissões de membro/admin, recompensas, notificações, chat, desafios e arquivos.
5. Resolver a verificação de integridade D1: `PRAGMA integrity_check` e `foreign_key_check` não foram aceitos pela API usada (SQLITE_AUTH); não registrar como aprovados.
6. Fazer revisão final e só então planejar o cutover.

## Segurança
- Não desligar Supabase Auth, Postgres ou Storage nesta fase.
- Não apagar objetos R2 excedentes/zero-byte sem identificar referências.
- Não mesclar o PR nem publicar o staging como produção antes dos testes autenticados e da auditoria de RLS.
