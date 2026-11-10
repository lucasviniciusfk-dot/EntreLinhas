# Arquivos privados no R2 — status de staging

## Recursos de staging

- Migration D1: `cloudflare/migrations/0001_file_assets_staging.sql`
- Banco: `entrelinhas-staging` — migration aplicada e tabela `file_assets` verificada.
- Bucket: `entrelinhas-staging-private` — privado; nenhuma mídia de teste ou de usuário foi armazenada na última verificação.
- Worker: `entrelinhas-api-staging` — implantado em `https://entrelinhas-api-staging.lucasviniciusfk.workers.dev`.
- Cliente isolado: `cloudflare-api-client.js` — permanece apenas na branch, sem integração ao HTML publicado.
- Branch: `migration/cloudflare-staging-adapter`; `main` e GitHub Pages não foram alterados.

## Contrato

### Upload
`POST /api/v1/files/upload` — multipart:
- `file`: arquivo binário
- `tipo`: `epub`, `capa`, `avatar`, `foto-encontro`, `comprovante`
- `albumId`: campo legado opcional; ainda não é usado para autorização nem persistido.

O servidor ignora qualquer `userId` enviado pelo cliente. O dono é sempre o ID retornado pela validação do token Supabase Auth.

Limites preparados:
- EPUB: 25 MiB, MIME EPUB/octet-stream
- capa/avatar/foto: 5 MiB, JPEG/PNG/WebP
- comprovante: 10 MiB, JPEG/PNG/WebP/PDF

### Download
`GET /api/v1/files/:id` — autenticação obrigatória; somente o proprietário pode recuperar o objeto. Resposta binária com `Cache-Control: private, no-store` e `X-Content-Type-Options: nosniff`.

### Exclusão
`DELETE /api/v1/files/:id` — autenticação e propriedade obrigatórias. A versão mais recente do Worker primeiro grava `deleted_at` no D1 e só então remove o objeto do R2. Se a remoção do R2 falhar, o registro fica bloqueado para download pela API; pode restar um objeto órfão que exige rotina de limpeza controlada.

## Estado da validação

- A migration D1 foi aplicada em staging e a tabela/índices foram verificados.
- O Worker foi implantado em staging e o endpoint `/health` foi confirmado pelo usuário.
- A última verificação direta encontrou `file_assets` vazia e o bucket R2 sem objetos.
- A correção mais recente da ordem de exclusão foi implantada no Worker staging (versão/deployment `28252a7bc1b6438fafb843bb720f08a8`); os bindings D1, R2, Supabase URL e publishable key foram conferidos após o deploy.
- Upload/download/exclusão autenticados ainda não foram executados. É necessária uma sessão Supabase Auth válida pertencente a um perfil existente no D1 staging.
- Nenhum objeto de teste ou dado real de usuário foi criado, alterado ou excluído.

## Cuidados e limitações

- O campo legado `albumId` é recebido mas não vincula o arquivo a um álbum; essa regra precisa ser modelada com autorização de Clube.
- Não há varredura antivírus nem validação estrutural profunda de EPUB/PDF nesta etapa.
- A extensão/nome original é apenas metadado; a chave R2 é UUID sob prefixo do proprietário.
- CORS atual permite a origem GitHub Pages e localhost 3000/5173. A origem de staging deve ser adicionada apenas se um frontend de staging separado for criado.
- Não usar dados reais de usuários como teste. Não acessar nem alterar bucket de produção.
- A branch não deve ser mesclada nem publicada sem revisão e aprovação explícitas.

## Próximas etapas seguras

1. Revisar e testar estaticamente o Worker e o cliente.
2. Implantar a correção de exclusão no Worker staging, preservando bindings atuais.
3. Executar teste autenticado com arquivo sintético e sessão de staging autorizada; não solicitar nem compartilhar senha/token no chat.
4. Verificar isolamento entre proprietários e confirmar D1/R2 sem resíduos de teste.
5. Só depois planejar integração do cliente ao frontend em branch separada, sem tocar no GitHub Pages/produção.
