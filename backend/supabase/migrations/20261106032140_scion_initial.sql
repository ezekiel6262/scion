create schema if not exists scion_private;
revoke all on schema scion_private from public, anon, authenticated;

create table scion_private.strategies (
  id text primary key,
  slug text unique not null,
  name text not null,
  owner_account text not null,
  latest_version_id text not null,
  visibility text not null check (visibility = 'public-metrics-private-content'),
  royalty_bps integer not null check (royalty_bps between 0 and 10000),
  created_at timestamptz not null default now()
);

create table scion_private.strategy_versions (
  id text primary key,
  strategy_id text not null references scion_private.strategies(id) on delete cascade,
  semver text not null,
  owner_account text not null,
  parent_version_id text references scion_private.strategy_versions(id),
  payload jsonb not null,
  manifest_hash text unique not null,
  created_at timestamptz not null,
  unique(strategy_id, semver)
);

create table scion_private.capabilities (
  id text primary key,
  subject_account text not null,
  issuer_account text not null,
  version_id text not null references scion_private.strategy_versions(id) on delete cascade,
  scopes text[] not null,
  expires_at timestamptz not null,
  status text not null check (status in ('active','revoked')),
  token_hash text unique not null,
  price_minor bigint not null check (price_minor >= 0),
  currency text not null check (currency = 'USDC'),
  created_at timestamptz not null,
  revoked_at timestamptz,
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null))
);

create table scion_private.fork_edges (
  id text primary key,
  parent_version_id text not null references scion_private.strategy_versions(id) on delete restrict,
  child_version_id text unique not null references scion_private.strategy_versions(id) on delete cascade,
  creator_account text not null,
  changed_fields text[] not null,
  royalty_bps integer not null check (royalty_bps between 0 and 10000),
  created_at timestamptz not null
);

create table scion_private.executions (
  id text primary key,
  executor_account text not null,
  version_id text not null references scion_private.strategy_versions(id) on delete restrict,
  intent_hash text unique not null,
  policy_hash text not null,
  mode text not null check (mode in ('simulated','live')),
  status text not null,
  created_at timestamptz not null
);

create table scion_private.auth_challenges (
  id text primary key,
  account_id text not null,
  public_key text not null,
  message text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index strategies_owner_idx on scion_private.strategies(owner_account);
create index strategy_versions_strategy_idx on scion_private.strategy_versions(strategy_id, created_at desc);
create index capabilities_subject_idx on scion_private.capabilities(subject_account, status, expires_at);
create index fork_edges_parent_idx on scion_private.fork_edges(parent_version_id);
create index executions_version_idx on scion_private.executions(version_id, created_at desc);
create index auth_challenges_expiry_idx on scion_private.auth_challenges(expires_at);

alter table scion_private.strategies enable row level security;
alter table scion_private.strategy_versions enable row level security;
alter table scion_private.capabilities enable row level security;
alter table scion_private.fork_edges enable row level security;
alter table scion_private.executions enable row level security;
alter table scion_private.auth_challenges enable row level security;

comment on schema scion_private is 'Server-only Scion protocol data; intentionally excluded from the Supabase Data API';
