CREATE TABLE account_sessions (
  digest TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX account_sessions_expiry ON account_sessions (expires_at);

CREATE TABLE login_limits (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL CHECK (attempts BETWEEN 1 AND 11),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX login_limits_expiry ON login_limits (expires_at);
