CREATE TABLE IF NOT EXISTS strategies (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  owner_account text NOT NULL,
  latest_version_id text NOT NULL,
  visibility text NOT NULL,
  royalty_bps integer NOT NULL CHECK (royalty_bps BETWEEN 0 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strategy_versions (
  id text PRIMARY KEY,
  strategy_id text NOT NULL REFERENCES strategies(id) DEFERRABLE INITIALLY DEFERRED,
  semver text NOT NULL,
  owner_account text NOT NULL,
  parent_version_id text REFERENCES strategy_versions(id),
  payload jsonb NOT NULL,
  manifest_hash text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE(strategy_id, semver)
);

CREATE TABLE IF NOT EXISTS capabilities (
  id text PRIMARY KEY,
  subject_account text NOT NULL,
  issuer_account text NOT NULL,
  version_id text NOT NULL REFERENCES strategy_versions(id),
  scopes text[] NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active','revoked')),
  token_hash text UNIQUE NOT NULL,
  price_minor bigint NOT NULL,
  currency text NOT NULL,
  created_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS fork_edges (
  id text PRIMARY KEY,
  parent_version_id text NOT NULL REFERENCES strategy_versions(id),
  child_version_id text UNIQUE NOT NULL REFERENCES strategy_versions(id),
  creator_account text NOT NULL,
  changed_fields text[] NOT NULL,
  royalty_bps integer NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS executions (
  id text PRIMARY KEY,
  executor_account text NOT NULL,
  version_id text NOT NULL REFERENCES strategy_versions(id),
  intent_hash text UNIQUE NOT NULL,
  policy_hash text NOT NULL,
  mode text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  public_key text NOT NULL,
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS strategies_owner_idx ON strategies(owner_account);
CREATE INDEX IF NOT EXISTS capabilities_subject_idx ON capabilities(subject_account, status, expires_at);
CREATE INDEX IF NOT EXISTS fork_edges_parent_idx ON fork_edges(parent_version_id);
CREATE INDEX IF NOT EXISTS executions_version_idx ON executions(version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_challenges_expiry_idx ON auth_challenges(expires_at);
