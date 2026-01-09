-- AMC Module Schema
-- Run this in your Supabase SQL Editor

-- Enable PostGIS if needed for advanced geo-queries (optional for simple distance calc)
-- create extension if not exists postgis;

-- 1. Users Table
-- Extends Supabase Auth (technician, manager, admin)
create table public.users (
  id uuid references auth.users not null primary key,
  role text check (role in ('admin', 'manager', 'technician')) not null default 'technician',
  name text,
  phone text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.users enable row level security;

-- 2. Customers Table
create table public.customers (
  id bigint generated always as identity primary key,
  name text not null,
  gov_license_no text,
  gra_no text,
  contact_person text,
  contact_phone text,
  area text,
  city text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.customers enable row level security;

-- 3. Customer Locations Table
create table public.customer_locations (
  id bigint generated always as identity primary key,
  customer_id bigint references public.customers(id) on delete cascade not null,
  display_name text,
  lat numeric,
  lng numeric,
  full_address text,
  gov_certificate_date date,
  gov_renewal_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.customer_locations enable row level security;

-- 4. AMC Contracts Table
create table public.amc_contracts (
  id bigint generated always as identity primary key,
  customer_location_id bigint references public.customer_locations(id) on delete cascade not null,
  start_date date not null,
  end_date date not null,
  status text check (status in ('active', 'expired', 'cancelled')) default 'active',
  amount_total numeric default 1000,
  amount_police numeric default 550,
  amount_company numeric default 450,
  payment_status text check (payment_status in ('pending', 'collected_onsite', 'paid_online', 'paid_bank', 'partial')) default 'pending',
  last_effective_visit_date date,
  next_due_date date,
  cycle_status text check (cycle_status in ('ok', 'due', 'overdue', 'closed_satisfied')) default 'ok',
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.amc_contracts enable row level security;

-- 5. AMC Visits Table
create table public.amc_visits (
  id bigint generated always as identity primary key,
  amc_contract_id bigint references public.amc_contracts(id) on delete cascade not null,
  technician_id uuid references public.users(id),
  visit_type text check (visit_type in ('normal', 'shop_closed', 'payment')) not null,
  visit_date timestamp with time zone default timezone('utc'::text, now()) not null,
  gps_lat numeric not null,
  gps_lng numeric not null,
  distance_from_site_m numeric, -- calculated and stored validation
  remarks text,
  photos_urls jsonb, -- array of strings
  payment_collected boolean default false,
  payment_amount numeric default 0,
  payment_breakdown_json jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.amc_visits enable row level security;

-- 6. Payments Table (Optional, for detailed tracking)
create table public.payments (
  id bigint generated always as identity primary key,
  amc_contract_id bigint references public.amc_contracts(id) on delete cascade not null,
  visit_id bigint references public.amc_visits(id),
  amount numeric not null,
  method text check (method in ('cash', 'card', 'online')) default 'cash',
  collector_id uuid references public.users(id),
  collected_at timestamp with time zone default timezone('utc'::text, now()) not null,
  police_share numeric default 550,
  company_share numeric default 450
);

alter table public.payments enable row level security;

-- Helper function to calculate distance (Haversine)
create or replace function public.calculate_distance(
  lat1 numeric, 
  lon1 numeric, 
  lat2 numeric, 
  lon2 numeric
)
returns numeric as $$
declare
  R numeric := 6371000; -- Earth radius in meters
  dLat numeric;
  dLon numeric;
  a numeric;
  c numeric;
begin
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  a := sin(dLat / 2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon / 2)^2;
  c := 2 * asin(sqrt(a));
  return R * c;
end;
$$ language plpgsql immutable;

-------------------------------------------------------------------------------
-- Row Level Security Policies
-------------------------------------------------------------------------------

-- USERS
-- Authenticated users can read their own profile
create policy "Users can read own profile" on public.users
  for select using (auth.uid() = id);

-- Admins/Managers can read all profiles
create policy "Admins/Managers can read all profiles" on public.users
  for select using (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

-- CUSTOMERS, LOCATIONS, CONTRACTS
-- Allow all authenticated users (technicians) to view (needed for listing nearby)
create policy "Auth users view customers" on public.customers
  for select using (auth.role() = 'authenticated');

create policy "Auth users view locations" on public.customer_locations
  for select using (auth.role() = 'authenticated');

create policy "Auth users view contracts" on public.amc_contracts
  for select using (auth.role() = 'authenticated');

-- Managers can update contracts (e.g. status)
create policy "Managers update contracts" on public.amc_contracts
  for update using (
    exists (
      select 1 from public.users 
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

-- VISITS
-- Technicians can insert visits regarding contracts
create policy "Technicians insert visits" on public.amc_visits
  for insert with check (
    auth.uid() = technician_id
  );

-- Authenticated users can view visits (history)
create policy "Auth users view visits" on public.amc_visits
  for select using (auth.role() = 'authenticated');

-- PAYMENTS
create policy "Authenticated users view payments" on public.payments
  for select using (auth.role() = 'authenticated');
