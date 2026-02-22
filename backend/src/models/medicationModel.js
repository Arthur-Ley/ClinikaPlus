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

