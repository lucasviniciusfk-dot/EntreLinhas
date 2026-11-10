-- Cloudflare D1 staging: metadados de arquivos privados no R2.
-- Aplicar somente em entrelinhas-staging após revisão. Não contém dados de usuários.
CREATE TABLE IF NOT EXISTS file_assets (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('epub','cover','avatar','club-photo','receipt')),
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_assets_owner_created
  ON file_assets(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_assets_owner_category
  ON file_assets(owner_id, category, created_at DESC);
