-- 10. Notifications Engine

-- Table: notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id bigserial primary key,
  type text not null,
  user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id bigint not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Function: daily_notifications
CREATE OR REPLACE FUNCTION daily_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
BEGIN
  -- Due today -> technician
  FOR rec IN
    SELECT c.id, c.technician_id
    FROM public.amc_contracts c
    WHERE c.status IN ('active','due_soon')
      AND c.next_due_date = CURRENT_DATE
  LOOP
    INSERT INTO public.notifications(type, user_id, entity_type, entity_id, title, body)
    VALUES (
      'contract_due',
      rec.technician_id,
      'contract',
      rec.id,
      'Contract due today',
      'You have a contract visit due today.'
    );
  END LOOP;

  -- Overdue -> technician
  FOR rec IN
    SELECT c.id, c.technician_id
    FROM public.amc_contracts c
    WHERE c.status = 'overdue'
  LOOP
    INSERT INTO public.notifications(type, user_id, entity_type, entity_id, title, body)
    VALUES (
      'contract_overdue',
      rec.technician_id,
      'contract',
      rec.id,
      'Contract overdue',
      'You have an overdue contract visit.'
    );
  END LOOP;

  -- Expiring within 30 days -> managers
  -- Assuming 'manager' check is done via role lookup or distinct query
  -- For now, we will insert for users who are managers. 
  -- Note: existing users table has 'role' column?
  FOR rec IN
    SELECT c.id
    FROM public.amc_contracts c
    WHERE c.status = 'active'
      AND c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
  LOOP
    INSERT INTO public.notifications(type, user_id, entity_type, entity_id, title, body)
    SELECT
      'contract_expiring',
      id,
      'contract',
      rec.id,
      'Contract expiring soon',
      'A contract is expiring within 30 days.'
    FROM auth.users
    WHERE (raw_user_meta_data->>'role')::text = 'manager' OR email LIKE '%@manager%'; -- Fallback heuristic if roles aren't strict yet
  END LOOP;
END;
$$;
