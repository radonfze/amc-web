const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Fallback

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', 'postgres://postgres:[PASSWORD]@') + ':5432/postgres';

if (!connectionString || connectionString.includes('[PASSWORD]')) {
    console.error('Could not find valid DATABASE_URL in .env files.');
    console.log('Available Env Keys:', Object.keys(process.env));
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase/Vercel connections usually
});

const sql = `
BEGIN;

-- 1. Fix Trigger: Remove DELETE event
DROP TRIGGER IF EXISTS trg_contract_events ON public.amc_contracts;

CREATE TRIGGER trg_contract_events
AFTER INSERT OR UPDATE ON public.amc_contracts
FOR EACH ROW EXECUTE FUNCTION log_contract_events();

-- 2. Fix Visits FK (Cascade)
ALTER TABLE public.amc_visits DROP CONSTRAINT IF EXISTS amc_visits_amc_contract_id_fkey;
ALTER TABLE public.amc_visits DROP CONSTRAINT IF EXISTS amc_visits_contract_id_fkey;

ALTER TABLE public.amc_visits
  ADD CONSTRAINT amc_visits_amc_contract_id_fkey
  FOREIGN KEY (amc_contract_id)
  REFERENCES public.amc_contracts(id)
  ON DELETE CASCADE;

-- 3. Fix Payments FK (Cascade)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amc_contract_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_amc_contract_id_fkey
  FOREIGN KEY (amc_contract_id)
  REFERENCES public.amc_contracts(id)
  ON DELETE CASCADE;

-- 4. Fix Events FK (Cascade) - Just in case
ALTER TABLE public.contract_events DROP CONSTRAINT IF EXISTS contract_events_contract_id_fkey;
ALTER TABLE public.contract_events
  ADD CONSTRAINT contract_events_contract_id_fkey
  FOREIGN KEY (contract_id)
  REFERENCES public.amc_contracts(id)
  ON DELETE CASCADE;

COMMIT;
`;

async function run() {
    try {
        await client.connect();
        console.log('Connected to database.');
        await client.query(sql);
        console.log('Successfully applied database fixes (Trigger & Cascades).');
    } catch (err) {
        console.error('Error applying fixes:', err);
    } finally {
        await client.end();
    }
}

run();
