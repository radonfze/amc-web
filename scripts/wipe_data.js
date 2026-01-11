const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') }); 

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', 'postgres://postgres:[PASSWORD]@') + ':5432/postgres';

if (!connectionString || connectionString.includes('[PASSWORD]')) {
    console.error('Could not find valid DATABASE_URL in .env files.');
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

const sql = `
BEGIN;

-- TRUNCATE all operational tables
-- We use CASCADE to handle foreign keys automatically
TRUNCATE TABLE 
    public.contract_events,
    public.payments,
    public.amc_visits,
    public.amc_contracts,
    public.technician_areas,
    public.customer_locations,
    public.customers
    CASCADE;

-- Optional: truncate areas if created (but maybe keep if user manually added?)
-- User said "Clear all existing DATA". Areas are arguably config, but they came from customers mostly.
-- Let's keep 'areas' table structure but clear data to match the "fresh start" intent.
TRUNCATE TABLE public.areas CASCADE;

COMMIT;
`;

async function run() {
    try {
        await client.connect();
        console.log('Connected to database.');
        console.log('Wiping all operational data (Contracts, Visits, Customers, Areas)...');
        await client.query(sql);
        console.log('Successfully wiped data. System is clean for new import.');
    } catch (err) {
        console.error('Error wiping data:', err);
    } finally {
        await client.end();
    }
}

run();
