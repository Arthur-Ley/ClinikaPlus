import { supabase } from "../lib/supabase.js";
import { getBillingAnalyticsFlow } from "./billingService.js";
import { syncAndListInventoryAlerts } from "./inventoryAlertService.js";
import { listMedicationStocks } from "./medicationService.js";
import { listRestockRequests } from "./restockRequestService.js";
import { getAllClaims } from "./insuranceClaim.service.js";

function toStartOfDayIso(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function toNextDayIso(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + 1);
  return copy.toISOString();
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatExpiryLabel(expiryDate) {
  const days = daysUntil(expiryDate);
  if (days === null) return "N/A";
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  return `${days} days`;
}

function statusRank(status) {
  if (status === "Critical") return 0;
  if (status === "Low") return 1;
  return 2;
}

async function getRevenueToday() {
  const { data, error } = await supabase
    .from("tbl_payments")
    .select("amount_paid, payment_date")
    .gte("payment_date", toStartOfDayIso())
    .lt("payment_date", toNextDayIso());

  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
}

async function getPendingPaymentsCount() {
  const { count, error } = await supabase
    .from("tbl_bills")
    .select("bill_id", { head: true, count: "exact" })
    .in("status", ["Pending", "Partially Paid"]);

  if (error) throw error;
  return count || 0;
}

async function getTotalTransactionsCount() {
  const { count, error } = await supabase
    .from("tbl_payments")
    .select("payment_id", { head: true, count: "exact" });

  if (error) throw error;
  return count || 0;
}

function computeInsuranceInProgressCount(claimRows) {
  return (claimRows || []).filter((claim) => {
    const status = String(claim?.status || "");
    return status === "Pending" || status === "Submitted" || status === "Approved";
  }).length;
}

function computeSuggestedOrders(stocks) {
  return (stocks || [])
    .filter((row) => Number(row.total_stock || 0) < Number(row.reorder_threshold || 0))
    .sort((a, b) => Number(a.total_stock || 0) - Number(b.total_stock || 0))
    .slice(0, 4)
    .map((row) => ({
      medication_name: row.medication_name,
      quantity: Math.max(Number(row.reorder_threshold || 0) - Number(row.total_stock || 0), Number(row.reorder_threshold || 0)),
      unit: row.unit,
    }));
}

export async function getOverviewData() {
  const [stocksResult, alertsResult, restockResult, billingResult, claimsResult, revenueTodayResult, pendingPaymentsResult, totalTransactionsResult] =
    await Promise.allSettled([
      listMedicationStocks(),
      syncAndListInventoryAlerts(),
      listRestockRequests(),
      getBillingAnalyticsFlow(),
      getAllClaims(),
      getRevenueToday(),
      getPendingPaymentsCount(),
      getTotalTransactionsCount(),
    ]);

  const stocks = stocksResult.status === "fulfilled" ? stocksResult.value : [];
  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
  const restockRequests = restockResult.status === "fulfilled" ? restockResult.value : [];
  const billing = billingResult.status === "fulfilled" ? billingResult.value : {};
  const claims = claimsResult.status === "fulfilled" ? claimsResult.value : [];
  const revenueToday = revenueTodayResult.status === "fulfilled" ? revenueTodayResult.value : 0;
  const pendingPayments = pendingPaymentsResult.status === "fulfilled" ? pendingPaymentsResult.value : 0;
  const totalTransactions = totalTransactionsResult.status === "fulfilled" ? totalTransactionsResult.value : 0;

  const criticalAlerts = alerts.filter((item) => item.severity === "Critical");
  const warningAlerts = alerts.filter((item) => item.severity !== "Critical");

  const overallSystemRisk = criticalAlerts.length > 0 ? "Critical" : warningAlerts.length > 0 ? "Warning" : "Stable";
  const inventoryStability = criticalAlerts.length > 0 || warningAlerts.length > 0 ? "At Risk" : "Stable";
  const cashFlowCondition = Number(billing.total_outstanding_balance || 0) > 0 ? "At Risk" : "Stable";

  const inventoryHighlights = stocks
    .slice()
    .sort((a, b) => {
      const byStatus = statusRank(a.status) - statusRank(b.status);
      if (byStatus !== 0) return byStatus;
      return Number(a.total_stock || 0) - Number(b.total_stock || 0);
    })
    .slice(0, 5)
    .map((row) => ({
      medication_name: row.medication_name,
      stock: Number(row.total_stock || 0),
      unit: row.unit,
      status: row.status,
      expiry_date: row.expiry_date,
      expiry_label: formatExpiryLabel(row.expiry_date),
    }));

  const nearExpiryBatches = stocks.filter((row) => {
    const days = daysUntil(row.expiry_date);
    return days !== null && days >= 0 && days <= 30;
  }).length;

  const alertCards = alerts.slice(0, 4).map((alert) => ({
    title: alert.severity === "Critical" ? "Critical:" : "Warning:",
    message: alert.alert_message,
    tone: alert.severity === "Critical" ? "critical" : "warning",
  }));

  const pendingRestocks = restockRequests
    .filter((request) => request.status === "Pending")
    .sort((a, b) => {
      const left = new Date(a.requested_on || a.created_at || 0).getTime();
      const right = new Date(b.requested_on || b.created_at || 0).getTime();
      return left - right;
    });

  const nextSupply = pendingRestocks[0]
    ? {
        supplier_name: pendingRestocks[0].supplier_name || "N/A",
        date: pendingRestocks[0].requested_on || pendingRestocks[0].created_at || null,
      }
    : null;

  return {
    summary: {
      overall_system_risk: overallSystemRisk,
      high_priority_issues: criticalAlerts.length,
      inventory_stability: inventoryStability,
      cash_flow_condition: cashFlowCondition,
      outstanding_balance: Number(billing.total_outstanding_balance || 0),
    },
    alerts: alertCards,
    inventory_highlights: inventoryHighlights,
    near_expiry_batches: nearExpiryBatches,
    restocking_overview: {
      suggested_orders: computeSuggestedOrders(stocks),
      next_supply_delivery: nextSupply,
    },
    financial_summary: {
      revenue_today: Number(revenueToday || 0),
      pending_payments: Number(pendingPayments || 0),
      total_transactions: Number(totalTransactions || 0),
      insurance_claims_in_progress: computeInsuranceInProgressCount(claims),
    },
  };
}

