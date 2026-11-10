# Mapeamento do módulo Minha Leitura — etapa 1

Baseado na leitura do `index.html` anexado (snapshot v504) e do Worker `entrelinhas-api-staging` recuperado da conta Cloudflare.

## Fluxo atual observado no frontend

O módulo usa `livros_pessoais` como registro principal do livro pessoal e sincroniza também `leituras`.

Campos enviados no upsert de `livros_pessoais`:
- `id`, `usuario_id`, `livro_id`
- `titulo`, `autor`, `genero`, `paginas`
- `capa`, `epub_storage_path`
- `pagina_atual`, `progresso`, `epub_cfi`, `status`, `ativo`
- `dados`, `atualizado_em`

O identificador lógico da obra vem de `fingerprintFromBook()`; o registro remoto é identificado por `onlinePersonalId || id`.

O progresso também é salvo em `leituras`, com conflito em `usuario_id,livro_id`. O frontend preserva progresso e CFI localmente e sincroniza com atraso (debounce de 450 ms).

## Contrato atual do Worker

- GET `/api/v1/library/books`: retorna `{ ok, items, count, limit }`, itens em formato D1 (snake_case).
- POST `/api/v1/library/books`: espera `title, author, genre, pages, cover_url`; cria livro manual sem EPUB.
- PATCH `/api/v1/library/books/:id`: atualiza título, autor, gênero, páginas e capa. Não atualiza progresso.
- DELETE `/api/v1/library/books/:id`: desativa logicamente.
- POST `/api/v1/reading`: espera `book_id, current_page, epub_cfi`, atualiza progresso no livro e em `leituras`.

## Adaptador criado

`cloudflare-api-client.js` agora converte entre:
- formato do app: `title, author, pages, currentPage, epubCfi, cover`;
- formato do banco: `titulo, autor, paginas, pagina_atual, epub_cfi, capa_url`.

A conversão não é aplicada globalmente. O cliente só atua quando chamado explicitamente por um módulo. Nenhum fluxo PostgREST foi redirecionado nesta etapa.

## Limites identificados — não ativar ainda

1. **EPUB:** o fluxo atual envia arquivo para Supabase Storage e mantém `epub_storage_path`. O Worker novo ainda não possui upload/download R2. Não migrar criação de EPUB para o POST atual, pois ele não transfere o arquivo.
2. **Capas data URL:** o frontend atual envia data URL ao Storage e converte para URL pública. O Worker novo ainda não possui fluxo equivalente. Não enviar data URL ao campo `cover_url`.
3. **Progresso:** o PATCH de livro não salva progresso; usar POST `/api/v1/reading` para progresso.
4. **Fila offline:** continua endereçada ao PostgREST Supabase. Não alterar host, formato ou replay nessa etapa.
5. **IDs/fingerprint:** não substituir `livro_id` pelo ID do registro pessoal. O fluxo atual usa fingerprint da obra para agrupar a leitura.
6. **Listagem:** o Worker usa `SELECT *`; revisar exposição de campos antes de integrar a listagem real no app.
7. **Paginação:** o endpoint usa cursor por `atualizado_em`, mas não desempata timestamps iguais; paginação ainda não deve ser usada em bibliotecas grandes sem correção.

## Próximo trabalho necessário

- Corrigir o Worker para devolver somente colunas necessárias e suportar paginação estável.
- Definir contrato de progresso idempotente preservando `livro_id` (fingerprint) e ID pessoal.
- Implementar metadados de arquivo e rotas R2 privadas antes de migrar EPUB/capas.
- Criar testes sem escrita em perfis reais: validação de payload e testes unitários do mapeamento.
- Só depois ligar um caminho opt-in de leitura em staging, mantendo fallback Supabase e fila offline intactos.
