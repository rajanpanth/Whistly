-- ─────────────────────────────────────────────────────────────────────────────
-- Referral code column migration
--
-- Replaces the full-table scan in /api/referral/resolve (which loaded up to
-- 1000 wallets per request and silently broke past 1000 users) with an
-- indexed column computed at insert time.
--
-- The code algorithm MUST match walletToCode in the app (DJB2 → base36,
-- left-padded to 8 chars): see app/src/app/api/referral/resolve/route.ts
-- and src/components/referrals.tsx.
--
-- Run in the Supabase SQL editor after supabase-schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- DJB2 hash (32-bit unsigned) → base36, padded to 8 chars.
create or replace function wallet_to_referral_code(w text)
returns text
language plpgsql
immutable
as $$
declare
    hash bigint := 5381;
    i int;
    n bigint;
    digits constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
    result text := '';
begin
    for i in 1..length(w) loop
        -- hash = ((hash << 5) + hash + charCode) >>> 0
        hash := ((hash * 33) + ascii(substr(w, i, 1))) % 4294967296;
    end loop;

    n := hash;
    if n = 0 then
        result := '0';
    else
        while n > 0 loop
            result := substr(digits, (n % 36)::int + 1, 1) || result;
            n := n / 36;
        end loop;
    end if;

    -- Matches JS: hash.toString(36).padStart(8, "0").slice(0, 8)
    return left(lpad(result, 8, '0'), 8);
end;
$$;

-- Column + backfill + index
alter table users add column if not exists referral_code text;

update users
set referral_code = wallet_to_referral_code(wallet)
where referral_code is null;

create index if not exists idx_users_referral_code on users (referral_code);

-- Keep the column populated for new signups.
create or replace function set_referral_code()
returns trigger
language plpgsql
as $$
begin
    if new.referral_code is null then
        new.referral_code := wallet_to_referral_code(new.wallet);
    end if;
    return new;
end;
$$;

drop trigger if exists trg_set_referral_code on users;
create trigger trg_set_referral_code
    before insert on users
    for each row
    execute function set_referral_code();
