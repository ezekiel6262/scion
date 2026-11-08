export const schemaSql = String.raw`
create schema if not exists scion_private;
revoke all on schema scion_private from public;

create table if not exists scion_private.strategies (
  id text primary key, slug text unique not null, name text not null,
  owner_account text not null, latest_version_id text not null,
  visibility text not null check (visibility = 'public-metrics-private-content'),
  royalty_bps integer not null check (royalty_bps between 0 and 10000),
  created_at timestamptz not null default now()
);
alter table scion_private.strategies drop constraint if exists strategies_visibility_check;
alter table scion_private.strategies add constraint strategies_visibility_check check (visibility in ('public','sealed','public-metrics-private-content'));
create table if not exists scion_private.strategy_versions (
  id text primary key, strategy_id text not null references scion_private.strategies(id) on delete cascade,
  semver text not null, owner_account text not null,
  parent_version_id text references scion_private.strategy_versions(id),
  payload jsonb not null, manifest_hash text unique not null, created_at timestamptz not null,
  unique(strategy_id, semver)
);
create table if not exists scion_private.capabilities (
  id text primary key, subject_account text not null, issuer_account text not null,
  version_id text not null references scion_private.strategy_versions(id) on delete cascade,
  scopes text[] not null, expires_at timestamptz not null,
  status text not null check (status in ('active','revoked')), token_hash text unique not null,
  price_minor bigint not null check (price_minor >= 0), currency text not null check (currency = 'USDC'),
  created_at timestamptz not null, revoked_at timestamptz,
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null))
);
create table if not exists scion_private.fork_edges (
  id text primary key,
  parent_version_id text not null references scion_private.strategy_versions(id) on delete restrict,
  child_version_id text unique not null references scion_private.strategy_versions(id) on delete cascade,
  creator_account text not null, changed_fields text[] not null,
  royalty_bps integer not null check (royalty_bps between 0 and 10000), created_at timestamptz not null
);
create table if not exists scion_private.executions (
  id text primary key, executor_account text not null,
  version_id text not null references scion_private.strategy_versions(id) on delete restrict,
  intent_hash text unique not null, policy_hash text not null,
  mode text not null check (mode in ('simulated','live')), status text not null, created_at timestamptz not null
);
create table if not exists scion_private.auth_challenges (
  id text primary key, account_id text not null, public_key text not null,
  message text not null, expires_at timestamptz not null, used_at timestamptz
);
create table if not exists scion_private.access_offers (
  id text primary key, issuer_account text not null,
  version_id text not null references scion_private.strategy_versions(id) on delete cascade,
  scopes text[] not null check (cardinality(scopes) > 0),
  expires_in_seconds integer not null check (expires_in_seconds between 1 and 86400),
  price_minor bigint not null check (price_minor > 0), currency text not null check (currency = 'USDC'),
  status text not null check (status in ('active','revoked')), created_at timestamptz not null
);
create table if not exists scion_private.access_purchases (
  id text primary key, idempotency_key text not null check (length(idempotency_key) between 1 and 128),
  buyer_account text not null, offer_id text not null references scion_private.access_offers(id) on delete restrict,
  version_id text not null references scion_private.strategy_versions(id) on delete restrict,
  issuer_account text not null, amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency = 'USDC'), status text not null check (status = 'settled'),
  settlement_ref text unique not null, capability_id text unique not null, created_at timestamptz not null,
  unique (buyer_account, idempotency_key)
);
create table if not exists scion_private.ledger_entries (
  id text primary key, purchase_id text not null references scion_private.access_purchases(id) on delete restrict,
  account_id text not null, kind text not null check (kind in ('creator_revenue','upstream_royalty','protocol_fee')),
  amount_minor bigint not null check (amount_minor >= 0), currency text not null check (currency = 'USDC'),
  created_at timestamptz not null
);

-- Expanded frontend objects. Payloads remain versioned JSON until their API contracts stabilize.
create table if not exists scion_private.product_objects (
  id text primary key,
  object_type text not null check (object_type in ('profile','follow','comment','play','room','room_message','portfolio','nft','attestation','gateway_event','suggestion','stance')),
  owner_account text not null, strategy_id text, visibility text not null,
  payload jsonb not null, created_at timestamptz not null, updated_at timestamptz not null
);
alter table scion_private.product_objects drop constraint if exists product_objects_object_type_check;
alter table scion_private.product_objects add constraint product_objects_object_type_check check (object_type in ('profile','follow','like','comment','notification','session','block','report','audit','invite','agent','agent_proposal','agent_event','play','room','room_message','portfolio','nft','attestation','gateway_event','suggestion','stance'));
alter table scion_private.ledger_entries drop constraint if exists ledger_entries_kind_check;
alter table scion_private.ledger_entries add constraint ledger_entries_kind_check check (kind in ('creator_revenue','upstream_royalty','protocol_fee'));

create index if not exists strategies_owner_idx on scion_private.strategies(owner_account);
create index if not exists strategy_versions_strategy_idx on scion_private.strategy_versions(strategy_id, created_at desc);
create index if not exists capabilities_subject_idx on scion_private.capabilities(subject_account, status, expires_at);
create index if not exists fork_edges_parent_idx on scion_private.fork_edges(parent_version_id);
create index if not exists executions_version_idx on scion_private.executions(version_id, created_at desc);
create index if not exists auth_challenges_expiry_idx on scion_private.auth_challenges(expires_at);
create index if not exists access_offers_version_idx on scion_private.access_offers(version_id, status);
create index if not exists access_purchases_offer_idx on scion_private.access_purchases(offer_id, created_at desc);
create unique index if not exists access_purchases_settlement_ref_idx on scion_private.access_purchases(settlement_ref);
create index if not exists ledger_entries_account_idx on scion_private.ledger_entries(account_id, created_at desc);
create index if not exists product_objects_type_created_idx on scion_private.product_objects(object_type, created_at desc);
create index if not exists product_objects_strategy_idx on scion_private.product_objects(strategy_id, object_type, created_at desc);
create unique index if not exists product_profiles_handle_unique_idx on scion_private.product_objects(lower(payload->>'handle')) where object_type='profile';
`;
