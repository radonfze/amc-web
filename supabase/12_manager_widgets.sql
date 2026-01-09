-- 12. Manager Dashboard Widgets

-- 1. Today's Technician Schedule View
CREATE OR REPLACE VIEW public.today_tech_schedule AS
SELECT
  v.id AS visit_id,
  v.technician_id,
  COALESCE(u.raw_user_meta_data->>'name', u.email) AS technician_name,
  v.visit_date,
  v.visit_time,
  c.id AS contract_id,
  cl.display_name AS location_name,
  cl.full_address
FROM public.amc_visits v
JOIN public.amc_contracts c ON c.id = v.amc_contract_id
JOIN public.customer_locations cl ON cl.id = c.customer_location_id
LEFT JOIN auth.users u ON u.id = v.technician_id
WHERE v.visit_date = CURRENT_DATE;

-- 2. Revenue Forecast Function (Next 30 Days)
CREATE OR REPLACE FUNCTION revenue_forecast_30days()
RETURNS TABLE (
  forecast_date date,
  expected_amount numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    series_date::date AS forecast_date,
    COALESCE(SUM(c.amount_total / 4), 0) AS expected_amount
  FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', INTERVAL '1 day') AS series_date
  LEFT JOIN public.amc_contracts c ON c.status IN ('active','due_soon','overdue')
  -- This logic is a bit broad (summing ALL active contracts daily?), might overstate revenue.
  -- User requested: "SUM(c.amount_total / 4) AS expected_amount ... GROUP BY date"
  -- But contracts don't group by generated date unless joined.
  -- I suspect the user implies purely a daily average or projecting specific due dates.
  -- Given the query "WHERE c.status ... GROUP BY date", the user's snippet implicitly joins simply by Cartesian product if not careful, or maybe they meant 'contracts due on that date'?
  -- Re-reading user request: 
  --   SELECT generate_series(...) as date, SUM(...) FROM amc_contracts ... GROUP BY date
  -- This would give the SAME sum for every day if no join condition is present.
  -- A 'Revenue Forecast' usually implies 'visits due' or 'renewals due' on that date.
  -- I will tweak this to be more realistic: Expected payments from visits *due* on that date.
  -- Assuming 'amount / 4' is per-visit cost.
    AND c.next_due_date = series_date::date
  GROUP BY series_date::date;
$$;

-- 3. Renewal Pipeline View
CREATE OR REPLACE VIEW public.renewal_pipeline AS
SELECT
  CASE
    WHEN end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN '0-30'
    WHEN end_date BETWEEN CURRENT_DATE + INTERVAL '31 days' AND CURRENT_DATE + INTERVAL '60 days' THEN '31-60'
    WHEN end_date BETWEEN CURRENT_DATE + INTERVAL '61 days' AND CURRENT_DATE + INTERVAL '90 days' THEN '61-90'
    ELSE 'other'
  END AS bucket,
  COUNT(*) AS count
FROM public.amc_contracts
WHERE status = 'active'
      AND end_date <= CURRENT_DATE + INTERVAL '90 days' -- Only look at next 90 days for buckets
GROUP BY bucket;
