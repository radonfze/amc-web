-- Add Delete Cascade to relationship tables

-- 1. amc_visits
-- Try to drop constraint if we can guess the name, otherwise use a DO block or just alter if possible.
-- Since we don't know exact constraint names, we generally drop the column FK and re-add it, OR we can try to update the constraint.

-- Easy way: Drop the constraint by name if we can find it. 
-- For now, let's try to re-create the constraints with CASCADE.

BEGIN;

-- amc_visits: drop existing FK on contract_id
ALTER TABLE amc_visits DROP CONSTRAINT IF EXISTS amc_visits_contract_id_fkey;
-- Add it back with CASCADE
ALTER TABLE amc_visits 
    ADD CONSTRAINT amc_visits_contract_id_fkey 
    FOREIGN KEY (contract_id) 
    REFERENCES amc_contracts(id) 
    ON DELETE CASCADE;


-- amc_payments: drop existing FK on contract_id (if table exists)
ALTER TABLE IF EXISTS amc_payments DROP CONSTRAINT IF EXISTS amc_payments_contract_id_fkey;
-- Add it back with CASCADE
ALTER TABLE IF EXISTS amc_payments 
    ADD CONSTRAINT amc_payments_contract_id_fkey 
    FOREIGN KEY (contract_id) 
    REFERENCES amc_contracts(id) 
    ON DELETE CASCADE;

-- Ensure RLS allows delete
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON amc_contracts;
CREATE POLICY "Enable delete for authenticated users only" ON amc_contracts FOR DELETE TO authenticated USING (true);

COMMIT;
