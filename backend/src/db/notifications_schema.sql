-- Pharmacy notification schema for ClinikaPlus.
-- Run only the statements you still need. If the tables already exist in Supabase, skip them.

create table if not exists public.tbl_notifications (
  notification_id bigserial primary key,
  notification_key text not null unique,
  notification_type text not null,
  domain text not null,
  severity text not null check (severity in ('Critical', 'Warning', 'Info')),
  title text not null,
  message text not null,
  context_label text,
  medication_id bigint,
  medication_name text,
  medication_key text,
  batch_id bigint,
  batch_number text,
  request_id bigint,
  alert_id bigint,
  source_entity_type text,
  source_entity_id text,
  action_label text,
  action_path text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'unresolved' check (status in ('unresolved', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid references subsystem3.tbl_users(user_id),
  created_by uuid references subsystem3.tbl_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tbl_notifications_status_created_at on public.tbl_notifications(status, created_at desc);
create index if not exists idx_tbl_notifications_domain on public.tbl_notifications(domain);
create index if not exists idx_tbl_notifications_type on public.tbl_notifications(notification_type);
create index if not exists idx_tbl_notifications_source_entity on public.tbl_notifications(source_entity_type, source_entity_id);

create table if not exists public.tbl_notification_reads (
  read_id bigserial primary key,
  notification_id bigint not null references public.tbl_notifications(notification_id) on delete cascade,
  user_id uuid not null references subsystem3.tbl_users(user_id) on delete cascade,
  read_at timestamptz not null default now(),
  unique(notification_id, user_id)
);

create index if not exists idx_tbl_notification_reads_user_id on public.tbl_notification_reads(user_id, read_at desc);

create table if not exists public.tbl_audit_events (
  audit_event_id bigserial primary key,
  actor_id uuid references subsystem3.tbl_users(user_id),
  action_type text not null,
  entity_type text not null,
  entity_id text,
  notification_id bigint references public.tbl_notifications(notification_id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tbl_audit_events_actor_id on public.tbl_audit_events(actor_id, created_at desc);
create index if not exists idx_tbl_audit_events_entity on public.tbl_audit_events(entity_type, entity_id);
