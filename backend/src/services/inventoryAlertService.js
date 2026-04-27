import { supabase } from "../lib/supabase.js";
import { listMedicationStocks } from "./medicationService.js";
import { resolveNotificationBySource } from "./notificationService.js";

const STOCK_ALERT_TYPE = "Stock Risk";
const EXPIRY_ALERT_TYPE = "Expiry Risk";

function computeStockSeverity(stock, status) {
  return stock <= 0 || status === "Critical" ? "Critical" : "Warning";
}

function computeExpirySeverity(expiryStatus) {
  return expiryStatus === "Expired" ? "Critical" : "Warning";
}

function toKey(sourceType, sourceId, alertType) {
  return `${sourceType}:${sourceId}:${alertType}`;
}

function getPersistedAlertKey(row) {
  if (row.batch_id) {
    return toKey("batch", row.batch_id, row.alert_type);
  }
  return toKey("medication", row.medication_id, row.alert_type);
}

function getActiveAlertKey(batchId, medicationId, alertType) {
  if (batchId) {
    return toKey("batch", batchId, alertType);
  }
  return toKey("medication", medicationId, alertType);
}

function formatStockAlertMessage(medicationName, stock, reorder, unit) {
  return `${medicationName} stock is ${stock} ${unit}; reorder threshold is ${reorder} ${unit}.`;
}

function formatExpiryAlertMessage(stock) {
  const medicationName = stock.medication_name;
  const batchLabel = stock.batch_number || "N/A";
  const days = Number(stock.days_until_expiry);
  if (stock.expiry_status === "Expired" || days < 0) {
    return `${medicationName} batch ${batchLabel} expired ${Math.abs(days)} day(s) ago. Affected quantity: ${stock.total_stock || 0} ${stock.unit || "pcs"}.`;
  }
  return `${medicationName} batch ${batchLabel} expires in ${days} day(s). Affected quantity: ${stock.total_stock || 0} ${stock.unit || "pcs"}.`;
}

function toUiAlert(stock, persistedAlert) {
  const severity = persistedAlert?.severity || computeStockSeverity(stock.total_stock, stock.status);
  return {
    alert_id: persistedAlert?.alert_id || null,
    medication_id: stock.medication_id,
    medication_key: `I-${String(stock.medication_id).padStart(3, "0")}`,
    medication_name: stock.medication_name,
    category_name: stock.category_name,
    batch_id: stock.batch_id,
    expiry_date: stock.expiry_date,
    total_stock: stock.total_stock,
    reorder_threshold: stock.reorder_threshold,
    unit: stock.unit,
    severity,
    alert_type: persistedAlert?.alert_type || STOCK_ALERT_TYPE,
    alert_message: persistedAlert?.alert_message || formatStockAlertMessage(stock.medication_name, stock.total_stock, stock.reorder_threshold, stock.unit),
    triggered_at: persistedAlert?.triggered_at || new Date().toISOString(),
    is_resolved: false,
  };
}

function severityScore(severity) {
  return severity === "Critical" ? 0 : 1;
}

function preferAlert(left, right) {
  if (!left) return right;
  if (!right) return left;

  const leftScore = severityScore(left.severity);
  const rightScore = severityScore(right.severity);
  if (leftScore !== rightScore) return leftScore < rightScore ? left : right;

  const leftIsExpiry = left.alert_type === EXPIRY_ALERT_TYPE;
  const rightIsExpiry = right.alert_type === EXPIRY_ALERT_TYPE;
  if (leftIsExpiry !== rightIsExpiry) return leftIsExpiry ? left : right;

  return left;
}

function mergeAlertEntries(alertEntries) {
  if (alertEntries.length === 0) return null;
  if (alertEntries.length === 1) return alertEntries[0];

  const preferred = alertEntries.reduce(preferAlert);
  const severity = alertEntries.some((entry) => entry.severity === "Critical") ? "Critical" : "Warning";
  const alertMessage = Array.from(new Set(alertEntries.map((entry) => entry.alert_message).filter(Boolean))).join(" | ");

  return {
    ...preferred,
    severity,
    alert_message: alertMessage || preferred.alert_message,
  };
}

