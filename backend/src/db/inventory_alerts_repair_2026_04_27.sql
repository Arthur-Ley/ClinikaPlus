-- One-time cleanup for inventory alert inflation after dedupe changes.
-- Target schema: public
-- Run in the Supabase SQL editor.

begin;

-- Keep only the newest active alert per logical key.
-- Medication-level stock alerts use medication_id; batch-level expiry alerts use batch_id.
with ranked as (
  select
    alert_id,
    row_number() over (
      partition by coalesce(batch_id, medication_id), alert_type
      order by
        is_resolved asc,
        updated_at desc nulls last,
        resolved_at desc nulls last,
        triggered_at desc nulls last,
        alert_id desc
    ) as rn
  from public.tbl_inventory_alerts
),
duplicates as (
  select alert_id
  from ranked
  where rn > 1
)
update public.tbl_inventory_alerts a
set
  is_resolved = true,
  resolved_at = coalesce(a.resolved_at, now()),
  resolved_reason = coalesce(a.resolved_reason, 'Deduplicated during cleanup'),
  updated_at = now()
from duplicates d
where a.alert_id = d.alert_id
  and a.is_resolved = false;

-- Prevent future duplicate active alerts for the same medication/batch + alert type.
create unique index if not exists idx_tbl_inventory_alerts_active_dedupe
  on public.tbl_inventory_alerts ((coalesce(batch_id, medication_id)), alert_type)
  where is_resolved = false;

commit;
