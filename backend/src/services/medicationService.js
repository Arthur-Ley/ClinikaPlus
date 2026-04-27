import { supabase } from "../lib/supabase.js";

const EXPIRY_WARNING_DAYS = 30;

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const diffMs = target.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getExpiryStatus(expiryDate) {
  const days = daysUntil(expiryDate);
  if (days === null) return "N/A";
  if (days < 0) return "Expired";
  if (days <= EXPIRY_WARNING_DAYS) return "Near Expiry";
  return "Valid";
}

function deriveInventoryStatus(totalStock, reorderThreshold) {
  if (totalStock <= 0) return "Critical";
  if (totalStock < reorderThreshold) return "Low";
  return "Adequate";
}

async function listCategories() {
  const { data, error } = await supabase
    .from("tbl_categories")
    .select("category_id, category_name, description")
    .order("category_name", { ascending: true });

  if (error) throw error;
  return data;
}

async function createCategory(input) {
  const { data, error } = await supabase
    .from("tbl_categories")
    .insert({
      category_name: input.categoryName,
      description: input.description,
    })
    .select("category_id, category_name, description")
    .single();

  if (error) throw error;
  return data;
}

async function listSuppliers() {
  const { data, error } = await supabase
    .from("tbl_suppliers")
    .select("supplier_id, supplier_name, status, is_preferred")
    .order("supplier_name", { ascending: true });

  if (error) throw error;
  return data;
}

async function listMedicationStocks() {
  const { data: medicationRows, error: medicationError } = await supabase
    .from("tbl_medications")
    .select(`
      medication_id,
      medication_name,
      form,
      strength,
      storage_requirement,
      unit,
      reorder_threshold,
      tbl_categories(category_id, category_name),
      tbl_inventory(total_stock, status, last_updated)
    `)
    .order("medication_id", { ascending: false });

  if (medicationError) throw medicationError;

  const { data: batchRows, error: batchError } = await supabase
    .from("tbl_batches")
    .select(`
      batch_id,
      medication_id,
      batch_number,
      quantity,
      expiry_date,
      received_date,
      supplier_id,
      tbl_suppliers(supplier_name)
    `)
    .order("received_date", { ascending: false })
    .order("batch_id", { ascending: false });

  if (batchError) throw batchError;

  const latestBatchByMedication = new Map();
  for (const batch of batchRows || []) {
    if (!latestBatchByMedication.has(batch.medication_id)) {
      latestBatchByMedication.set(batch.medication_id, batch);
    }
  }

  return (medicationRows || []).map((medication) => {
    const inventory = medication.tbl_inventory?.[0] || null;
    const batch = latestBatchByMedication.get(medication.medication_id) || null;
    const totalStock = inventory?.total_stock ?? 0;
    const computedStatus = deriveInventoryStatus(totalStock, medication.reorder_threshold);
    const expiryStatus = getExpiryStatus(batch?.expiry_date || null);

    return {
      medication_id: medication.medication_id,
      medication_name: medication.medication_name,
      category_id: medication.tbl_categories?.category_id || null,
      category_name: medication.tbl_categories?.category_name || "Uncategorized",
      form: medication.form,
      strength: medication.strength,
      storage_requirement: medication.storage_requirement,
      unit: medication.unit,
      reorder_threshold: medication.reorder_threshold,
      total_stock: totalStock,
      status: computedStatus,
      last_updated: inventory?.last_updated || null,
      batch_id: batch?.batch_id || null,
      batch_number: batch?.batch_number || null,
      batch_quantity: Number(batch?.quantity || 0),
      expiry_date: batch?.expiry_date || null,
      expiry_status: expiryStatus,
      days_until_expiry: daysUntil(batch?.expiry_date || null),
      is_expired: expiryStatus === "Expired",
      supplier_id: batch?.supplier_id || null,
      supplier_name: batch?.tbl_suppliers?.supplier_name || null,
    };
  });
}

