import { supabase } from "../lib/supabase.js";
import { listMedicationStocks } from "./medicationService.js";
import { getBillingAnalyticsFlow } from "./billingService.js";

const ACTIVE_STATUSES = new Set(["Active", "InProgress"]);
const notificationDb = supabase.schema("subsystem3");
const PHARMACY_DOMAINS = new Set(["inventory", "expiry", "restock"]);
const DOMAIN_BY_TYPE = {
  low_stock: "inventory",
  critical_stock: "inventory",
  near_expiry: "expiry",
  expired: "expiry",
  restock_pending: "restock",
  restock_overdue: "restock",
  restock_completed: "restock",
  restock_cancelled: "restock",
  billing_pending_spike: "billing",
  billing_outstanding_high: "billing",
  alert_resolved: "inventory",
  system_warning: "system",
};

const BILLING_PENDING_SPIKE_THRESHOLD = 20;
const BILLING_OUTSTANDING_HIGH_THRESHOLD = 100000;

function toIsoNow() {
  return new Date().toISOString();
}

function daysUntil(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = parsed.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function normalizeSeverity(value) {
  const severity = String(value || "Warning").trim();
  if (severity === "Critical" || severity === "Warning" || severity === "Info") {
    return severity;
  }
  return "Warning";
}

function normalizeStatus(status) {
  const normalized = String(status || "Active").trim().toLowerCase();
  if (normalized === "resolved") return "Resolved";
  if (normalized === "inprogress") return "InProgress";
  return "Active";
}

function buildDedupeKey(payload) {
  return [
    payload.type,
    payload.source_entity_type || "none",
    payload.source_entity_id || "none",
    payload.signature || "default",
  ].join(":");
}

function toNotificationItem(row, readRow) {
  const actionRef = row.action_ref || null;
  const [targetPath, targetQueryRaw] = actionRef ? String(actionRef).split("?", 2) : [null, null];

  return {
    notification_id: row.notification_id,
    domain: row.domain,
    type: row.type,
    severity: row.severity,
    title: row.title,
    message: row.message,
    source_entity_type: row.source_entity_type,
    source_entity_id: row.source_entity_id,
    dedupe_key: row.dedupe_key,
    status: row.status,
    action_taken: Boolean(row.action_taken),
    action_taken_at: row.resolved_at || null,
    action_type: row.action_type || null,
    action_ref: actionRef,
    target_path: targetPath || null,
    target_query: targetQueryRaw || null,
    resolved_at: row.resolved_at || null,
    resolved_by: row.resolved_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_read: Boolean(readRow),
    read_at: readRow?.read_at || null,
  };
}

function severityRank(severity) {
  if (severity === "Critical") return 0;
  if (severity === "Warning") return 1;
  return 2;
}

function sortPriority(left, right) {
  const leftActive = ACTIVE_STATUSES.has(left.status);
  const rightActive = ACTIVE_STATUSES.has(right.status);
  const leftUnread = leftActive && !left.is_read;
  const rightUnread = rightActive && !right.is_read;

  const leftRank = left.status === "Resolved"
    ? 6
    : leftUnread
      ? severityRank(left.severity)
      : severityRank(left.severity) + 3;
  const rightRank = right.status === "Resolved"
    ? 6
    : rightUnread
      ? severityRank(right.severity)
      : severityRank(right.severity) + 3;

  if (leftRank !== rightRank) return leftRank - rightRank;

  const leftDate = new Date(left.resolved_at || left.created_at || 0).getTime();
  const rightDate = new Date(right.resolved_at || right.created_at || 0).getTime();
  return rightDate - leftDate;
}

function buildInventoryCandidates(stocks) {
  const candidates = [];

  for (const row of stocks || []) {
    const medicationKey = `I-${String(row.medication_id).padStart(3, "0")}`;
    const sourceEntityId = row.batch_id || row.medication_id;

    if (Number(row.total_stock || 0) <= 0) {
      candidates.push({
        type: "critical_stock",
        domain: DOMAIN_BY_TYPE.critical_stock,
        severity: "Critical",
        title: `${row.medication_name} stock is critical`,
        message: `${row.medication_name} stock is ${row.total_stock || 0} ${row.unit || "pcs"} vs threshold ${row.reorder_threshold || 0} ${row.unit || "pcs"}.`,
        source_entity_type: "medication",
        source_entity_id: String(row.medication_id),
        action_type: "review",
        action_ref: `/pharmacy/inventory?focusMedicationId=${encodeURIComponent(medicationKey)}`,
        signature: `${row.medication_id}:critical_stock`,
      });
      continue;
    }

    if (Number(row.total_stock || 0) < Number(row.reorder_threshold || 0)) {
      candidates.push({
        type: "low_stock",
        domain: DOMAIN_BY_TYPE.low_stock,
        severity: "Warning",
        title: `${row.medication_name} stock is low`,
        message: `${row.medication_name} stock is ${row.total_stock || 0} ${row.unit || "pcs"} vs threshold ${row.reorder_threshold || 0} ${row.unit || "pcs"}.`,
        source_entity_type: "medication",
        source_entity_id: String(row.medication_id),
        action_type: "review",
        action_ref: "/pharmacy/restock",
        signature: `${row.medication_id}:low_stock`,
      });
    }

    const expiryDays = daysUntil(row.expiry_date);
    if (expiryDays !== null && expiryDays < 0) {
      candidates.push({
        type: "expired",
        domain: DOMAIN_BY_TYPE.expired,
        severity: "Critical",
        title: `${row.medication_name} batch expired`,
        message: `${row.medication_name} batch ${row.batch_number || "N/A"} expired ${Math.abs(expiryDays)} day(s) ago. Affected quantity: ${row.total_stock || 0} ${row.unit || "pcs"}.`,
        source_entity_type: "batch",
        source_entity_id: String(sourceEntityId),
        action_type: "review",
        action_ref: `/pharmacy/inventory?focusMedicationId=${encodeURIComponent(medicationKey)}`,
        signature: `${sourceEntityId}:expired`,
      });
      continue;
    }

    if (expiryDays !== null && expiryDays <= 30) {
      candidates.push({
        type: "near_expiry",
        domain: DOMAIN_BY_TYPE.near_expiry,
        severity: "Warning",
        title: `${row.medication_name} expires soon`,
        message: `${row.medication_name} batch ${row.batch_number || "N/A"} expires in ${expiryDays} day(s). Affected quantity: ${row.total_stock || 0} ${row.unit || "pcs"}.`,
        source_entity_type: "batch",
        source_entity_id: String(sourceEntityId),
        action_type: "review",
        action_ref: `/pharmacy/inventory?focusMedicationId=${encodeURIComponent(medicationKey)}`,
        signature: `${sourceEntityId}:near_expiry`,
      });
    }
  }

  return candidates;
}

function buildRestockCandidates(restockRequests) {
  const candidates = [];

  for (const row of restockRequests || []) {
    const requestedOn = row.requested_on ? new Date(row.requested_on) : null;
    const pendingAgeDays = requestedOn && !Number.isNaN(requestedOn.getTime())
      ? Math.ceil((Date.now() - requestedOn.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    if (row.status === "Pending") {
      const isOverdue = pendingAgeDays !== null && pendingAgeDays > 3;
      candidates.push({
        type: isOverdue ? "restock_overdue" : "restock_pending",
        domain: DOMAIN_BY_TYPE[isOverdue ? "restock_overdue" : "restock_pending"],
        severity: isOverdue ? "Critical" : "Warning",
        title: `${row.medication_name} restock request ${isOverdue ? "is overdue" : "pending"}`,
        message: `Request ${row.request_code || row.request_id} for ${row.medication_name} (${row.supplier_name || "N/A"}) is ${isOverdue ? `overdue by ${pendingAgeDays} day(s)` : "waiting for supplier action"}.`,
        source_entity_type: "restock_request",
        source_entity_id: String(row.request_id),
        action_type: "review",
        action_ref: `/pharmacy/restock?focusRequestCode=${encodeURIComponent(row.request_code || String(row.request_id))}`,
        signature: `${row.request_id}:${isOverdue ? "restock_overdue" : "restock_pending"}`,
      });
      continue;
    }
  }

  return candidates;
}

async function ensureNotificationCandidate(candidate) {
  const now = toIsoNow();
  const dedupeKey = buildDedupeKey(candidate);
  const payload = {
    domain: candidate.domain,
    type: candidate.type,
    severity: normalizeSeverity(candidate.severity),
    title: candidate.title,
    message: candidate.message,
    source_entity_type: candidate.source_entity_type,
    source_entity_id: candidate.source_entity_id,
    dedupe_key: dedupeKey,
    action_type: candidate.action_type || "review",
    action_ref: candidate.action_ref || null,
    updated_at: now,
  };

  const { data: existing, error: existingError } = await notificationDb
    .from("tbl_notifications")
    .select("notification_id, status")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existingError) throw existingError;

  if (!existing) {
    const { error } = await notificationDb.from("tbl_notifications").insert({
      ...payload,
      status: "Active",
      action_taken: false,
      created_at: now,
    });
    if (error) throw error;
    return;
  }

  if (existing.status === "Resolved") {
    return;
  }

  const { error } = await notificationDb
    .from("tbl_notifications")
    .update(payload)
    .eq("notification_id", existing.notification_id);
  if (error) throw error;
}

async function syncPharmacyNotifications() {
  const { listRestockRequests } = await import("./restockRequestService.js");
  const [stockRows, restockRows] = await Promise.all([
    listMedicationStocks(),
    listRestockRequests(),
  ]);

  const candidates = [
    ...buildInventoryCandidates(stockRows),
    ...buildRestockCandidates(restockRows),
  ];

  for (const candidate of candidates) {
    await ensureNotificationCandidate(candidate);
  }

  await reconcileRestockNotificationStates(restockRows);
}

function toRestockLifecycleType(restockRow) {
  if (restockRow?.status !== "Pending") return null;

  const requestedOn = restockRow.requested_on ? new Date(restockRow.requested_on) : null;
  const pendingAgeDays = requestedOn && !Number.isNaN(requestedOn.getTime())
    ? Math.ceil((Date.now() - requestedOn.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (pendingAgeDays !== null && pendingAgeDays > 3) return "restock_overdue";
  return "restock_pending";
}

async function reconcileRestockNotificationStates(restockRows) {
  const now = toIsoNow();
  const desiredTypeByRequestId = new Map();

  for (const row of restockRows || []) {
    const requestId = Number(row?.request_id);
    if (!Number.isInteger(requestId)) continue;
    desiredTypeByRequestId.set(String(requestId), toRestockLifecycleType(row));
  }

  const trackedRequestIds = [...desiredTypeByRequestId.keys()];
  if (trackedRequestIds.length === 0) return;

  const { data: activeRows, error } = await notificationDb
    .from("tbl_notifications")
    .select("notification_id, source_entity_id, type, status")
    .eq("source_entity_type", "restock_request")
    .in("type", ["restock_pending", "restock_overdue"])
    .in("status", ["Active", "InProgress"])
    .in("source_entity_id", trackedRequestIds);
  if (error) throw error;

  for (const row of activeRows || []) {
    const requestId = String(row.source_entity_id || "");
    const desiredType = desiredTypeByRequestId.get(requestId) || null;

    const shouldResolve = !desiredType || row.type !== desiredType;
    if (!shouldResolve) continue;

    const { error: updateError } = await notificationDb
      .from("tbl_notifications")
      .update({
        status: "Resolved",
        action_taken: true,
        action_type: "resolve",
        resolved_at: now,
        resolved_by: null,
        updated_at: now,
      })
      .eq("notification_id", row.notification_id);
    if (updateError) throw updateError;
  }
}

function buildBillingCandidates(analytics) {
  const candidates = [];
  const pendingBills = Number(analytics?.total_pending_bills || 0);
  const outstandingBalance = Number(analytics?.total_outstanding_balance || 0);

  if (pendingBills >= BILLING_PENDING_SPIKE_THRESHOLD) {
    candidates.push({
      type: "billing_pending_spike",
      domain: DOMAIN_BY_TYPE.billing_pending_spike,
      severity: "Warning",
      title: "Pending bills are unusually high",
      message: `${pendingBills} bills are currently pending payment posting.`,
      source_entity_type: "billing",
      source_entity_id: "pending_bills",
      action_type: "review",
      action_ref: "/billing/transactions",
      signature: `pending:${pendingBills}`,
    });
  }

  if (outstandingBalance >= BILLING_OUTSTANDING_HIGH_THRESHOLD) {
    candidates.push({
      type: "billing_outstanding_high",
      domain: DOMAIN_BY_TYPE.billing_outstanding_high,
      severity: "Critical",
      title: "Outstanding billing balance is high",
      message: `Outstanding balance reached ₱${Math.round(outstandingBalance).toLocaleString("en-US")}.`,
      source_entity_type: "billing",
      source_entity_id: "outstanding_balance",
      action_type: "review",
      action_ref: "/billing/transactions",
      signature: `outstanding:${Math.round(outstandingBalance)}`,
    });
  }

  return candidates;
}

async function syncBillingNotifications() {
  const analytics = await getBillingAnalyticsFlow();
  const candidates = buildBillingCandidates(analytics);

  for (const candidate of candidates) {
    await ensureNotificationCandidate(candidate);
  }
}

async function emitSystemWarning(signature, title, message) {
  try {
    await ensureNotificationCandidate({
      type: "system_warning",
      domain: DOMAIN_BY_TYPE.system_warning,
      severity: "Warning",
      title,
      message,
      source_entity_type: "system",
      source_entity_id: signature,
      action_type: "review",
      action_ref: "/dashboard",
      signature,
    });
  } catch {
    // Best-effort path; avoid masking the original source failure.
  }
}

async function syncNotificationSources() {
  try {
    await syncPharmacyNotifications();
  } catch (error) {
    await emitSystemWarning(
      `sync:pharmacy:${new Date().toISOString().slice(0, 10)}`,
      "Pharmacy notification sync warning",
      `Failed to refresh pharmacy notifications: ${error?.message || "Unknown error"}.`,
    );
  }

  try {
    await syncBillingNotifications();
  } catch (error) {
    await emitSystemWarning(
      `sync:billing:${new Date().toISOString().slice(0, 10)}`,
      "Billing notification sync warning",
      `Failed to refresh billing notifications: ${error?.message || "Unknown error"}.`,
    );
  }
}

async function readNotificationRows(userId) {
  const [notificationsResult, readsResult] = await Promise.all([
    notificationDb
      .from("tbl_notifications")
      .select(`
        notification_id,
        domain,
        type,
        severity,
        title,
        message,
        source_entity_type,
        source_entity_id,
        dedupe_key,
        status,
        action_taken,
        action_type,
        action_ref,
        resolved_at,
        resolved_by,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false }),
    notificationDb
      .from("tbl_notification_reads")
      .select("notification_id, read_at")
      .eq("user_id", userId),
  ]);

  if (notificationsResult.error) throw notificationsResult.error;
  if (readsResult.error) throw readsResult.error;

  const readById = new Map((readsResult.data || []).map((row) => [row.notification_id, row]));
  return (notificationsResult.data || []).map((row) => toNotificationItem(row, readById.get(row.notification_id)));
}

function applyNotificationFilters(items, filters) {
  const domainFilter = new Set((filters.domain || []).map((value) => value.toLowerCase()));
  const severityFilter = new Set((filters.severity || []).map((value) => value.toLowerCase()));
  const matchesDomain = (domainValue) => {
    if (domainFilter.size === 0) return true;

    const normalizedDomain = String(domainValue || "").toLowerCase();
    if (domainFilter.has(normalizedDomain)) return true;
    if (domainFilter.has("all")) return true;
    if (domainFilter.has("pharmacy") && PHARMACY_DOMAINS.has(normalizedDomain)) return true;
    return false;
  };

  return items
    .filter((item) => {
      const statusFilter = String(filters.status || "all").toLowerCase();
      if (statusFilter === "resolved" && item.status !== "Resolved") return false;
      if ((statusFilter === "active" || statusFilter === "inprogress") && item.status.toLowerCase() !== statusFilter) return false;
      if (statusFilter === "unresolved" && !ACTIVE_STATUSES.has(item.status)) return false;
      if (filters.unreadOnly && item.is_read) return false;
      if (!matchesDomain(item.domain)) return false;
      if (severityFilter.size > 0 && !severityFilter.has(String(item.severity || "").toLowerCase())) return false;
      return true;
    })
    .sort(sortPriority);
}

function buildSummary(items) {
  const unresolved = items.filter((item) => ACTIVE_STATUSES.has(item.status));
  const unresolvedByDomain = unresolved.reduce((acc, item) => {
    const key = String(item.domain || "system").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const pharmacyBadgeCount = unresolved.filter((item) => {
    if (!PHARMACY_DOMAINS.has(String(item.domain || "").toLowerCase())) return false;
    if (item.type === "restock_pending" || item.type === "restock_overdue") return true;
    return item.severity === "Critical" || item.severity === "Warning";
  }).length;

  return {
    badgeCount: unresolved.length,
    unresolvedCount: unresolved.length,
    unresolvedCriticalCount: unresolved.filter((item) => item.severity === "Critical").length,
    unresolvedWarningCount: unresolved.filter((item) => item.severity === "Warning").length,
    unresolvedReadCount: unresolved.filter((item) => item.is_read).length,
    unreadCount: unresolved.filter((item) => !item.is_read).length,
    resolvedCount: items.filter((item) => item.status === "Resolved").length,
    totalCount: items.length,
    pharmacyBadgeCount,
    byDomain: {
      pharmacy: unresolved.filter((item) => PHARMACY_DOMAINS.has(String(item.domain || "").toLowerCase())).length,
      billing: unresolvedByDomain.billing || 0,
      system: unresolvedByDomain.system || 0,
    },
  };
}

async function logAuditEvent({ actorId, actionType, entityType, entityId, notificationId = null, details = {} }) {
  const reason = typeof details?.reason === "string" ? details.reason : null;
  const normalizedEntityId = entityId != null
    ? String(entityId)
    : (notificationId != null ? String(notificationId) : "unknown");
  const afterData = {
    ...(notificationId != null ? { notification_id: notificationId } : {}),
    ...(details && typeof details === "object" ? details : {}),
  };

  const { error } = await notificationDb.from("tbl_audit_events").insert({
    actor_user_id: actorId || null,
    action_type: actionType,
    entity_type: entityType,
    entity_id: normalizedEntityId,
    reason,
    after_data: afterData,
    created_at: toIsoNow(),
  });
  if (error) throw error;
}

async function resolveNotificationRow(notificationRow, actorId, details = {}, nextType, overrides = {}) {
  const now = toIsoNow();

  const updatePayload = {
    domain: overrides.domain || notificationRow.domain,
    type: nextType || notificationRow.type,
    severity: normalizeSeverity(overrides.severity || notificationRow.severity),
    title: overrides.title || notificationRow.title,
    message: overrides.message || notificationRow.message,
    source_entity_type: overrides.sourceEntityType || notificationRow.source_entity_type,
    source_entity_id: overrides.sourceEntityId || notificationRow.source_entity_id,
    status: "Resolved",
    action_taken: true,
    action_type: overrides.actionType || notificationRow.action_type || "resolve",
    action_ref: overrides.actionRef || notificationRow.action_ref || null,
    resolved_at: now,
    resolved_by: actorId || null,
    updated_at: now,
  };

  const { data, error } = await notificationDb
    .from("tbl_notifications")
    .update(updatePayload)
    .eq("notification_id", notificationRow.notification_id)
    .select(`
      notification_id,
      domain,
      type,
      severity,
      title,
      message,
      source_entity_type,
      source_entity_id,
      dedupe_key,
      status,
      action_taken,
      action_type,
      action_ref,
      resolved_at,
      resolved_by,
      created_at,
      updated_at
    `)
    .single();
  if (error) throw error;

  await logAuditEvent({
    actorId,
    actionType: "notification_resolved",
    entityType: updatePayload.source_entity_type || "notification",
    entityId: updatePayload.source_entity_id || notificationRow.notification_id,
    notificationId: notificationRow.notification_id,
    details,
  });

  return data;
}

async function findNotificationForSource(sourceEntityType, sourceEntityId, notificationTypes = []) {
  let query = notificationDb
    .from("tbl_notifications")
    .select(`
      notification_id,
      domain,
      type,
      severity,
      title,
      message,
      source_entity_type,
      source_entity_id,
      dedupe_key,
      status,
      action_taken,
      action_type,
      action_ref,
      resolved_at,
      resolved_by,
      created_at,
      updated_at
    `)
    .eq("source_entity_type", sourceEntityType)
    .eq("source_entity_id", String(sourceEntityId))
    .in("status", ["Active", "InProgress"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (notificationTypes.length > 0) {
    query = query.in("type", notificationTypes);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function resolveNotificationBySource({
  sourceEntityType,
  sourceEntityId,
  actorId,
  notificationTypes = [],
  nextType,
  title,
  message,
  severity = "Info",
  domain,
  metadata = {},
  actionType = "resolve",
  actionRef = null,
}) {
  const existing = await findNotificationForSource(sourceEntityType, sourceEntityId, notificationTypes);
  if (existing) {
    return resolveNotificationRow(
      existing,
      actorId,
      { resolved_via: "source_action", ...metadata },
      nextType,
      {
        title,
        message,
        severity,
        domain,
        sourceEntityType,
        sourceEntityId: String(sourceEntityId),
        actionType,
        actionRef,
      },
    );
  }

  const now = toIsoNow();
  const type = nextType || notificationTypes[0] || "system_warning";
  const dedupeKey = buildDedupeKey({
    type,
    source_entity_type: sourceEntityType,
    source_entity_id: String(sourceEntityId),
    signature: metadata.signature || `${sourceEntityType}:${sourceEntityId}:${now}`,
  });

  const { data, error } = await notificationDb
    .from("tbl_notifications")
    .insert({
      domain: domain || DOMAIN_BY_TYPE[type] || "system",
      type,
      severity: normalizeSeverity(severity),
      title,
      message,
      source_entity_type: sourceEntityType,
      source_entity_id: String(sourceEntityId),
      dedupe_key: dedupeKey,
      status: "Resolved",
      action_taken: true,
      action_type: actionType,
      action_ref: actionRef,
      resolved_at: now,
      resolved_by: actorId || null,
      created_at: now,
      updated_at: now,
    })
    .select("notification_id")
    .single();
  if (error) throw error;

  await logAuditEvent({
    actorId,
    actionType: "notification_resolved",
    entityType: sourceEntityType,
    entityId: sourceEntityId,
    notificationId: data.notification_id,
    details: metadata,
  });

  return data;
}

async function listNotificationsForUser(userId, filters) {
  await syncNotificationSources();
  const items = await readNotificationRows(userId);
  return {
    items: applyNotificationFilters(items, filters),
    summary: buildSummary(items),
  };
}

async function getNotificationSummaryForUser(userId) {
  await syncNotificationSources();
  const items = await readNotificationRows(userId);
  return { summary: buildSummary(items) };
}

async function markNotificationRead(notificationId, userId) {
  const now = toIsoNow();
  const { data: notification, error: notificationError } = await notificationDb
    .from("tbl_notifications")
    .select("notification_id")
    .eq("notification_id", notificationId)
    .maybeSingle();
  if (notificationError) throw notificationError;
  if (!notification?.notification_id) throw new Error("Notification not found.");

  const { error } = await notificationDb.from("tbl_notification_reads").upsert(
    {
      notification_id: notificationId,
      user_id: userId,
      read_at: now,
    },
    { onConflict: "notification_id,user_id" },
  );
  if (error) throw error;

  return { ok: true };
}

async function markAllNotificationsRead(userId) {
  if (!userId) {
    throw new Error("User context is required to mark notifications as read.");
  }

  const { data: notifications, error: notificationsError } = await notificationDb
    .from("tbl_notifications")
    .select("notification_id")
    .in("status", ["Active", "InProgress"]);
  if (notificationsError) throw notificationsError;

  const notificationIds = (notifications || [])
    .map((row) => row.notification_id)
    .filter((value) => Number.isInteger(value));

  if (notificationIds.length === 0) {
    return { ok: true, updatedCount: 0 };
  }

  const now = toIsoNow();
  const payload = notificationIds.map((notificationId) => ({
    notification_id: notificationId,
    user_id: userId,
    read_at: now,
  }));

  const { error } = await notificationDb.from("tbl_notification_reads").upsert(payload, {
    onConflict: "notification_id,user_id",
  });
  if (error) throw error;

  return { ok: true, updatedCount: notificationIds.length };
}

async function resolveNotification(notificationId, actorId, reason = null) {
  const { data: notification, error } = await notificationDb
    .from("tbl_notifications")
    .select(`
      notification_id,
      domain,
      type,
      severity,
      title,
      message,
      source_entity_type,
      source_entity_id,
      dedupe_key,
      status,
      action_taken,
      action_type,
      action_ref,
      resolved_at,
      resolved_by,
      created_at,
      updated_at
    `)
    .eq("notification_id", notificationId)
    .maybeSingle();
  if (error) throw error;
  if (!notification?.notification_id) throw new Error("Notification not found.");

  if (actorId) {
    await notificationDb.from("tbl_notification_reads").upsert(
      {
        notification_id: notification.notification_id,
        user_id: actorId,
        read_at: toIsoNow(),
      },
      { onConflict: "notification_id,user_id" },
    );
  }

  if (notification.status === "Resolved") {
    await logAuditEvent({
      actorId,
      actionType: "notification_resolved",
      entityType: notification.source_entity_type || "notification",
      entityId: notification.source_entity_id || notification.notification_id,
      notificationId: notification.notification_id,
      details: {
        alreadyResolved: true,
        ...(reason ? { reason } : {}),
      },
    });

    return notification;
  }

  return resolveNotificationRow(
    notification,
    actorId,
    {
      resolved_via: "notification_center",
      ...(reason ? { reason } : {}),
    },
    notification.type,
    { actionType: "resolve", actionRef: notification.action_ref },
  );
}

export {
  syncPharmacyNotifications,
  listNotificationsForUser,
  getNotificationSummaryForUser,
  markNotificationRead,
  markAllNotificationsRead,
  resolveNotification,
  resolveNotificationBySource,
  logAuditEvent,
};
