CREATE OR REPLACE VIEW amc_contracts_view AS
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
