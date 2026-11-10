# Arquivos privados no R2 — contrato de staging

## Implementação preparada na branch

- Migration D1: `cloudflare/migrations/0001_file_assets_staging.sql`
- Worker: rotas adicionadas em `cloudflare/worker-staging.js`
- Cliente: `EntreLinhasCloudflare.files` em `cloudflare-api-client.js`

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
`DELETE /api/v1/files/:id` — autenticação e propriedade obrigatórias. Apaga objeto R2 e marca metadados com `deleted_at`.

## Cuidados e limitações

- A tabela `file_assets` ainda não foi criada no D1 staging. A migration está versionada, mas não foi aplicada.
- As rotas foram preparadas no arquivo fonte da branch, mas não foram implantadas no Worker.
- Nenhum objeto foi enviado, baixado ou excluído.
- A interface ainda não foi ligada a essas rotas.
- O campo legado `albumId` é recebido mas não vincula o arquivo a um álbum; essa regra precisa ser modelada com autorização de Clube.
- Não há varredura antivírus nem validação estrutural profunda de EPUB/PDF nesta etapa.
- A extensão/nome original é apenas metadado; a chave R2 é UUID sob prefixo do proprietário.
- Antes de deploy: validar sintaxe do Worker, aplicar migration em D1 staging, testar upload/download/delete com arquivo sintético e sessão de teste autorizada, confirmar CORS e verificar ausência de acesso cruzado entre usuários.
- Não usar dados reais de usuários como teste. Não acessar nem alterar bucket de produção.

## Próxima etapa

Executar revisão estática e testes de contrato; depois solicitar aprovação específica para aplicar a migration no D1 staging e implantar o Worker staging. A branch não deve ser mesclada nem publicada.
