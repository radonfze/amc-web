-- Automation Logic

-- Function: update_amc_cycle
CREATE OR REPLACE FUNCTION public.update_amc_cycle(p_contract_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    last_normal_visit date;
    closed_count int;
    last_closed_visit date;
BEGIN
    SELECT MAX(visit_date)::date INTO last_normal_visit FROM amc_visits WHERE amc_contract_id = p_contract_id AND visit_type = 'normal';

    SELECT COUNT(*), MAX(visit_date)::date INTO closed_count, last_closed_visit FROM amc_visits WHERE amc_contract_id = p_contract_id AND visit_type = 'shop_closed' AND visit_date >= CURRENT_DATE - INTERVAL '5 days';

    IF last_normal_visit IS NOT NULL THEN
        UPDATE amc_contracts SET last_effective_visit_date = last_normal_visit, next_due_date = last_normal_visit + INTERVAL '90 days', cycle_status = 'ok' WHERE id = p_contract_id;
    ELSIF closed_count >= 3 THEN
        UPDATE amc_contracts SET last_effective_visit_date = last_closed_visit, next_due_date = last_closed_visit + INTERVAL '90 days', cycle_status = 'closed_satisfied' WHERE id = p_contract_id;
    END IF;

    UPDATE amc_contracts SET cycle_status = 'overdue' WHERE id = p_contract_id AND next_due_date < CURRENT_DATE;
    UPDATE amc_contracts SET cycle_status = 'due' WHERE id = p_contract_id AND next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days';
END;
$$;

-- Trigger Function: trigger_update_amc_cycle
CREATE OR REPLACE FUNCTION public.trigger_update_amc_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM public.update_amc_cycle(NEW.amc_contract_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_amc_cycle ON public.amc_visits;
CREATE TRIGGER trg_update_amc_cycle AFTER INSERT ON public.amc_visits FOR EACH ROW EXECUTE FUNCTION public.trigger_update_amc_cycle();

-- Trigger Function: trigger_update_payment_status
CREATE OR REPLACE FUNCTION public.trigger_update_payment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.payment_collected = true THEN
        UPDATE public.amc_contracts SET payment_status = 'collected_onsite' WHERE id = NEW.amc_contract_id;
        INSERT INTO public.payments (amc_contract_id, visit_id, technician_id, amount, method, collected_at) VALUES (NEW.amc_contract_id, NEW.id, NEW.technician_id, COALESCE(NEW.payment_amount, 0), 'cash', NEW.visit_date);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_payment_status ON public.amc_visits;
CREATE TRIGGER trg_update_payment_status AFTER INSERT ON public.amc_visits FOR EACH ROW EXECUTE FUNCTION public.trigger_update_payment_status();
