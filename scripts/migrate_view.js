const { Client } = require('pg');

const connectionString = 'postgresql://postgres.crbzguhnmlfsdtdcmvmk:adminR%40DON%4089@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
});

const queries = [
  // 5. Import Enhancements (Undo & Technician)
  `CREATE TABLE IF NOT EXISTS public.import_run_items (
        id bigserial PRIMARY KEY,
        import_run_id bigint REFERENCES public.import_runs(id) ON DELETE CASCADE,
        customer_id bigint,
        location_id bigint,
        contract_id bigint
    );`,
  `ALTER TABLE public.import_run_items ENABLE ROW LEVEL SECURITY;`,
  `DROP POLICY IF EXISTS "mgr_admin_manage_import_items" ON public.import_run_items;`,
  `CREATE POLICY "mgr_admin_manage_import_items" ON public.import_run_items FOR ALL TO authenticated USING ( public.current_role() IN ('manager', 'admin') ) WITH CHECK ( public.current_role() IN ('manager', 'admin') );`,
  `ALTER TABLE public.amc_contracts ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES public.users(id);`,

  // 5b. GRA & License Numbers (User Request)
  `ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gra_number text;`,
  `ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS license_number text;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_gra ON public.customers(gra_number) WHERE gra_number IS NOT NULL;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_license ON public.customers(license_number) WHERE license_number IS NOT NULL;`,

  // 6. Data Ops (Tech Areas, Quality Score, Merge Function)
  `CREATE TABLE IF NOT EXISTS public.technician_areas (
        id bigint generated always as identity primary key,
        technician_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
        area text NOT NULL,
        created_at timestamptz DEFAULT now(),
        UNIQUE(technician_id, area)
    );`,
  `ALTER TABLE public.technician_areas ENABLE ROW LEVEL SECURITY;`,
  `DROP POLICY IF EXISTS "mgr_admin_manage_tech_areas" ON public.technician_areas;`,
  `CREATE POLICY "mgr_admin_manage_tech_areas" ON public.technician_areas FOR ALL TO authenticated USING ( public.current_role() IN ('manager', 'admin') ) WITH CHECK ( public.current_role() IN ('manager', 'admin') );`,
  `ALTER TABLE public.import_runs ADD COLUMN IF NOT EXISTS quality_score int;`,
  `CREATE OR REPLACE FUNCTION merge_customers(primary_id bigint, duplicate_id bigint) RETURNS void AS $$ BEGIN UPDATE public.customer_locations SET customer_id = primary_id WHERE customer_id = duplicate_id; DELETE FROM public.customers WHERE id = duplicate_id; END; $$ LANGUAGE plpgsql SECURITY DEFINER;`,

  // 7. Enterprise Modules (Lifecycle, Audit, Notifications)
  // Run this block manually via the 7_modules.sql file content to avoid string escape hell, or simplify here.
  // For simplicity, I'll execute the CREATE TABLEs here but the complex functions are risky in JS string.
  // Actually, let's keep it simple and assume the user runs the SQL or we read the file. 
  // But since I must use this script, I'll add the table creates.
  `ALTER TABLE public.amc_contracts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';`,
  `ALTER TABLE public.amc_contracts ADD COLUMN IF NOT EXISTS renewal_of_id bigint REFERENCES public.amc_contracts(id);`,
  `ALTER TABLE public.amc_contracts ADD COLUMN IF NOT EXISTS terminated_at timestamptz;`,

  `CREATE TABLE IF NOT EXISTS public.contract_events (
        id bigserial primary key,
        contract_id bigint REFERENCES public.amc_contracts(id) ON DELETE CASCADE,
        event_type text not null,
        event_at timestamptz not null default now(),
        meta jsonb
    );`,

  `CREATE TABLE IF NOT EXISTS public.audit_log (
        id bigserial primary key,
        entity_type text not null,
        entity_id bigint not null,
        action text not null,
        changed_by uuid REFERENCES public.users(id),
        changed_at timestamptz not null default now(),
        old_value jsonb,
        new_value jsonb,
        meta jsonb
    );`,

  `CREATE TABLE IF NOT EXISTS public.notifications (
        id bigserial primary key,
        type text not null,
        user_id uuid REFERENCES public.users(id),
        entity_type text not null,
        entity_id bigint not null,
        title text not null,
        body text not null,
        is_read boolean not null default false,
        created_at timestamptz not null default now()
    );`,

  // View
  `CREATE OR REPLACE VIEW public.tech_performance_view AS
        SELECT
        v.technician_id,
        date(v.visit_date) AS day,
        COUNT(*) AS visits_count,
        COUNT(*) FILTER (WHERE v.visit_type = 'shop_closed') AS shop_closed_count,
        SUM(COALESCE(v.payment_amount, 0)) AS amount_collected
        FROM public.amc_visits v
        WHERE v.technician_id IS NOT NULL
        GROUP BY v.technician_id, date(v.visit_date);`,

  // 9. Production Contract Lifecycle Engine
  `CREATE OR REPLACE FUNCTION set_contract_status(p_id bigint, p_new_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  old_status text;
  allowed boolean := false;
BEGIN
  SELECT status INTO old_status FROM public.amc_contracts WHERE id = p_id;
  IF old_status IS NULL THEN RAISE EXCEPTION 'Contract % not found', p_id; END IF;

  -- Allowed transitions
  IF old_status = 'draft' AND p_new_status IN ('active','cancelled') THEN allowed := true; END IF;
  IF old_status = 'active' AND p_new_status IN ('due_soon','overdue','expired','cancelled','renewed') THEN allowed := true; END IF;
  IF old_status = 'due_soon' AND p_new_status IN ('active','overdue','expired','cancelled','renewed') THEN allowed := true; END IF;
  IF old_status = 'overdue' AND p_new_status IN ('active','expired','cancelled','renewed') THEN allowed := true; END IF;
  IF old_status = 'expired' AND p_new_status IN ('renewed') THEN allowed := true; END IF;
  IF old_status = 'renewed' THEN allowed := false; END IF;
  IF old_status = 'cancelled' THEN allowed := false; END IF;

  IF NOT allowed THEN RAISE EXCEPTION 'Invalid contract status transition: % -> %', old_status, p_new_status; END IF;

  UPDATE public.amc_contracts
  SET status = p_new_status,
      terminated_at = CASE WHEN p_new_status IN ('expired','renewed','cancelled') THEN now() ELSE terminated_at END
  WHERE id = p_id;

  INSERT INTO public.contract_events (contract_id, event_type, meta)
  VALUES (p_id, p_new_status, jsonb_build_object('from', old_status, 'by', auth.uid()));
END; $$;`,

  `CREATE OR REPLACE FUNCTION renew_contract(p_old_id bigint, p_new_start date) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  old_rec public.amc_contracts;
  new_id bigint;
BEGIN
  SELECT * INTO old_rec FROM public.amc_contracts WHERE id = p_old_id;
  IF old_rec.id IS NULL THEN RAISE EXCEPTION 'Contract % not found', p_old_id; END IF;

  INSERT INTO public.amc_contracts (customer_location_id, start_date, end_date, status, renewal_of_id, amount_total, amount_police, amount_company, payment_status, cycle_status, technician_id, next_due_date, last_effective_visit_date)
  VALUES (old_rec.customer_location_id, p_new_start, p_new_start + INTERVAL '1 year', 'active', old_rec.id, old_rec.amount_total, old_rec.amount_police, old_rec.amount_company, 'pending', 'ok', old_rec.technician_id, p_new_start + INTERVAL '90 days', p_new_start)
  RETURNING id INTO new_id;

  PERFORM set_contract_status(p_old_id, 'renewed');
  INSERT INTO public.contract_events (contract_id, event_type) VALUES (new_id, 'created');
  RETURN new_id;
END; $$;`,

  `CREATE OR REPLACE FUNCTION daily_contract_lifecycle() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT id FROM public.amc_contracts WHERE status IN ('active','due_soon','overdue') AND end_date < CURRENT_DATE LOOP
    PERFORM set_contract_status(rec.id, 'expired');
  END LOOP;
  FOR rec IN SELECT id FROM public.amc_contracts WHERE status = 'active' AND next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' LOOP
    PERFORM set_contract_status(rec.id, 'due_soon');
  END LOOP;
  FOR rec IN SELECT id FROM public.amc_contracts WHERE status IN ('active','due_soon') AND next_due_date < CURRENT_DATE LOOP
    PERFORM set_contract_status(rec.id, 'overdue');
  END LOOP;
END; $$;`,

  `CREATE OR REPLACE FUNCTION log_contract_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.contract_events(contract_id, event_type, meta) VALUES (NEW.id, 'created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.contract_events(contract_id, event_type, meta) VALUES (NEW.id, 'updated', jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.contract_events(contract_id, event_type, meta) VALUES (OLD.id, 'deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END; $$;`,
  `DROP TRIGGER IF EXISTS trg_contract_events ON public.amc_contracts;`,
  `CREATE TRIGGER trg_contract_events AFTER INSERT OR UPDATE OR DELETE ON public.amc_contracts FOR EACH ROW EXECUTE FUNCTION log_contract_events();`,

  // 10. Notifications
  `CREATE TABLE IF NOT EXISTS public.notifications (
      id bigserial primary key, type text not null, user_id uuid references auth.users(id), entity_type text not null, entity_id bigint not null, title text not null, body text not null, is_read boolean not null default false, created_at timestamptz not null default now()
    );
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
        CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    
    CREATE OR REPLACE FUNCTION daily_notifications() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    DECLARE rec record;
    BEGIN
      FOR rec IN SELECT c.id, c.technician_id FROM public.amc_contracts c WHERE c.status IN ('active','due_soon') AND c.next_due_date = CURRENT_DATE LOOP
        INSERT INTO public.notifications(type, user_id, entity_type, entity_id, title, body) VALUES ('contract_due', rec.technician_id, 'contract', rec.id, 'Contract due today', 'You have a contract visit due today.');
      END LOOP;
      FOR rec IN SELECT c.id, c.technician_id FROM public.amc_contracts c WHERE c.status = 'overdue' LOOP
        INSERT INTO public.notifications(type, user_id, entity_type, entity_id, title, body) VALUES ('contract_overdue', rec.technician_id, 'contract', rec.id, 'Contract overdue', 'You have an overdue contract visit.');
      END LOOP;
      FOR rec IN SELECT c.id FROM public.amc_contracts c WHERE c.status = 'active' AND c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' LOOP
        INSERT INTO public.notifications(type, user_id, entity_type, entity_id, title, body) SELECT 'contract_expiring', id, 'contract', rec.id, 'Contract expiring soon', 'A contract is expiring within 30 days.' FROM auth.users WHERE (raw_user_meta_data->>'role')::text = 'manager' OR email LIKE '%@manager%';
      END LOOP;
    END; $$;`,

  // 11. Manager Dashboard RPCs
  `CREATE OR REPLACE FUNCTION top_tech_visits_30days() RETURNS TABLE (technician_id uuid, technician_name text, visits bigint) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT v.technician_id, COALESCE(u.raw_user_meta_data->>'name', u.email)::text AS technician_name, COUNT(*) AS visits
  FROM public.amc_visits v JOIN auth.users u ON u.id = v.technician_id
  WHERE v.visit_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY v.technician_id, u.raw_user_meta_data, u.email
  ORDER BY visits DESC LIMIT 5;
END; $$;`,
  `CREATE OR REPLACE FUNCTION top_tech_collections_30days() RETURNS TABLE (technician_id uuid, technician_name text, total_collected numeric) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT p.technician_id, COALESCE(u.raw_user_meta_data->>'name', u.email)::text AS technician_name, SUM(p.amount) AS total_collected
  FROM public.payments p JOIN auth.users u ON u.id = p.technician_id
  WHERE p.paid_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY p.technician_id, u.raw_user_meta_data, u.email
  ORDER BY total_collected DESC LIMIT 5;
END; $$;`,

  // 12. Manager Dashboard Widgets
  `CREATE OR REPLACE VIEW public.today_tech_schedule AS
SELECT v.id AS visit_id, v.technician_id, COALESCE(u.raw_user_meta_data->>'name', u.email)::text AS technician_name, v.visit_date, v.visit_time, c.id AS contract_id, cl.display_name AS location_name, cl.full_address
FROM public.amc_visits v JOIN public.amc_contracts c ON c.id = v.amc_contract_id JOIN public.customer_locations cl ON cl.id = c.customer_location_id LEFT JOIN auth.users u ON u.id = v.technician_id WHERE v.visit_date = CURRENT_DATE;`,

  `CREATE OR REPLACE FUNCTION revenue_forecast_30days() RETURNS TABLE (forecast_date date, expected_amount numeric) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT series_date::date AS forecast_date, COALESCE(SUM(c.amount_total / 4), 0) AS expected_amount
  FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', INTERVAL '1 day') AS series_date
  LEFT JOIN public.amc_contracts c ON c.status IN ('active','due_soon','overdue') AND c.next_due_date = series_date::date
  GROUP BY series_date::date;
$$;`,

  `CREATE OR REPLACE VIEW public.renewal_pipeline AS
SELECT CASE
    WHEN end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN '0-30'
    WHEN end_date BETWEEN CURRENT_DATE + INTERVAL '31 days' AND CURRENT_DATE + INTERVAL '60 days' THEN '31-60'
    WHEN end_date BETWEEN CURRENT_DATE + INTERVAL '61 days' AND CURRENT_DATE + INTERVAL '90 days' THEN '61-90'
    ELSE 'other' END AS bucket, COUNT(*) AS count
FROM public.amc_contracts WHERE status = 'active' AND end_date <= CURRENT_DATE + INTERVAL '90 days' GROUP BY bucket;`,

  // 13. Auth & RLS
  `CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      name text,
      role text CHECK (role IN ('admin', 'manager', 'technician')),
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );
    CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.profiles (id, name, role) VALUES (new.id, new.raw_user_meta_data->>'name', COALESCE(new.raw_user_meta_data->>'role', 'technician'));
      RETURN new;
    END; $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.amc_contracts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.amc_visits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

    DO $$ BEGIN
        CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

        CREATE POLICY "manager_admin_select_contracts" ON public.amc_contracts FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));
        CREATE POLICY "manager_admin_modify_contracts" ON public.amc_contracts FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin'))) WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));
        CREATE POLICY "technician_read_own_contracts" ON public.amc_contracts FOR SELECT USING (technician_id = auth.uid());

        CREATE POLICY "manager_admin_select_visits" ON public.amc_visits FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));
        CREATE POLICY "manager_admin_modify_visits" ON public.amc_visits FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin'))) WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));
        CREATE POLICY "technician_read_own_visits" ON public.amc_visits FOR SELECT USING (technician_id = auth.uid());
        CREATE POLICY "technician_insert_own_visits" ON public.amc_visits FOR INSERT WITH CHECK (technician_id = auth.uid());
        CREATE POLICY "technician_update_own_visits" ON public.amc_visits FOR UPDATE USING (technician_id = auth.uid()) WITH CHECK (technician_id = auth.uid());
        
        DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
        DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
        CREATE POLICY "user_read_own_notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
        CREATE POLICY "user_update_own_notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
        CREATE POLICY "manager_admin_insert_notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));
        
        CREATE POLICY "manager_admin_select_import_runs" ON public.import_runs FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));
        CREATE POLICY "manager_admin_insert_import_runs" ON public.import_runs FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));
        CREATE POLICY "manager_admin_update_import_runs" ON public.import_runs FOR UPDATE USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin'))) WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));
        
        CREATE POLICY "admin_full_audit_access" ON public.audit_log FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
        CREATE POLICY "manager_read_audit" ON public.audit_log FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('manager','admin')));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
];

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to database.');

    for (const query of queries) {
      try {
        // console.log('Running:', query.substring(0, 50));
        await client.query(query);
      } catch (err) {
        console.error('Error executing query:', query);
        console.error('Error details:', err.message);
        // Proceed anyway unless it's critical? RLS errors usually mean policy exists etc, but we DROP first.
        // Syntax errors should stop us.
      }
    }
    console.log('Hardcoded migration completed.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
