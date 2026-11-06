create table scion_private.access_offers (
  id text primary key,
  issuer_account text not null,
  version_id text not null references scion_private.strategy_versions(id) on delete cascade,
  scopes text[] not null check (cardinality(scopes) > 0),
  expires_in_seconds integer not null check (expires_in_seconds between 1 and 86400),
  price_minor bigint not null check (price_minor > 0),
  currency text not null check (currency = 'USDC'),
  status text not null check (status in ('active', 'revoked')),
  created_at timestamptz not null
);

create table scion_private.access_purchases (
  id text primary key,
  idempotency_key text not null check (length(idempotency_key) between 1 and 128),
  buyer_account text not null,
  offer_id text not null references scion_private.access_offers(id) on delete restrict,
  version_id text not null references scion_private.strategy_versions(id) on delete restrict,
  issuer_account text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency = 'USDC'),
  status text not null check (status = 'settled'),
  settlement_ref text unique not null,
  capability_id text unique not null,
  created_at timestamptz not null,
  unique (buyer_account, idempotency_key)
);

create table scion_private.ledger_entries (
  id text primary key,
  purchase_id text not null references scion_private.access_purchases(id) on delete restrict,
  account_id text not null,
  kind text not null check (kind in ('creator_revenue', 'upstream_royalty')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency = 'USDC'),
  created_at timestamptz not null
);

create index access_offers_version_idx on scion_private.access_offers(version_id, status);
create index access_purchases_offer_idx on scion_private.access_purchases(offer_id, created_at desc);
create index access_purchases_version_idx on scion_private.access_purchases(version_id, created_at desc);
create index ledger_entries_purchase_idx on scion_private.ledger_entries(purchase_id);
create index ledger_entries_account_idx on scion_private.ledger_entries(account_id, created_at desc);

alter table scion_private.access_offers enable row level security;
alter table scion_private.access_purchases enable row level security;
alter table scion_private.ledger_entries enable row level security;

comment on table scion_private.access_purchases is 'Idempotent settled access purchases; capability issuance and ledger entries commit in the same transaction';
