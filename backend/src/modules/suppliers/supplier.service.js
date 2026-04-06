import { supabase } from "../../lib/supabase.js";

function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toSupplierStatus(value) {
  const normalized = toTrimmedString(value);
  if (normalized === "Preferred" || normalized === "Active" || normalized === "Review") {
    return normalized;
  }
  return "Active";
}

export async function getSuppliers() {
  const { data, error } = await supabase
    .from("tbl_suppliers")
    .select(`
      supplier_id,
      supplier_name,
      email_address,
      contact_number,
      address,
      is_preferred,
      status,
      supplier_image,
      created_at,
      updated_at
    `)
    .order("supplier_id", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createSupplier(payload) {
  const supplierName = toTrimmedString(payload?.supplier_name);
  const emailAddress = toTrimmedString(payload?.email_address) || null;
  const contactNumber = toTrimmedString(payload?.contact_number) || null;
  const address = toTrimmedString(payload?.address) || null;
  const supplierImage = toTrimmedString(payload?.supplier_image) || null;
  const status = toSupplierStatus(payload?.status);
  const isPreferred = status === "Preferred";

  if (!supplierName) {
    throw new Error("'supplier_name' is required.");
  }

  const { data, error } = await supabase
    .from("tbl_suppliers")
    .insert({
      supplier_name: supplierName,
      email_address: emailAddress,
      contact_number: contactNumber,
      address,
      status,
      is_preferred: isPreferred,
      supplier_image: supplierImage,
      updated_at: new Date().toISOString(),
    })
    .select(`
      supplier_id,
      supplier_name,
      email_address,
      contact_number,
      address,
      is_preferred,
      status,
      supplier_image,
      created_at,
      updated_at
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateSupplier(id, payload) {
  const supplierId = Number(id);
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new Error("'id' must be a positive integer.");
  }

  const supplierName = toTrimmedString(payload?.supplier_name);
  const emailAddress = toTrimmedString(payload?.email_address) || null;
  const contactNumber = toTrimmedString(payload?.contact_number) || null;
  const address = toTrimmedString(payload?.address) || null;
  const supplierImage = toTrimmedString(payload?.supplier_image) || null;
  const status = toSupplierStatus(payload?.status);
  const isPreferred = status === "Preferred";

  if (!supplierName) {
    throw new Error("'supplier_name' is required.");
  }

  const { data, error } = await supabase
    .from("tbl_suppliers")
    .update({
      supplier_name: supplierName,
      email_address: emailAddress,
      contact_number: contactNumber,
      address,
      status,
      is_preferred: isPreferred,
      supplier_image: supplierImage,
      updated_at: new Date().toISOString(),
    })
    .eq("supplier_id", supplierId)
    .select(`
      supplier_id,
      supplier_name,
      email_address,
      contact_number,
      address,
      is_preferred,
      status,
      supplier_image,
      created_at,
      updated_at
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSupplier(id) {
  const supplierId = Number(id);
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new Error("'id' must be a positive integer.");
  }

  const { error } = await supabase
    .from("tbl_suppliers")
    .delete()
    .eq("supplier_id", supplierId);
  if (error) throw error;
}

export async function getSupplierProcurementInsights(id) {
  const supplierId = Number(id);
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new Error("'id' must be a positive integer.");
  }

  const { data: supplierRow, error: supplierError } = await supabase
    .from("tbl_suppliers")
    .select("supplier_id")
    .eq("supplier_id", supplierId)
    .maybeSingle();
  if (supplierError) throw supplierError;
  if (!supplierRow?.supplier_id) {
    throw new Error("Supplier not found.");
  }

  const { data: requestRows, error: requestError } = await supabase
    .from("tbl_restock_requests")
    .select(`
      request_id,
      medication_id,
      requested_on,
      status,
      tbl_medications(
        medication_name
      )
    `)
    .eq("supplier_id", supplierId)
    .order("requested_on", { ascending: false })
    .order("request_id", { ascending: false })
    .limit(200);
  if (requestError) throw requestError;

  const medicationCounts = new Map();
  for (const row of requestRows || []) {
    const medicationName = row.tbl_medications?.medication_name || `Medication #${row.medication_id}`;
    medicationCounts.set(medicationName, (medicationCounts.get(medicationName) || 0) + 1);
  }

  const frequentMedications = Array.from(medicationCounts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 4)
    .map(([medication_name, supply_count]) => ({ medication_name, supply_count }));

  const recentProcurements = (requestRows || [])
    .slice(0, 7)
    .map((row) => ({
      date: row.requested_on || null,
      medication_name: row.tbl_medications?.medication_name || `Medication #${row.medication_id}`,
      status: row.status || "Pending",
    }));

  return {
    frequent_medications: frequentMedications,
    recent_procurements: recentProcurements,
  };
}
