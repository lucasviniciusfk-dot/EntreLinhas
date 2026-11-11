CREATE TABLE IF NOT EXISTS library_identities (
  owner_id TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  book_id TEXT NOT NULL,
  PRIMARY KEY(owner_id,normalized_key)
);
