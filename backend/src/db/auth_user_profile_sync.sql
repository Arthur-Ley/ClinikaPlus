-- Fixes Supabase Auth signup failures caused by legacy auth.users triggers/functions
-- that read non-existent columns like NEW.first_name from auth.users.
--
-- Run this in the Supabase SQL editor for the affected project.

begin;

create schema if not exists subsystem3;

create table if not exists subsystem3.tbl_users (
  user_id uuid primary key,
  first_name text not null default '',
  last_name text not null default '',
  email text not null,
  phone text not null default '',
  dob date null,
  role text not null default 'pharmacist',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function subsystem3.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into subsystem3.tbl_users (
    user_id,
    first_name,
    last_name,
    email,
    phone,
    dob,
    role
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'dob', '')::date,
    coalesce(new.raw_user_meta_data ->> 'role', 'pharmacist')
  )
  on conflict (user_id) do update
  set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    phone = excluded.phone,
    dob = excluded.dob,
    role = excluded.role,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists trg_on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_signup on auth.users;
drop trigger if exists on_auth_user_created_patient_profile on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function subsystem3.handle_auth_user_created();

commit;
