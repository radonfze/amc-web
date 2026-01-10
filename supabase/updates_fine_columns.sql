alter table public.amc_contracts 
add column if not exists fine_amount numeric default 0,
add column if not exists paid_amount numeric default 0,
add column if not exists balance_amount numeric generated always as (amount_total - paid_amount) stored;

-- Note: Postgres 12+ supports generated columns. 
-- If generated column is not desired or version is old, we can use a trigger or just a regular column.
-- Let's use regular column for compatibility and manual override if needed, but 'balance_amount' usually should be calculated.
-- However, user said "paid amount , balance to pay".
-- Let's stick to regular column for maximum flexibility in case of manual adjustments.

alter table public.amc_contracts drop column if exists balance_amount; -- cleanup if I just made it generated
alter table public.amc_contracts add column if not exists balance_amount numeric default 0;
