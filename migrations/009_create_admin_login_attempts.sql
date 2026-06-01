CREATE TABLE IF NOT EXISTS wedding_admin_login_attempts (
  rate_limit_key TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wedding_admin_login_attempts_locked_until_idx
  ON wedding_admin_login_attempts (locked_until);
