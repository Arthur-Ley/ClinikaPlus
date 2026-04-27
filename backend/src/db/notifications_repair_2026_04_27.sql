-- One-time cleanup for notification inflation after dedupe key strategy changes.
-- Target schema: subsystem3
-- Run in Supabase SQL editor.

begin;

-- 1) Completed/cancelled restock events are informational history, not actionable.
update subsystem3.tbl_notifications
set
  status = 'Resolved',
  action_taken = true,
  resolved_at = coalesce(resolved_at, now()),
  updated_at = now()
where status in ('Active', 'InProgress')
  and type in ('restock_completed', 'restock_cancelled');

-- 2) Keep only the newest active notification per (type + source entity).
-- Older duplicates are resolved to preserve audit history while removing badge noise.
with ranked as (
  select
    notification_id,
    row_number() over (
      partition by type, source_entity_type, source_entity_id
      order by updated_at desc nulls last, created_at desc nulls last, notification_id desc
    ) as rn
  from subsystem3.tbl_notifications
  where status in ('Active', 'InProgress')
),
to_resolve as (
  select notification_id
  from ranked
  where rn > 1
)
update subsystem3.tbl_notifications n
set
  status = 'Resolved',
  action_taken = true,
  resolved_at = coalesce(n.resolved_at, now()),
  updated_at = now()
from to_resolve r
where n.notification_id = r.notification_id;

commit;

