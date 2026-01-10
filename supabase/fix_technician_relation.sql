-- fix_technician_relation.sql

-- 1. Ensure technician_id column exists in amc_contracts
-- We use a DO block to avoid errors if it already exists but has issues
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'amc_contracts' AND column_name = 'technician_id') THEN
        ALTER TABLE public.amc_contracts ADD COLUMN technician_id uuid REFERENCES public.users(id);
    END IF;
END $$;

-- 2. Explicitly ensure the Foreign Key constraint exists
-- Sometimes the column exists but the constraint was dropped.
-- We'll try to add it. If it fails (already exists), we ignore.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'amc_contracts_technician_id_fkey' 
        AND table_name = 'amc_contracts'
    ) THEN
        -- Check if column exists first (it should from step 1)
        -- Add constraint
        ALTER TABLE public.amc_contracts 
        ADD CONSTRAINT amc_contracts_technician_id_fkey 
        FOREIGN KEY (technician_id) REFERENCES public.users(id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- If it fails (e.g. duplicate constraint name with different definition), safe to ignore usually
    RAISE NOTICE 'Constraint might already exist or issue adding it: %', SQLERRM;
END $$;

-- 3. Reload Schema Cache
-- This is critical for PostgREST to pick up the relationship
NOTIFY pgrst, 'reload config';
