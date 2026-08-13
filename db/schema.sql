-- Clan Swap schema (Postgres / Neon)
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  admin_pin_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '90 days'
);

CREATE TABLE IF NOT EXISTS players (
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pin_hash TEXT,             -- per-player PIN (nullable for legacy rows)
  pin_salt TEXT,
  PRIMARY KEY (room_code, name)
);

-- Add columns on existing DBs (idempotent).
ALTER TABLE players ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS pin_salt TEXT;

CREATE INDEX IF NOT EXISTS rooms_expires ON rooms(expires_at);

-- Bad-attempt rate limiter. Key format: "<code>:<action>:<ip>" (action = adminPin|playerPin).
CREATE TABLE IF NOT EXISTS bad_attempts (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bad_attempts_updated ON bad_attempts(updated_at);
