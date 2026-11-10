-- Relação versionada entre livros pessoais e arquivos privados do R2.
-- Mantém os IDs originais de livros_pessoais e file_assets; substituições são soft-delete.
CREATE TABLE IF NOT EXISTS book_file_assets (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('epub','cover')),
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_book_file_assets_owner_book
  ON book_file_assets(owner_id, book_id, role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_book_file_assets_asset
  ON book_file_assets(asset_id, owner_id);
