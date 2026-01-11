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

async function run() {
    try {
        await client.connect();
        console.log('Connected to database.');

        // 1. Find the contract
        const searchRes = await client.query(`
            SELECT id, customer_name, location_name, status 
            FROM public.amc_contracts 
            WHERE customer_name ILIKE '%Baraka cafeteria%'
        `);

        if (searchRes.rows.length === 0) {
            console.log('No contract found matching "Baraka cafeteria".');
            return;
        }

        const contract = searchRes.rows[0];
        console.log(`Found contract: ${contract.id} - ${contract.customer_name} (${contract.location_name}) [${contract.status}]`);

        // 2. Delete it
        console.log('Attempting to delete...');
        await client.query('DELETE FROM public.amc_contracts WHERE id = $1', [contract.id]);
        
        console.log(`Successfully deleted contract ${contract.id}.`);

    } catch (err) {
        console.error('Error deleting contract:', err);
    } finally {
        await client.end();
    }
}

run();