function buildStockAlertCandidate(stock) {
  if (Number(stock.total_stock || 0) <= 0) {
    return {
      type: "critical_stock",
      domain: "inventory",
      severity: "Critical",
      title: `${stock.medication_name} stock is critical`,
      message: formatStockAlertMessage(stock.medication_name, stock.total_stock, stock.reorder_threshold, stock.unit),
      source_entity_type: "medication",
      source_entity_id: String(stock.medication_id),
      action_type: "review",
      action_ref: `/pharmacy/inventory?focusMedicationId=${encodeURIComponent(`I-${String(stock.medication_id).padStart(3, "0")}`)}`,
      signature: `${stock.medication_id}:critical_stock`,
      alert_type: STOCK_ALERT_TYPE,
      batch_id: stock.batch_id || null,
    };
  }

  if (Number(stock.total_stock || 0) < Number(stock.reorder_threshold || 0)) {
    return {
      type: "low_stock",
      domain: "inventory",
      severity: "Warning",
      title: `${stock.medication_name} stock is low`,
      message: formatStockAlertMessage(stock.medication_name, stock.total_stock, stock.reorder_threshold, stock.unit),
      source_entity_type: "medication",
      source_entity_id: String(stock.medication_id),
      action_type: "review",
      action_ref: `/pharmacy/restock`,
      signature: `${stock.medication_id}:low_stock`,
      alert_type: STOCK_ALERT_TYPE,
      batch_id: stock.batch_id || null,
    };
  }

  return null;
}

function buildExpiryAlertCandidate(stock) {
  if (!stock.batch_id || !stock.expiry_date || Number(stock.batch_quantity || 0) <= 0 || stock.expiry_status === "Valid" || stock.expiry_status === "N/A") return null;

  const isExpired = stock.expiry_status === "Expired";
  return {
    type: isExpired ? "expired" : "near_expiry",
    domain: "expiry",
    severity: isExpired ? "Critical" : "Warning",
    title: isExpired ? `${stock.medication_name} batch expired` : `${stock.medication_name} expires soon`,
    message: formatExpiryAlertMessage(stock),
    source_entity_type: "batch",
    source_entity_id: String(stock.batch_id),
    action_type: "review",
    action_ref: `/pharmacy/inventory?focusMedicationId=${encodeURIComponent(`I-${String(stock.medication_id).padStart(3, "0")}`)}`,
    signature: `${stock.batch_id}:${isExpired ? "expired" : "near_expiry"}`,
    alert_type: EXPIRY_ALERT_TYPE,
    batch_id: stock.batch_id,
  };
}

function buildAlertCandidates(stock) {
  return [buildStockAlertCandidate(stock), buildExpiryAlertCandidate(stock)].filter(Boolean);
}

