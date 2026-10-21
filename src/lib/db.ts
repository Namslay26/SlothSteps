
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "slothsteps.db");

const globalForDb = globalThis as unknown as {
  slothDb?: Database.Database;
};

export const db =
  globalForDb.slothDb ?? new Database(dbPath);

if (process.env.NODE_ENV !== "production") {
  globalForDb.slothDb = db;
}

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    source TEXT NOT NULL
      CHECK (source IN ('image', 'manual')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS steps (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    text TEXT NOT NULL,
    minutes INTEGER NOT NULL DEFAULT 5
      CHECK (minutes BETWEEN 1 AND 10),
    week_start TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'done', 'skipped')),
    shrink_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (goal_id) REFERENCES goals(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    latency_ms INTEGER,
    tokens_in INTEGER,
    tokens_out INTEGER,
    retries INTEGER NOT NULL DEFAULT 0,
    error TEXT
  );
`);
