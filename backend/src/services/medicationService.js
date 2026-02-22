import { supabase } from "../lib/supabase.js";

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
      unit,
      reorder_threshold,
      tbl_categories(category_name),
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

    return {
      medication_id: medication.medication_id,
      medication_name: medication.medication_name,
      category_name: medication.tbl_categories?.category_name || "Uncategorized",
      form: medication.form,
      strength: medication.strength,
      unit: medication.unit,
      reorder_threshold: medication.reorder_threshold,
      total_stock: totalStock,
      status: computedStatus,
      last_updated: inventory?.last_updated || null,
      batch_number: batch?.batch_number || null,
      expiry_date: batch?.expiry_date || null,
      supplier_name: batch?.tbl_suppliers?.supplier_name || null,
    };
  });
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
      unit: input.unit,
      reorder_threshold: input.reorderThreshold,
      created_at: now,
      updated_at: now,
    })
    .select("medication_id, medication_name, category_id, form, strength, unit, reorder_threshold")
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

export { listCategories, listSuppliers, listMedicationStocks, createMedicationFlow };
