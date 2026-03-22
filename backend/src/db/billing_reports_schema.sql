-- Billing and reports schema for ClinikaPlus.
-- Run only the statements you still need. If a table already exists in Supabase, skip it.
-- This schema assumes tbl_patients(patient_id) and tbl_medications(medication_id) already exist.

create table if not exists public.tbl_services (
  service_id bigserial primary key,
  service_code text unique,
  service_name text not null,
  service_category text not null,
  default_price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tbl_bills (
  bill_id bigserial primary key,
  bill_code text not null unique,
  patient_id bigint not null references public.tbl_patients(patient_id),
  total_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  insurance_coverage numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  status text not null default 'Pending' check (status in ('Pending', 'Partially Paid', 'Paid', 'Cancelled')),
  subtotal_medications numeric(12,2) not null default 0,
  subtotal_laboratory numeric(12,2) not null default 0,
  subtotal_miscellaneous numeric(12,2) not null default 0,
  subtotal_room_charge numeric(12,2) not null default 0,
  subtotal_professional_fee numeric(12,2) not null default 0,
  discount_type text,
  discount_rate numeric(5,2),
  is_senior_citizen boolean not null default false,
  is_pwd boolean not null default false,
  admission_datetime timestamptz,
  discharge_datetime timestamptz,
  referred_by text,
  discharge_status text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tbl_bills_patient_id on public.tbl_bills(patient_id);
create index if not exists idx_tbl_bills_status on public.tbl_bills(status);
create index if not exists idx_tbl_bills_created_at on public.tbl_bills(created_at desc);

create table if not exists public.tbl_bill_items (
  bill_item_id bigserial primary key,
  bill_id bigint not null references public.tbl_bills(bill_id) on delete cascade,
  service_id bigint references public.tbl_services(service_id),
  medication_id bigint references public.tbl_medications(medication_id),
  log_id bigint,
  service_type text,
  source text,
  description text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint tbl_bill_items_service_or_medication_chk check (
    service_id is not null or medication_id is not null or log_id is not null or description is not null
  )
);

create index if not exists idx_tbl_bill_items_bill_id on public.tbl_bill_items(bill_id);
create index if not exists idx_tbl_bill_items_service_id on public.tbl_bill_items(service_id);
create index if not exists idx_tbl_bill_items_medication_id on public.tbl_bill_items(medication_id);
create index if not exists idx_tbl_bill_items_created_at on public.tbl_bill_items(created_at desc);

create table if not exists public.tbl_payments (
  payment_id bigserial primary key,
  payment_code text not null unique,
  bill_id bigint not null references public.tbl_bills(bill_id) on delete cascade,
  payment_method text not null check (payment_method in ('Cash', 'GCash', 'Maya', 'Card', 'Bank Transfer', 'Other')),
  amount_paid numeric(12,2) not null check (amount_paid > 0),
  reference_number text,
  payment_date timestamptz not null default now(),
  received_by text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tbl_payments_bill_id on public.tbl_payments(bill_id);
create index if not exists idx_tbl_payments_method on public.tbl_payments(payment_method);
create index if not exists idx_tbl_payments_payment_date on public.tbl_payments(payment_date desc);

-- Optional seed data for the hardcoded services currently used in the frontend.
insert into public.tbl_services (service_code, service_name, service_category, default_price)
values
  ('SRV-00001', 'Consultation Fee', 'Consultation', 500.00),
  ('SRV-00002', 'Follow-up Consultation', 'Consultation', 300.00),
  ('SRV-00003', 'Emergency Consultation', 'Consultation', 800.00),
  ('SRV-00004', 'X-Ray', 'Laboratory / X-Ray', 1200.00),
  ('SRV-00005', 'Blood Tests', 'Laboratory / X-Ray', 350.00),
  ('SRV-00006', 'Laboratory', 'Laboratory / X-Ray', 450.00),
  ('SRV-00007', 'Urinalysis', 'Urinalysis', 200.00),
  ('SRV-00008', 'Complete Urinalysis', 'Urinalysis', 300.00),
  ('SRV-00009', 'Physical Therapy', 'Therapy', 850.00),
  ('SRV-00010', 'Oral Examination', 'Therapy', 300.00),
  ('SRV-00011', 'Dentistry', 'Therapy', 700.00)
on conflict (service_code) do nothing;
