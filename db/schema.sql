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
  PRIMARY KEY (room_code, name)
);

CREATE INDEX IF NOT EXISTS rooms_expires ON rooms(expires_at);