async function syncAndListInventoryAlerts() {
  const stocks = await listMedicationStocks();
  const activeStocks = stocks.filter((stock) => buildAlertCandidates(stock).length > 0);

  const { data: unresolvedRows, error: unresolvedError } = await supabase
    .from("tbl_inventory_alerts")
    .select("alert_id, medication_id, batch_id, alert_type, severity, alert_message, triggered_at")
    .eq("is_resolved", false)
    .in("alert_type", [STOCK_ALERT_TYPE, EXPIRY_ALERT_TYPE]);
  if (unresolvedError) throw unresolvedError;

  const unresolvedByKey = new Map((unresolvedRows || []).map((row) => [getPersistedAlertKey(row), row]));
  const activeKeys = new Set();
  const pendingInsertKeys = new Set();
  const resolveIds = [];
  const updateRows = [];
  const insertRows = [];

  activeStocks.forEach((stock) => {
    const candidates = buildAlertCandidates(stock);
    candidates.forEach((candidate) => {
      const key = getActiveAlertKey(stock.batch_id, stock.medication_id, candidate.alert_type);
      activeKeys.add(key);
      const existing = unresolvedByKey.get(key);
      if (!existing) {
        if (!stock.batch_id) {
          return;
        }
        if (pendingInsertKeys.has(key)) {
          return;
        }
        pendingInsertKeys.add(key);
        insertRows.push({
          medication_id: stock.medication_id,
          batch_id: stock.batch_id,
          alert_type: candidate.alert_type,
          severity: candidate.severity,
          alert_message: candidate.message,
          is_resolved: false,
        });
        return;
      }

      if (existing.severity !== candidate.severity || existing.alert_message !== candidate.message) {
        updateRows.push({
          alert_id: existing.alert_id,
          severity: candidate.severity,
          alert_message: candidate.message,
        });
      }
    });
  });

  (unresolvedRows || []).forEach((row) => {
    const key = getPersistedAlertKey(row);
    if (!activeKeys.has(key)) {
      resolveIds.push(row.alert_id);
    }
  });

  if (insertRows.length > 0) {
    const { error } = await supabase.from("tbl_inventory_alerts").insert(insertRows);
    if (error && String(error.code || "") !== "23505") {
      throw error;
    }
  }

  for (const row of updateRows) {
    const { error } = await supabase
      .from("tbl_inventory_alerts")
      .update({
        severity: row.severity,
        alert_message: row.alert_message,
      })
      .eq("alert_id", row.alert_id);
    if (error) throw error;
  }

  if (resolveIds.length > 0) {
    const { error } = await supabase
      .from("tbl_inventory_alerts")
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .in("alert_id", resolveIds);
    if (error) throw error;
  }

  const { data: finalRows, error: finalError } = await supabase
    .from("tbl_inventory_alerts")
    .select("alert_id, medication_id, batch_id, alert_type, severity, alert_message, triggered_at, is_resolved")
    .eq("is_resolved", false)
    .in("alert_type", [STOCK_ALERT_TYPE, EXPIRY_ALERT_TYPE]);
  if (finalError) throw finalError;

  const finalByKey = new Map((finalRows || []).map((row) => [getPersistedAlertKey(row), row]));

  return activeStocks
    .map((stock) => {
      const stockCandidate = buildStockAlertCandidate(stock);
      const expiryCandidate = buildExpiryAlertCandidate(stock);
      const alerts = [];

      if (stockCandidate) {
        alerts.push(toUiAlert(stock, finalByKey.get(getActiveAlertKey(stock.batch_id, stock.medication_id, stockCandidate.alert_type))));
      }

      if (expiryCandidate) {
        alerts.push({
          alert_id: finalByKey.get(toKey("batch", stock.batch_id, expiryCandidate.alert_type))?.alert_id || null,
          medication_id: stock.medication_id,
          medication_key: `I-${String(stock.medication_id).padStart(3, "0")}`,
          medication_name: stock.medication_name,
          category_name: stock.category_name,
          batch_id: stock.batch_id,
          expiry_date: stock.expiry_date,
          total_stock: stock.total_stock,
          reorder_threshold: stock.reorder_threshold,
          unit: stock.unit,
          severity: expiryCandidate.severity,
          alert_type: expiryCandidate.alert_type,
          alert_message: expiryCandidate.message,
          triggered_at: finalByKey.get(toKey("batch", stock.batch_id, expiryCandidate.alert_type))?.triggered_at || new Date().toISOString(),
          is_resolved: false,
        });
      }

      return mergeAlertEntries(alerts);
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "Critical" ? -1 : 1;
      return a.total_stock - b.total_stock;
    });
}

async function resolveInventoryAlert(alertId, actorId = null) {
  const { data: alertRow, error: alertReadError } = await supabase
    .from("tbl_inventory_alerts")
    .select("alert_id, medication_id, batch_id, alert_type, severity, alert_message")
    .eq("alert_id", alertId)
    .maybeSingle();
  if (alertReadError) throw alertReadError;

  const { error } = await supabase
    .from("tbl_inventory_alerts")
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq("alert_id", alertId);
  if (error) throw error;

  if (alertRow?.medication_id) {
    const isExpiryAlert = String(alertRow.alert_type || "").toLowerCase() === "expiry risk" || alertRow.batch_id != null;
    await resolveNotificationBySource({
      sourceEntityType: isExpiryAlert ? "batch" : "medication",
      sourceEntityId: isExpiryAlert ? (alertRow.batch_id || alertRow.medication_id) : alertRow.medication_id,
      actorId,
      notificationTypes: isExpiryAlert ? ["near_expiry", "expired"] : ["critical_stock", "low_stock"],
      nextType: "alert_resolved",
      title: "Inventory alert resolved",
      message: alertRow.alert_message || "An inventory alert was resolved.",
      severity: alertRow.severity === "Critical" ? "Critical" : "Warning",
      domain: "inventory",
      metadata: {
        alert_id: alertRow.alert_id,
        batch_id: alertRow.batch_id || null,
        alert_type: alertRow.alert_type || null,
        signature: `alert:${alertRow.alert_id}`,
      },
      actionType: "resolve",
      actionRef: "/pharmacy/inventory",
    });
  }
}

export { syncAndListInventoryAlerts, resolveInventoryAlert };
