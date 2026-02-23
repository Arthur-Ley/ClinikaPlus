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

function toRequestStatus(value) {
  const normalized = toTrimmedString(value);
  if (normalized === "Pending" || normalized === "Completed" || normalized === "Cancelled") {
    return normalized;
  }
  return null;
}

function toIsoDate(value) {
  const normalized = toTrimmedString(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function validateCreateRestockRequestInput(payload) {
  const medicationId = toPositiveInt(payload?.medication_id);
  const supplierId = toPositiveInt(payload?.supplier_id);
  const currentStock = Number(payload?.current_stock);
  const suggestedQuantity = toPositiveInt(payload?.suggested_quantity);
  const requestedQuantity = toPositiveInt(payload?.requested_quantity);
  const requestedOn = toIsoDate(payload?.requested_on) || new Date().toISOString().slice(0, 10);
  const notes = toTrimmedString(payload?.notes);

  if (!medicationId) {
    return { ok: false, message: "'medication_id' must be a positive integer." };
  }
  if (!supplierId) {
    return { ok: false, message: "'supplier_id' must be a positive integer." };
  }
  if (!Number.isInteger(currentStock) || currentStock < 0) {
    return { ok: false, message: "'current_stock' must be an integer greater than or equal to 0." };
  }
  if (!suggestedQuantity) {
    return { ok: false, message: "'suggested_quantity' must be a positive integer." };
  }
  if (!requestedQuantity) {
    return { ok: false, message: "'requested_quantity' must be a positive integer." };
  }

  return {
    ok: true,
    data: {
      medicationId,
      supplierId,
      currentStock,
      suggestedQuantity,
      requestedQuantity,
      requestedOn,
      notes: notes || null,
    },
  };
}

export function validateUpdateRestockRequestInput(payload) {
  const next = {};

  if (payload?.supplier_id !== undefined) {
    const supplierId = toPositiveInt(payload.supplier_id);
    if (!supplierId) {
      return { ok: false, message: "'supplier_id' must be a positive integer." };
    }
    next.supplierId = supplierId;
  }

  if (payload?.requested_quantity !== undefined) {
    const requestedQuantity = toPositiveInt(payload.requested_quantity);
    if (!requestedQuantity) {
      return { ok: false, message: "'requested_quantity' must be a positive integer." };
    }
    next.requestedQuantity = requestedQuantity;
  }

  if (payload?.status !== undefined) {
    const status = toRequestStatus(payload.status);
    if (!status) {
      return { ok: false, message: "'status' must be one of Pending, Completed, Cancelled." };
    }
    next.status = status;
  }

  if (payload?.notes !== undefined) {
    const notes = toTrimmedString(payload.notes);
    next.notes = notes || null;
  }

  return {
    ok: true,
    data: next,
  };
}
