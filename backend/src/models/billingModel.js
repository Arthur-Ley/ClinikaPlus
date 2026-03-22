import { supabase } from "../lib/supabase.js";

const BILL_SELECT = [
  "bill_id",
  "bill_code",
  "patient_id",
  "total_amount",
  "net_amount",
  "status",
  "subtotal_medications",
  "subtotal_laboratory",
  "subtotal_miscellaneous",
  "subtotal_room_charge",
  "subtotal_professional_fee",
  "discount_type",
  "discount_rate",
  "discount_amount",
  "insurance_coverage",
  "is_senior_citizen",
  "is_pwd",
  "admission_datetime",
  "discharge_datetime",
  "referred_by",
  "discharge_status",
  "created_at",
  "tbl_patients(*)",
].join(", ");

const BILL_ITEM_SELECT = [
  "bill_item_id",
  "bill_id",
  "service_id",
  "medication_id",
  "log_id",
  "service_type",
  "source",
  "description",
  "quantity",
  "unit_price",
  "subtotal",
  "created_at",
].join(", ");

async function getNextCode(tableName, codeColumn, prefix) {
  const { data, error } = await supabase
    .from(tableName)
    .select(codeColumn)
    .order(codeColumn, { ascending: false })
    .limit(1);

  if (error) throw error;

  const latestCode = data?.[0]?.[codeColumn] || `${prefix}-00000`;
  const latestNumber = Number(String(latestCode).split("-")[1] || 0);
  const nextNumber = latestNumber + 1;

  return `${prefix}-${String(nextNumber).padStart(5, "0")}`;
}

async function createBill(row) {
  const { data, error } = await supabase
    .from("tbl_bills")
    .insert(row)
    .select(BILL_SELECT)
    .single();

  if (error) throw error;
  return data;
}

async function updateBillById(billId, updates) {
  const { data, error } = await supabase
    .from("tbl_bills")
    .update(updates)
    .eq("bill_id", billId)
    .select(BILL_SELECT)
    .single();

  if (error) throw error;
  return data;
}

async function getBillById(billId) {
  const { data, error } = await supabase
    .from("tbl_bills")
    .select(BILL_SELECT)
    .eq("bill_id", billId)
    .single();

  if (error) throw error;
  return data;
}

async function listBills({ status, page, pageSize }) {
  let query = supabase
    .from("tbl_bills")
    .select(BILL_SELECT, {
      count: "exact",
    })
    .order("bill_id", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    rows: data || [],
    total: count || 0,
  };
}

