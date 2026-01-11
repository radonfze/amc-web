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

-- 1. Create Areas Table
CREATE TABLE IF NOT EXISTS public.areas (
    id bigint generated always as identity primary key,
    name text not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'areas' AND policyname = 'Authenticated users can view areas'
    ) THEN
        CREATE POLICY "Authenticated users can view areas" ON public.areas
        FOR SELECT USING (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'areas' AND policyname = 'Managers can manage areas'
    ) THEN
        CREATE POLICY "Managers can manage areas" ON public.areas
        FOR ALL USING (
            exists (
              select 1 from public.users 
              where id = auth.uid() and role in ('admin', 'manager')
            )
        );
    END IF;
END
$$;

-- 2. Seed from Customers
INSERT INTO public.areas (name)
SELECT DISTINCT area 
FROM public.customers 
WHERE area IS NOT NULL AND area <> ''
ON CONFLICT (name) DO NOTHING;

-- 3. Seed from Technician Assignments (in case they have areas not in customers)
-- We need to check if technician_areas table exists first
DO $$
BEGIN
   IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'technician_areas') THEN
      INSERT INTO public.areas (name)
      SELECT DISTINCT area
      FROM public.technician_areas
      WHERE area IS NOT NULL AND area <> ''
      ON CONFLICT (name) DO NOTHING;
   END IF;
END
$$;

COMMIT;
`;

async function run() {
    try {
        await client.connect();
        console.log('Connected to database.');
        await client.query(sql);
        console.log('Successfully created and seeded Areas table.');
    } catch (err) {
        console.error('Error setting up areas:', err);
    } finally {
        await client.end();
    }
}

run();
