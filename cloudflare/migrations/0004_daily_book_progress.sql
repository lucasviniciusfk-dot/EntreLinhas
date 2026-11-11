CREATE TABLE IF NOT EXISTS daily_goal_progress_days (
  usuario_id TEXT NOT NULL,
  data TEXT NOT NULL,
  base_pages INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY(usuario_id,data)
);

CREATE TABLE IF NOT EXISTS daily_book_progress (
  usuario_id TEXT NOT NULL,
  data TEXT NOT NULL,
  book_id TEXT NOT NULL,
  last_page INTEGER NOT NULL DEFAULT 0,
  pages_read INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(usuario_id,data,book_id)
);

CREATE INDEX IF NOT EXISTS daily_book_progress_day ON daily_book_progress(usuario_id,data);
