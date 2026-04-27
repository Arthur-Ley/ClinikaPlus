-- Fix permission errors (42501) for notification tables.
-- Run this in Supabase SQL Editor.
-- Safe to run multiple times.

do $$
declare
  s text;
  t text;
  q text;
begin
  foreach s in array array['public', 'subsystem3'] loop
    if exists (select 1 from pg_namespace where nspname = s) then
      execute format('grant usage on schema %I to service_role', s);

      foreach t in array array['tbl_notifications', 'tbl_notification_reads', 'tbl_audit_events'] loop
        if exists (
          select 1
          from information_schema.tables
          where table_schema = s and table_name = t
        ) then
          execute format(
            'grant select, insert, update, delete on table %I.%I to service_role',
            s, t
          );
        end if;
      end loop;

      for q in
        select sequence_name
        from information_schema.sequences
        where sequence_schema = s
          and sequence_name in (
            'tbl_notifications_notification_id_seq',
            'tbl_notification_reads_read_id_seq',
            'tbl_audit_events_audit_event_id_seq'
          )
      loop
        execute format('grant usage, select on sequence %I.%I to service_role', s, q);
      end loop;
    end if;
  end loop;
end $$;

-- If RLS is enabled, allow service_role to operate on these tables.
-- This keeps API behavior unchanged while unblocking backend access.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'subsystem3' and table_name = 'tbl_notifications') then
    execute 'alter table subsystem3.tbl_notifications enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'subsystem3'
        and tablename = 'tbl_notifications'
        and policyname = 'service_role_all_tbl_notifications'
    ) then
      execute 'create policy service_role_all_tbl_notifications on subsystem3.tbl_notifications for all to service_role using (true) with check (true)';
    end if;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'subsystem3' and table_name = 'tbl_notification_reads') then
    execute 'alter table subsystem3.tbl_notification_reads enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'subsystem3'
        and tablename = 'tbl_notification_reads'
        and policyname = 'service_role_all_tbl_notification_reads'
    ) then
      execute 'create policy service_role_all_tbl_notification_reads on subsystem3.tbl_notification_reads for all to service_role using (true) with check (true)';
    end if;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'subsystem3' and table_name = 'tbl_audit_events') then
    execute 'alter table subsystem3.tbl_audit_events enable row level security';
    if not exists (
      select 1 from pg_policies
      where schemaname = 'subsystem3'
        and tablename = 'tbl_audit_events'
        and policyname = 'service_role_all_tbl_audit_events'
    ) then
      execute 'create policy service_role_all_tbl_audit_events on subsystem3.tbl_audit_events for all to service_role using (true) with check (true)';
    end if;
  end if;
end $$;
