import { supabase } from "../lib/supabase.js";
import { listMedicationStocks } from "./medicationService.js";

const ALERT_TYPE = "Stock Risk";

function computeSeverity(stock, status) {
  return stock <= 0 || status === "Critical" ? "Critical" : "Warning";
}

function toKey(medicationId, batchId) {
  return `${medicationId}:${batchId}:${ALERT_TYPE}`;
}

function formatAlertMessage(medicationName, stock, reorder, unit) {
  return `${medicationName} stock is ${stock} ${unit}; reorder threshold is ${reorder} ${unit}.`;
}

function toUiAlert(stock, persistedAlert) {
  const severity = computeSeverity(stock.total_stock, stock.status);
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
    alert_type: ALERT_TYPE,
    alert_message: persistedAlert?.alert_message || formatAlertMessage(stock.medication_name, stock.total_stock, stock.reorder_threshold, stock.unit),
    triggered_at: persistedAlert?.triggered_at || new Date().toISOString(),
    is_resolved: false,
  };
}

async function syncAndListInventoryAlerts() {
  const stocks = await listMedicationStocks();
  const activeStocks = stocks.filter((stock) => stock.total_stock < stock.reorder_threshold || stock.status === "Critical");

  const { data: unresolvedRows, error: unresolvedError } = await supabase
    .from("tbl_inventory_alerts")
    .select("alert_id, medication_id, batch_id, alert_type, severity, alert_message, triggered_at")
    .eq("is_resolved", false)
    .eq("alert_type", ALERT_TYPE);
  if (unresolvedError) throw unresolvedError;

  const unresolvedByKey = new Map((unresolvedRows || []).map((row) => [toKey(row.medication_id, row.batch_id), row]));
  const activeKeys = new Set();
  const resolveIds = [];
  const updateRows = [];
  const insertRows = [];

  activeStocks.forEach((stock) => {
    if (!stock.batch_id) return;
    const key = toKey(stock.medication_id, stock.batch_id);
    activeKeys.add(key);
    const severity = computeSeverity(stock.total_stock, stock.status);
    const nextMessage = formatAlertMessage(stock.medication_name, stock.total_stock, stock.reorder_threshold, stock.unit);
    const existing = unresolvedByKey.get(key);
    if (!existing) {
      insertRows.push({
        medication_id: stock.medication_id,
        batch_id: stock.batch_id,
        alert_type: ALERT_TYPE,
        severity,
        alert_message: nextMessage,
        is_resolved: false,
      });
      return;
    }

    if (existing.severity !== severity || existing.alert_message !== nextMessage) {
      updateRows.push({
        alert_id: existing.alert_id,
        severity,
        alert_message: nextMessage,
      });
    }
  });

  (unresolvedRows || []).forEach((row) => {
    const key = toKey(row.medication_id, row.batch_id);
    if (!activeKeys.has(key)) {
      resolveIds.push(row.alert_id);
    }
  });

  if (insertRows.length > 0) {
    const { error } = await supabase.from("tbl_inventory_alerts").insert(insertRows);
    if (error) throw error;
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
    .eq("alert_type", ALERT_TYPE);
  if (finalError) throw finalError;

  const finalByKey = new Map((finalRows || []).map((row) => [toKey(row.medication_id, row.batch_id), row]));

  return activeStocks
    .map((stock) => {
      if (!stock.batch_id) return toUiAlert(stock, null);
      return toUiAlert(stock, finalByKey.get(toKey(stock.medication_id, stock.batch_id)));
    })
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "Critical" ? -1 : 1;
      return a.total_stock - b.total_stock;
    });
}

async function resolveInventoryAlert(alertId) {
  const { error } = await supabase
    .from("tbl_inventory_alerts")
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq("alert_id", alertId);
  if (error) throw error;
}

export { syncAndListInventoryAlerts, resolveInventoryAlert };