async function disposeExpiredMedicationFlow(medicationId, input) {
  const nowIso = new Date().toISOString();

  const { data: medicationRow, error: medicationError } = await supabase
    .from("tbl_medications")
    .select("medication_id, medication_name, reorder_threshold")
    .eq("medication_id", medicationId)
    .maybeSingle();
  if (medicationError) throw medicationError;
  if (!medicationRow?.medication_id) {
    throw new Error("Medication not found.");
  }

  const { data: latestBatch, error: latestBatchError } = await supabase
    .from("tbl_batches")
    .select("batch_id, medication_id, batch_number, quantity, expiry_date")
    .eq("medication_id", medicationId)
    .order("received_date", { ascending: false })
    .order("batch_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestBatchError) throw latestBatchError;
  if (!latestBatch?.batch_id) {
    throw new Error("No batch found for this medication.");
  }

  const expiryStatus = getExpiryStatus(latestBatch.expiry_date || null);
  if (expiryStatus !== "Expired") {
    throw new Error("Latest batch is not expired.");
  }

  const disposableQty = Number(latestBatch.quantity || 0);
  if (disposableQty <= 0) {
    throw new Error("Expired batch is already disposed.");
  }

  const { error: batchUpdateError } = await supabase
    .from("tbl_batches")
    .update({
      quantity: 0,
    })
    .eq("batch_id", latestBatch.batch_id);
  if (batchUpdateError) throw batchUpdateError;

  const { data: totalsRows, error: totalsError } = await supabase
    .from("tbl_batches")
    .select("quantity")
    .eq("medication_id", medicationId);
  if (totalsError) throw totalsError;

  const nextTotalStock = (totalsRows || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const nextStatus = deriveInventoryStatus(nextTotalStock, Number(medicationRow.reorder_threshold || 0));

  const { data: inventoryRow, error: inventoryReadError } = await supabase
    .from("tbl_inventory")
    .select("inventory_id")
    .eq("medication_id", medicationId)
    .maybeSingle();
  if (inventoryReadError) throw inventoryReadError;

  if (inventoryRow?.inventory_id) {
    const { error: inventoryUpdateError } = await supabase
      .from("tbl_inventory")
      .update({
        total_stock: nextTotalStock,
        status: nextStatus,
        last_updated: nowIso,
      })
      .eq("inventory_id", inventoryRow.inventory_id);
    if (inventoryUpdateError) throw inventoryUpdateError;
  } else {
    const { error: inventoryInsertError } = await supabase
      .from("tbl_inventory")
      .insert({
        medication_id: medicationId,
        total_stock: nextTotalStock,
        status: nextStatus,
        last_updated: nowIso,
      });
    if (inventoryInsertError) throw inventoryInsertError;
  }

  return {
    medication_id: medicationId,
    medication_name: medicationRow.medication_name,
    batch_id: latestBatch.batch_id,
    batch_number: latestBatch.batch_number,
    disposed_quantity: disposableQty,
    remaining_total_stock: nextTotalStock,
    status: nextStatus,
    reason: input.reason,
    disposed_at: nowIso,
  };
}

async function createMedicationFlow(input) {
  const now = new Date().toISOString();
  const receivedDate = now.slice(0, 10);

  const { data: medicationRows, error: medicationError } = await supabase
    .from("tbl_medications")
    .insert({
      medication_name: input.medicationName,
      category_id: input.categoryId,
      form: input.form,
      strength: input.strength,
      storage_requirement: input.storageRequirement,
      unit: input.unit,
      reorder_threshold: input.reorderThreshold,
      created_at: now,
      updated_at: now,
    })
    .select("medication_id, medication_name, category_id, form, strength, storage_requirement, unit, reorder_threshold")
    .single();

  if (medicationError) throw medicationError;

  const medicationId = medicationRows.medication_id;

  const { data: batchRows, error: batchError } = await supabase
    .from("tbl_batches")
    .insert({
      medication_id: medicationId,
      supplier_id: input.supplierId,
      batch_number: input.batchNumber,
      quantity: input.quantity,
      expiry_date: input.expiryDate,
      received_date: receivedDate,
    })
    .select("batch_id, batch_number, quantity, expiry_date, supplier_id")
    .single();

  if (batchError) {
    await supabase.from("tbl_medications").delete().eq("medication_id", medicationId);
    throw batchError;
  }

  const totalStock = input.quantity;
  const inventoryStatus = deriveInventoryStatus(totalStock, input.reorderThreshold);

  const { data: inventoryRows, error: inventoryError } = await supabase
    .from("tbl_inventory")
    .insert({
      medication_id: medicationId,
      total_stock: totalStock,
      status: inventoryStatus,
      last_updated: now,
    })
    .select("inventory_id, medication_id, total_stock, status, last_updated")
    .single();

  if (inventoryError) {
    await supabase.from("tbl_batches").delete().eq("batch_id", batchRows.batch_id);
    await supabase.from("tbl_medications").delete().eq("medication_id", medicationId);
    throw inventoryError;
  }

  return {
    medication: medicationRows,
    batch: batchRows,
    inventory: inventoryRows,
  };
}

async function updateMedicationFlow(medicationId, input) {
  const now = new Date().toISOString();

  let resolvedCategoryId = input.categoryId ?? null;
  if (resolvedCategoryId) {
    const { data: categoryById, error: categoryByIdError } = await supabase
      .from("tbl_categories")
      .select("category_id")
      .eq("category_id", resolvedCategoryId)
      .maybeSingle();
    if (categoryByIdError) throw categoryByIdError;
    if (!categoryById?.category_id) {
      throw new Error("Category not found.");
    }
  } else {
    const { data: categoryRow, error: categoryError } = await supabase
      .from("tbl_categories")
      .select("category_id")
      .ilike("category_name", input.categoryName)
      .maybeSingle();
    if (categoryError) throw categoryError;
    if (!categoryRow?.category_id) {
      throw new Error("Category not found.");
    }
    resolvedCategoryId = categoryRow.category_id;
  }

  let resolvedSupplierId = input.supplierId ?? null;
  if (resolvedSupplierId) {
    const { data: supplierById, error: supplierByIdError } = await supabase
      .from("tbl_suppliers")
      .select("supplier_id")
      .eq("supplier_id", resolvedSupplierId)
      .maybeSingle();
    if (supplierByIdError) throw supplierByIdError;
    if (!supplierById?.supplier_id) {
      throw new Error("Supplier not found.");
    }
  } else {
    const { data: supplierRow, error: supplierError } = await supabase
      .from("tbl_suppliers")
      .select("supplier_id")
      .ilike("supplier_name", input.supplierName)
      .maybeSingle();
    if (supplierError) throw supplierError;
    if (!supplierRow?.supplier_id) {
      throw new Error("Supplier not found.");
    }
    resolvedSupplierId = supplierRow.supplier_id;
  }

  const { error: medicationUpdateError } = await supabase
    .from("tbl_medications")
    .update({
      medication_name: input.medicationName,
      category_id: resolvedCategoryId,
      form: input.form,
      strength: input.strength,
      storage_requirement: input.storageRequirement,
      reorder_threshold: input.reorderThreshold,
      updated_at: now,
    })
    .eq("medication_id", medicationId);
  if (medicationUpdateError) throw medicationUpdateError;

  const inventoryStatus = deriveInventoryStatus(input.totalStock, input.reorderThreshold);
  const { data: inventoryRow, error: inventoryReadError } = await supabase
    .from("tbl_inventory")
    .select("inventory_id")
    .eq("medication_id", medicationId)
    .maybeSingle();
  if (inventoryReadError) throw inventoryReadError;

  if (inventoryRow?.inventory_id) {
    const { error: inventoryUpdateError } = await supabase
      .from("tbl_inventory")
      .update({
        total_stock: input.totalStock,
        status: inventoryStatus,
        last_updated: now,
      })
      .eq("inventory_id", inventoryRow.inventory_id);
    if (inventoryUpdateError) throw inventoryUpdateError;
  } else {
    const { error: inventoryInsertError } = await supabase
      .from("tbl_inventory")
      .insert({
        medication_id: medicationId,
        total_stock: input.totalStock,
        status: inventoryStatus,
        last_updated: now,
      });
    if (inventoryInsertError) throw inventoryInsertError;
  }

  const { data: latestBatch, error: batchError } = await supabase
    .from("tbl_batches")
    .select("batch_id")
    .eq("medication_id", medicationId)
    .order("received_date", { ascending: false })
    .order("batch_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (batchError) throw batchError;

  if (latestBatch?.batch_id) {
    const { error: batchUpdateError } = await supabase
      .from("tbl_batches")
      .update({
        supplier_id: resolvedSupplierId,
      })
      .eq("batch_id", latestBatch.batch_id);
    if (batchUpdateError) throw batchUpdateError;
  }
}

export { listCategories, createCategory, listSuppliers, listMedicationStocks, createMedicationFlow, updateMedicationFlow, disposeExpiredMedicationFlow };
