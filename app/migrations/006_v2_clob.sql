-- ─── Whistly V2 CLOB schema ────────────────────────────────────────────────
-- Off-chain order book + fill mirror for the V2 share-trading protocol.
-- The chain is the source of truth for balances/positions/fills; these
-- tables index signed order intents and settled fills for fast reads.
-- All prices are probability basis points (100 = 1%); quantities are
-- shares; lamports columns are devnet lamports, never USD.

-- Signed order intents (the order book).
create table if not exists v2_orders (
  -- sha256 of the canonical signed payload, hex
  order_hash text primary key,
  protocol_version int not null default 2,
  market text not null,             -- MarketV2 PDA base58
  market_id bigint not null,
  outcome_index int not null,
  maker text not null,              -- wallet base58
  side text not null check (side in ('BUY','SELL')),
  order_type text not null check (order_type in ('LIMIT','MARKET')),
  price_bps int not null check (price_bps between 100 and 9900),
  quantity bigint not null check (quantity > 0),
  -- BUY: max collateral lamports = price*qty*100; SELL: shares locked
  locked_amount bigint not null,
  nonce bigint not null,
  expiry bigint not null,           -- unix seconds
  tif text not null check (tif in ('GTC','GTD','FOK','FAK')),
  filled_quantity bigint not null default 0,
  status text not null default 'open' check (status in
    ('open','partially_filled','filled','cancelled','expired','rejected')),
  reject_reason text,
  payload_hex text not null,        -- exact signed bytes
  signature_hex text not null,      -- ed25519 signature over payload
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (maker, nonce)             -- replay/duplicate-nonce defense
);

create index if not exists v2_orders_book_idx
  on v2_orders (market, outcome_index, side, status, price_bps);
create index if not exists v2_orders_maker_idx on v2_orders (maker, status);

-- Settled fills (each row has a devnet transaction signature).
create table if not exists v2_fills (
  id bigint generated always as identity primary key,
  market text not null,
  fill_seq bigint,                  -- MarketV2.fill_count at settlement
  mode text not null check (mode in ('TRANSFER','MINT','BURN')),
  maker_order_hash text not null references v2_orders(order_hash),
  taker_order_hash text not null references v2_orders(order_hash),
  maker text not null,
  taker text not null,
  outcome_index int not null,       -- maker-side outcome
  price_bps int not null,           -- execution price (maker outcome)
  quantity bigint not null,
  notional_lamports bigint not null,
  fee_lamports bigint not null,
  tx_signature text not null unique,-- verifiable devnet settlement tx
  created_at timestamptz not null default now()
);

create index if not exists v2_fills_market_idx on v2_fills (market, created_at);
create index if not exists v2_fills_wallet_idx on v2_fills (maker, taker);

-- Activity feed (orders posted/cancelled, fills, settlements, redemptions).
create table if not exists v2_activity (
  id bigint generated always as identity primary key,
  kind text not null check (kind in
    ('order_posted','order_cancelled','order_expired','fill','partial_fill',
     'market_created','market_settled','market_voided','redeemed')),
  market text,
  wallet text,
  outcome_index int,
  side text,
  price_bps int,
  quantity bigint,
  lamports bigint,
  tx_signature text,
  created_at timestamptz not null default now()
);

create index if not exists v2_activity_market_idx on v2_activity (market, created_at desc);
create index if not exists v2_activity_wallet_idx on v2_activity (wallet, created_at desc);

-- RLS: anon may read, writes only via service role (API routes).
alter table v2_orders enable row level security;
alter table v2_fills enable row level security;
alter table v2_activity enable row level security;

drop policy if exists v2_orders_read on v2_orders;
create policy v2_orders_read on v2_orders for select using (true);
drop policy if exists v2_fills_read on v2_fills;
create policy v2_fills_read on v2_fills for select using (true);
drop policy if exists v2_activity_read on v2_activity;
create policy v2_activity_read on v2_activity for select using (true);
