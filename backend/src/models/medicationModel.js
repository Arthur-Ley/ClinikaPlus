function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toNonNegativeInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function validateCreateMedicationInput(payload) {
  const medicationName = toTrimmedString(payload?.medication_name);
  const form = toTrimmedString(payload?.form);
  const strength = toTrimmedString(payload?.strength);
  const unit = toTrimmedString(payload?.unit);
  const batchNumber = toTrimmedString(payload?.batch_number);
  const expiryDate = toTrimmedString(payload?.expiry_date);

  const categoryId = toPositiveInt(payload?.category_id);
  const reorderThreshold = toPositiveInt(payload?.reorder_threshold);
  const supplierId = toPositiveInt(payload?.supplier_id);
  const quantity = toPositiveInt(payload?.quantity);

  if (!medicationName) {
    return { ok: false, message: "'medication_name' is required." };
  }
  if (!categoryId) {
    return { ok: false, message: "'category_id' must be a positive integer." };
  }
  if (!form) {
    return { ok: false, message: "'form' is required." };
  }
  if (!unit) {
    return { ok: false, message: "'unit' is required." };
  }
  if (!reorderThreshold) {
    return { ok: false, message: "'reorder_threshold' must be a positive integer." };
  }
  if (!batchNumber) {
    return { ok: false, message: "'batch_number' is required." };
  }
  if (!quantity) {
    return { ok: false, message: "'quantity' must be a positive integer." };
  }
  if (!expiryDate) {
    return { ok: false, message: "'expiry_date' is required." };
  }
  if (!supplierId) {
    return { ok: false, message: "'supplier_id' must be a positive integer." };
  }

  return {
    ok: true,
    data: {
      medicationName,
      categoryId,
      form,
      strength: strength || null,
      unit,
      reorderThreshold,
      batchNumber,
      quantity,
      expiryDate,
      supplierId,
    },
  };
}

export function validateUpdateMedicationInput(payload) {
  const medicationName = toTrimmedString(payload?.medication_name);
  const categoryName = toTrimmedString(payload?.category_name);
  const form = toTrimmedString(payload?.form);
  const strength = toTrimmedString(payload?.strength);
  const supplierName = toTrimmedString(payload?.supplier_name);

  const totalStock = toNonNegativeInt(payload?.total_stock);
  const reorderThreshold = toNonNegativeInt(payload?.reorder_threshold);

  if (!medicationName) {
    return { ok: false, message: "'medication_name' is required." };
  }
  if (!categoryName) {
    return { ok: false, message: "'category_name' is required." };
  }
  if (!form) {
    return { ok: false, message: "'form' is required." };
  }
  if (totalStock === null) {
    return { ok: false, message: "'total_stock' must be an integer greater than or equal to 0." };
  }
  if (reorderThreshold === null) {
    return { ok: false, message: "'reorder_threshold' must be an integer greater than or equal to 0." };
  }
  if (!supplierName) {
    return { ok: false, message: "'supplier_name' is required." };
  }

  return {
    ok: true,
    data: {
      medicationName,
      categoryName,
      form,
      strength: strength || null,
      totalStock,
      reorderThreshold,
      supplierName,
    },
  };
}
