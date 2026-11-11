CREATE TABLE IF NOT EXISTS snapshot_archives (
  source_table TEXT NOT NULL,
  source_primary_key TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  source_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (source_table,source_primary_key,sha256)
);
CREATE INDEX IF NOT EXISTS snapshot_archives_owner_idx ON snapshot_archives(owner_id,source_table,created_at DESC);
