-- 1. Drop the view first to avoid column mismatch errors during replacement
DROP VIEW IF EXISTS public.amc_contracts_view;

-- 2. Create PAYMENTS table if it doesn't exist
-- Based on Manager Dashboard requirements: id, collected_at, amount, references users, amc_contracts
CREATE TABLE IF NOT EXISTS public.payments (
  id bigserial PRIMARY KEY,
  amc_contract_id bigint NOT NULL REFERENCES public.amc_contracts(id) ON DELETE CASCADE,
  amc_visit_id bigint REFERENCES public.amc_visits(id), -- Optional link to a specific visit
  technician_id uuid REFERENCES public.users(id), -- Who collected it
  amount numeric(10,2) NOT NULL,
  payment_method text CHECK (payment_method IN ('cash', 'cheque', 'bank_transfer')),
  collected_at timestamptz DEFAULT now(),
  remarks text,
  created_at timestamptz DEFAULT now()
);

-- 3. Create the Production View
CREATE OR REPLACE VIEW public.amc_contracts_view AS
SELECT
    ac.id AS id,
    ac.customer_location_id,
    ac.start_date,
    ac.end_date,
    ac.status,
    ac.amount_total,
    ac.amount_police,
    ac.amount_company,
    ac.payment_status,
    ac.last_effective_visit_date,
    ac.next_due_date,
    ac.cycle_status,

    -- Customer info
    c.id AS customer_id,
    c.name AS customer_name,
    c.gov_license_no,
    c.gra_no,
    c.contact_person,
    c.contact_phone,
    c.area AS customer_area,
    c.city AS customer_city,

    -- Location info
    cl.display_name AS location_name,
    cl.lat,
    cl.lng,
    cl.full_address,
    cl.gov_certificate_date,
    cl.gov_renewal_date

FROM amc_contracts ac
JOIN customer_locations cl ON cl.id = ac.customer_location_id
JOIN customers c ON c.id = cl.customer_id;

-- 4. Grant permissions (just in case)
GRANT SELECT ON public.amc_contracts_view TO authenticated;
GRANT SELECT ON public.amc_contracts_view TO service_role;
GRANT ALL ON public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
