import { supabase } from "../lib/supabase.js";
import { listMedicationStocks } from "./medicationService.js";
import { resolveNotificationBySource } from "./notificationService.js";

const STOCK_ALERT_TYPE = "Stock Risk";
const EXPIRATION_ALERT_TYPE = "Expiration Risk";
const LEGACY_EXPIRY_ALERT_TYPE = "Expiry Risk";
const SUPPORTED_ALERT_TYPES = [STOCK_ALERT_TYPE, EXPIRATION_ALERT_TYPE, LEGACY_EXPIRY_ALERT_TYPE];

function normalizeAlertType(alertType) {
  const value = String(alertType || "").trim().toLowerCase();
  if (value === "expiry risk" || value === "expiration risk") return EXPIRATION_ALERT_TYPE;
  return STOCK_ALERT_TYPE;
}

function toKey(sourceType, sourceId, alertType) {
  return `${sourceType}:${sourceId}:${alertType}`;
}

function getPersistedAlertKey(row) {
  const normalizedType = normalizeAlertType(row.alert_type);
  if (row.batch_id) {
    return toKey("batch", row.batch_id, normalizedType);
  }
  return toKey("medication", row.medication_id, normalizedType);
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

function getRiskModeLabel(alertType, severity) {
  const normalizedType = normalizeAlertType(alertType);
  if (normalizedType === STOCK_ALERT_TYPE) {
    return severity === "Critical" ? "Out of Stock" : "Low Stock";
  }
  return severity === "Critical" ? "Expired" : "Near Expiry";
}

function toUiAlert(stock, persistedAlert, fallbackAlertType, fallbackSeverity, fallbackMessage) {
  const alertType = normalizeAlertType(persistedAlert?.alert_type || fallbackAlertType);
  const severity = persistedAlert?.severity || fallbackSeverity;
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
    alert_type: alertType,
    risk_mode: getRiskModeLabel(alertType, severity),
    alert_message: persistedAlert?.alert_message || fallbackMessage,
    triggered_at: persistedAlert?.triggered_at || new Date().toISOString(),
    is_resolved: false,
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
    alert_type: EXPIRATION_ALERT_TYPE,
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
    .in("alert_type", SUPPORTED_ALERT_TYPES);
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
    .in("alert_type", SUPPORTED_ALERT_TYPES);
  if (finalError) throw finalError;

  const finalByKey = new Map((finalRows || []).map((row) => [getPersistedAlertKey(row), row]));

  return activeStocks
    .flatMap((stock) => {
      const stockCandidate = buildStockAlertCandidate(stock);
      const expiryCandidate = buildExpiryAlertCandidate(stock);
      const alerts = [];

      if (stockCandidate) {
        const stockPersisted =
          finalByKey.get(getActiveAlertKey(stock.batch_id, stock.medication_id, stockCandidate.alert_type)) ||
          finalByKey.get(getActiveAlertKey(stock.batch_id, stock.medication_id, STOCK_ALERT_TYPE));
        alerts.push(
          toUiAlert(
            stock,
            stockPersisted,
            stockCandidate.alert_type,
            stockCandidate.severity,
            stockCandidate.message,
          ),
        );
      }

      if (expiryCandidate) {
        const expiryPersisted =
          finalByKey.get(toKey("batch", stock.batch_id, EXPIRATION_ALERT_TYPE)) ||
          finalByKey.get(toKey("batch", stock.batch_id, LEGACY_EXPIRY_ALERT_TYPE));
        alerts.push(
          toUiAlert(
            stock,
            expiryPersisted,
            expiryCandidate.alert_type,
            expiryCandidate.severity,
            expiryCandidate.message,
          ),
        );
      }

      return alerts;
    })
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "Critical" ? -1 : 1;
      if (normalizeAlertType(a.alert_type) !== normalizeAlertType(b.alert_type)) {
        return normalizeAlertType(a.alert_type) === STOCK_ALERT_TYPE ? -1 : 1;
      }
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
    const isExpiryAlert = normalizeAlertType(alertRow.alert_type) === EXPIRATION_ALERT_TYPE || alertRow.batch_id != null;
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
