# Migração do EntreLinhas para Cloudflare — plano de integração

> Branch de trabalho: `migration/cloudflare-staging-adapter`
> Base: `main`
> Escopo: preparação e integração gradual em staging. Este documento não autoriza publicação nem alterações em produção.

## Objetivo

Migrar gradualmente os dados e operações de negócio do Supabase para Cloudflare D1 + Workers + R2, mantendo Supabase Auth como provedor de identidade durante a transição.

## Ambiente permitido

- D1: `entrelinhas-staging`
- Worker: `entrelinhas-api-staging`
- R2 privado: `entrelinhas-staging-private`

Não alterar o Worker/R2 de produção, o schema/dados/Auth do Supabase, a branch `main` ou o GitHub Pages.

## Estado verificado

- D1 staging contém as 26 tabelas referenciadas diretamente pelo frontend.
- O frontend também usa três buckets/áreas de arquivo: `capas`, `epubs` e `comprovantes`; isso não são tabelas D1.
- O Worker staging responde em `/health` e confirma bindings D1, R2 e configuração de Auth.
- Rotas existentes no Worker: `/api/v1/me`, biblioteca pessoal, leituras, metas e desafios (conjunto inicial).
- O frontend ainda faz chamadas diretas ao Supabase PostgREST em vários módulos.
- A fila offline `entrel_offline_v348` guarda operações REST endereçadas ao host Supabase. Não trocar sua URL sem uma camada de compatibilidade e replay testada.
- Upload legado envia FormData (`file`, `tipo`, `userId`, `albumId`) ao Worker antigo e espera URL pública. O novo bucket é privado; o novo contrato deve usar identificadores de arquivo e leitura autenticada. O servidor deve derivar o proprietário do token validado, nunca confiar no `userId` do formulário.

## Estratégia de migração

1. **Preservar autenticação:** o cliente obtém sessão pelo Supabase Auth; o Worker valida o Bearer token e deriva o usuário autenticado.
2. **Criar camada de API:** centralizar chamadas ao Worker sem alterar de uma vez os módulos existentes.
3. **Migrar por domínio:** começar por perfil/biblioteca/leitura/metas/desafios; depois clube, chat, mural, notificações, validações, ranking, recompensas e administração.
4. **Compatibilidade offline:** adaptar a fila para armazenar operações lógicas versionadas e reproduzi-las pelo endpoint correspondente. Preservar itens antigos e não descartar filas durante a migração.
5. **Arquivos privados:** implementar upload e download autenticados no Worker, com metadados de proprietário/categoria/chave R2 no D1; validar MIME, tamanho, autorização e limites.
6. **Leitura segura:** retornar apenas campos necessários ao usuário; nunca expor colunas administrativas ou dados de terceiros sem autorização.
7. **Validação:** testes automatizados e manuais em staging, sem criar ou alterar registros reais de usuários sem autorização específica.
8. **Corte gradual:** somente após paridade funcional, testes offline, integridade e aprovação explícita.

## Rotas de arquivos propostas

- `POST /api/v1/files/upload`
- `GET /api/v1/files/:id` (autenticado e autorizado)
- `DELETE /api/v1/files/:id` (proprietário/admin autorizado)

Não retornar URL pública permanente para objetos privados.

## Critérios para cada domínio

- autenticação e autorização no servidor;
- isolamento por usuário e papéis;
- validação de entrada e tamanho;
- tratamento consistente de erros;
- idempotência nas escritas/replays;
- paginação e limites;
- nenhuma regressão de cache/offline;
- testes de leitura e escrita em staging;
- logs sem tokens, segredos ou conteúdo pessoal desnecessário.

## Pendências técnicas antes de integração no frontend

- Revisar o código-fonte atual do Worker staging antes de modificá-lo ou implantá-lo.
- Definir contratos de request/response por domínio a partir dos usos reais do frontend.
- Implementar tratamento de erros D1 no middleware de autenticação.
- Substituir consultas `SELECT *` por listas explícitas de campos.
- Adicionar rate limiting e limites de payload.
- Projetar reconciliação dos registros que diferem entre Supabase e D1; não copiar automaticamente divergências.
- Inventariar objetos de produção apenas com autorização específica; não acessar nem modificar o bucket de produção durante esta etapa.

## Segurança e publicação

Esta branch não deve ser publicada automaticamente. Não abrir PR nem mesclar na `main` sem aprovação explícita. O GitHub Pages deve continuar apontando para a branch atualmente publicada.
