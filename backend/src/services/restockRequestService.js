import { supabase } from "../lib/supabase.js";

function buildRequestCode() {
  return `RR-${Date.now()}`;
}

function toDateOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function deriveInventoryStatus(totalStock, reorderThreshold) {
  if (totalStock <= 0) return "Critical";
  if (totalStock < reorderThreshold) return "Low";
  return "Adequate";
}

async function listRestockRequests() {
  const { data, error } = await supabase
    .from("tbl_restock_requests")
    .select(`
      request_id,
      request_code,
      medication_id,
      supplier_id,
      current_stock,
      suggested_quantity,
      requested_quantity,
      requested_on,
      resolved_on,
      status,
      notes,
      created_at,
      updated_at,
      tbl_medications(
        medication_name,
        unit,
        reorder_threshold,
        tbl_categories(category_name)
      ),
      tbl_suppliers(supplier_name)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    request_id: row.request_id,
    request_code: row.request_code,
    medication_id: row.medication_id,
    supplier_id: row.supplier_id,
    current_stock: row.current_stock,
    suggested_quantity: row.suggested_quantity,
    requested_quantity: row.requested_quantity,
    requested_on: row.requested_on,
    resolved_on: row.resolved_on ?? null,
    status: row.status,
    notes: row.notes || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    medication_name: row.tbl_medications?.medication_name || "Unknown Medication",
    category_name: row.tbl_medications?.tbl_categories?.category_name || "Uncategorized",
    unit: row.tbl_medications?.unit || "pcs",
    reorder_threshold: row.tbl_medications?.reorder_threshold ?? 0,
    supplier_name: row.tbl_suppliers?.supplier_name || "N/A",
  }));
}

async function createRestockRequestFlow(input) {
  const nowIso = new Date().toISOString();
  const requestCode = buildRequestCode();

  const { data, error } = await supabase
    .from("tbl_restock_requests")
    .insert({
      request_code: requestCode,
      medication_id: input.medicationId,
      supplier_id: input.supplierId,
      current_stock: input.currentStock,
      suggested_quantity: input.suggestedQuantity,
      requested_quantity: input.requestedQuantity,
      requested_on: input.requestedOn,
      status: "Pending",
      notes: input.notes,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("request_id, request_code")
    .single();

  if (error) throw error;
  return data;
}

async function updateRestockRequestFlow(requestId, updates) {
  const { data: existingRequest, error: existingRequestError } = await supabase
    .from("tbl_restock_requests")
    .select("request_id, medication_id, requested_quantity, status")
    .eq("request_id", requestId)
    .single();

  if (existingRequestError) throw existingRequestError;

  const updatePayload = {
    updated_at: new Date().toISOString(),
  };

  if (updates.supplierId !== undefined) {
    updatePayload.supplier_id = updates.supplierId;
  }
  if (updates.requestedQuantity !== undefined) {
    updatePayload.requested_quantity = updates.requestedQuantity;
  }
  if (updates.status !== undefined) {
    updatePayload.status = updates.status;
    if (updates.status === "Completed" || updates.status === "Cancelled") {
      updatePayload.resolved_on = toDateOrNull(updatePayload.updated_at);
    } else if (updates.status === "Pending") {
      updatePayload.resolved_on = null;
    }
  }
  if (updates.notes !== undefined) {
    updatePayload.notes = updates.notes;
  }

  const isCompletingNow = existingRequest.status !== "Completed" && updates.status === "Completed";
  if (isCompletingNow) {
    const quantityToRestock = updates.requestedQuantity ?? existingRequest.requested_quantity ?? 0;

    const { data: inventoryRow, error: inventoryFetchError } = await supabase
      .from("tbl_inventory")
      .select("inventory_id, total_stock")
      .eq("medication_id", existingRequest.medication_id)
      .maybeSingle();
    if (inventoryFetchError) throw inventoryFetchError;

    const { data: medicationRow, error: medicationFetchError } = await supabase
      .from("tbl_medications")
      .select("reorder_threshold")
      .eq("medication_id", existingRequest.medication_id)
      .single();
    if (medicationFetchError) throw medicationFetchError;

    const nextTotalStock = Number(inventoryRow?.total_stock || 0) + Number(quantityToRestock || 0);
    const nextInventoryStatus = deriveInventoryStatus(nextTotalStock, Number(medicationRow?.reorder_threshold || 0));

    if (inventoryRow?.inventory_id) {
      const { data: updatedInventory, error: inventoryUpdateError } = await supabase
        .from("tbl_inventory")
        .update({
          total_stock: nextTotalStock,
          status: nextInventoryStatus,
          last_updated: updatePayload.updated_at,
        })
        .eq("inventory_id", inventoryRow.inventory_id)
        .select("inventory_id")
        .single();
      if (inventoryUpdateError) throw inventoryUpdateError;
      if (!updatedInventory?.inventory_id) {
        throw new Error("Failed to update inventory stock for completed restock request.");
      }
    } else {
      const { data: insertedInventory, error: inventoryInsertError } = await supabase
        .from("tbl_inventory")
        .insert({
          medication_id: existingRequest.medication_id,
          total_stock: nextTotalStock,
          status: nextInventoryStatus,
          last_updated: updatePayload.updated_at,
        })
        .select("inventory_id")
        .single();
      if (inventoryInsertError) throw inventoryInsertError;
      if (!insertedInventory?.inventory_id) {
        throw new Error("Failed to create inventory stock for completed restock request.");
      }
    }
  }

  const { data, error } = await supabase
    .from("tbl_restock_requests")
    .update(updatePayload)
    .eq("request_id", requestId)
    .select("request_id")
    .single();

  if (error) throw error;
  return data;
}

export { listRestockRequests, createRestockRequestFlow, updateRestockRequestFlow };
