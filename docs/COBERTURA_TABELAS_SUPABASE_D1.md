# Cobertura de tabelas — conferência Supabase x D1 staging

> Comparação somente leitura realizada em 2026-11-09: catálogo de tabelas do schema public no Supabase e sqlite_master do D1 entrelinhas-staging.

## Resultado

- Tabelas no Supabase public: **48**
- Tabelas correspondentes encontradas no D1 staging: **48**
- Tabelas adicionais no D1 staging: **2** — book_file_assets e file_assets
- Tabelas do Supabase ausentes no D1 staging: **0**

Portanto, a cobertura nominal de tabelas está completa no staging. Isso não comprova equivalência de colunas, índices, constraints, triggers, tipos, políticas ou dados. A conferência de paridade estrutural e de dados continua necessária antes de qualquer uso funcional completo.

## Interpretação

A etapa seguinte não é criar tabelas às cegas: é comparar cada coluna, chave primária, índice, relação e semântica de cada domínio, corrigindo diferenças no D1 staging por migrações versionadas. O banco Supabase permanece como fonte de verdade até o corte formal.

## Tabelas adicionais Cloudflare

- file_assets: metadados de objetos privados em R2.
- book_file_assets: relação entre arquivo privado e livro pessoal.

## Segurança e produção

A comparação não alterou dados. Nenhuma migração foi aplicada ao Supabase. Nenhum recurso de produção foi modificado.