async function listBillsFiltered({ status, page, pageSize, billIds }) {
  if (Array.isArray(billIds) && billIds.length === 0) {
    return { rows: [], total: 0 };
  }

  let query = supabase
    .from("tbl_bills")
    .select("bill_id, bill_code, patient_id, total_amount, discount_amount, insurance_coverage, net_amount, status, tbl_patients(*), tbl_payments(payment_id, amount_paid, payment_date, payment_method)", {
      count: "exact",
    })
    .order("bill_id", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (Array.isArray(billIds)) {
    query = query.in("bill_id", billIds);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    rows: data || [],
    total: count || 0,
  };
}

async function createBillItems(rows) {
  const { data, error } = await supabase
    .from("tbl_bill_items")
    .insert(rows)
    .select(BILL_ITEM_SELECT);

  if (error) throw error;
  return data || [];
}

async function createBillItem(row) {
  const { data, error } = await supabase
    .from("tbl_bill_items")
    .insert(row)
    .select(BILL_ITEM_SELECT)
    .single();

  if (error) throw error;
  return data;
}

async function getBillItemById(billItemId) {
  const { data, error } = await supabase
    .from("tbl_bill_items")
    .select(BILL_ITEM_SELECT)
    .eq("bill_item_id", billItemId)
    .single();

  if (error) throw error;
  return data;
}

async function updateBillItemById(billItemId, updates) {
  const { data, error } = await supabase
    .from("tbl_bill_items")
    .update(updates)
    .eq("bill_item_id", billItemId)
    .select(BILL_ITEM_SELECT)
    .single();

  if (error) throw error;
  return data;
}

async function deleteBillItemById(billItemId) {
  const { error } = await supabase.from("tbl_bill_items").delete().eq("bill_item_id", billItemId);
  if (error) throw error;
}

async function getBillItemsByBillId(billId) {
  const { data, error } = await supabase
    .from("tbl_bill_items")
    .select(BILL_ITEM_SELECT)
    .eq("bill_id", billId)
    .order("bill_item_id", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function deleteBillById(billId) {
  const { error } = await supabase.from("tbl_bills").delete().eq("bill_id", billId);
  if (error) throw error;
}

async function deleteBillItemsByBillId(billId) {
  const { error } = await supabase.from("tbl_bill_items").delete().eq("bill_id", billId);
  if (error) throw error;
}

async function createPayment(row) {
  const { data, error } = await supabase
    .from("tbl_payments")
    .insert(row)
    .select(
      "payment_id, payment_code, bill_id, payment_method, amount_paid, reference_number, payment_date, received_by, notes, created_at"
    )
    .single();

  if (error) throw error;
  return data;
}

async function deletePaymentById(paymentId) {
  const { error } = await supabase.from("tbl_payments").delete().eq("payment_id", paymentId);
  if (error) throw error;
}

async function getPaymentsByBillId(billId) {
  const { data, error } = await supabase
    .from("tbl_payments")
    .select(
      "payment_id, payment_code, bill_id, payment_method, amount_paid, reference_number, payment_date, received_by, notes, created_at"
    )
    .eq("bill_id", billId)
    .order("payment_date", { ascending: true })
    .order("payment_id", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function hasAnyPayment(billId) {
  const { count, error } = await supabase
    .from("tbl_payments")
    .select("payment_id", { head: true, count: "exact" })
    .eq("bill_id", billId);

  if (error) throw error;
  return (count || 0) > 0;
}

async function listPaymentsForBills(billIds) {
  if (!billIds.length) return [];

  const { data, error } = await supabase
    .from("tbl_payments")
    .select("payment_id, bill_id, amount_paid, payment_date")
    .in("bill_id", billIds)
    .order("payment_date", { ascending: true })
    .order("payment_id", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchAnalyticsBills() {
  const { data, error } = await supabase
    .from("tbl_bills")
    .select("bill_id, net_amount, total_amount, status");

  if (error) throw error;
  return data || [];
}

async function fetchAnalyticsPayments() {
  const { data, error } = await supabase
    .from("tbl_payments")
    .select("payment_id, bill_id, amount_paid, payment_date, payment_method");

  if (error) throw error;
  return data || [];
}

async function fetchPaymentsWithBillContext() {
  const { data, error } = await supabase
    .from("tbl_payments")
    .select(`
      payment_id,
      payment_code,
      bill_id,
      payment_method,
      amount_paid,
      reference_number,
      payment_date,
      received_by,
      notes,
      created_at,
      tbl_bills (
        bill_id,
        bill_code,
        patient_id,
        status,
        net_amount,
        total_amount,
        created_at,
        tbl_patients (*)
      )
    `)
    .order("payment_date", { ascending: false })
    .order("payment_id", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchBillItemsForReports() {
  const { data, error } = await supabase
    .from("tbl_bill_items")
    .select(`
      bill_item_id,
      bill_id,
      service_id,
      medication_id,
      log_id,
      description,
      quantity,
      unit_price,
      subtotal,
      created_at,
      tbl_bills (
        bill_id,
        status
      ),
      tbl_medications (
        medication_id,
        medication_name
      )
    `)
    .order("created_at", { ascending: false })
    .order("bill_item_id", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function getInventoryByMedicationId(medicationId) {
  const { data, error } = await supabase
    .from("tbl_inventory")
    .select("inventory_id, medication_id, total_stock, status, last_updated")
    .eq("medication_id", medicationId)
    .single();

  if (error) throw error;
  return data;
}

async function getMedicationById(medicationId) {
  const { data, error } = await supabase
    .from("tbl_medications")
    .select("medication_id, reorder_threshold")
    .eq("medication_id", medicationId)
    .single();

  if (error) throw error;
  return data;
}

async function updateInventoryByMedicationId(medicationId, updates) {
  const { data, error } = await supabase
    .from("tbl_inventory")
    .update(updates)
    .eq("medication_id", medicationId)
    .select("inventory_id, medication_id, total_stock, status, last_updated")
    .single();

  if (error) throw error;
  return data;
}

async function listBillIdsByItemDateRange(startIso, endIso) {
  let query = supabase.from("tbl_bill_items").select("bill_id");

  if (startIso) {
    query = query.gte("created_at", startIso);
  }

  if (endIso) {
    query = query.lte("created_at", endIso);
  }

  const { data, error } = await query;
  if (error) throw error;

  return Array.from(new Set((data || []).map((row) => row.bill_id)));
}

async function hasPatientById(patientId) {
  const { count, error } = await supabase
    .from("tbl_patients")
    .select("patient_id", { head: true, count: "exact" })
    .eq("patient_id", patientId);

  if (error) throw error;
  return (count || 0) > 0;
}

export {
  createBill,
  createBillItem,
  createBillItems,
  createPayment,
  deleteBillById,
  deleteBillItemById,
  deleteBillItemsByBillId,
  deletePaymentById,
  fetchAnalyticsBills,
  fetchAnalyticsPayments,
  fetchBillItemsForReports,
  fetchPaymentsWithBillContext,
  getBillById,
  getBillItemById,
  getBillItemsByBillId,
  getInventoryByMedicationId,
  getMedicationById,
  getNextCode,
  getPaymentsByBillId,
  hasAnyPayment,
  listBills,
  listBillsFiltered,
  listBillIdsByItemDateRange,
  listPaymentsForBills,
  hasPatientById,
  updateInventoryByMedicationId,
  updateBillById,
  updateBillItemById,
};
