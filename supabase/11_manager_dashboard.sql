-- 11. Manager Dashboard RPCs

-- 1. Top Technicians by Visits (Last 30 Days)
CREATE OR REPLACE FUNCTION top_tech_visits_30days()
RETURNS TABLE (
  technician_id uuid,
  technician_name text,
  visits bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.technician_id,
    COALESCE(u.raw_user_meta_data->>'name', u.email) AS technician_name, -- Handling auth.users or public.users
    COUNT(*) AS visits
  FROM public.amc_visits v
  JOIN auth.users u ON u.id = v.technician_id
  WHERE v.visit_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY v.technician_id, u.raw_user_meta_data, u.email
  ORDER BY visits DESC
  LIMIT 5;
END;
$$;

-- 2. Top Technicians by Collections (Last 30 Days)
CREATE OR REPLACE FUNCTION top_tech_collections_30days()
RETURNS TABLE (
  technician_id uuid,
  technician_name text,
  total_collected numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.technician_id,
    COALESCE(u.raw_user_meta_data->>'name', u.email) AS technician_name,
    SUM(p.amount) AS total_collected
  FROM public.payments p
  JOIN auth.users u ON u.id = p.technician_id
  WHERE p.paid_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY p.technician_id, u.raw_user_meta_data, u.email
  ORDER BY total_collected DESC
  LIMIT 5;
END;
$$;
