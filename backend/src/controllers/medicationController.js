import {
  createCategory,
  createMedicationFlow,
  disposeExpiredMedicationFlow,
  listCategories,
  listMedicationStocks,
  listSuppliers,
  updateMedicationFlow,
} from "../services/medicationService.js";
import {
  validateCreateCategoryInput,
  validateCreateMedicationInput,
  validateDisposeExpiredMedicationInput,
  validateUpdateMedicationInput,
} from "../models/medicationModel.js";

export async function getMedicationCategories(_req, res) {
  const categories = await listCategories();
  return res.status(200).json({ categories });
}

export async function getMedicationSuppliers(_req, res) {
  const suppliers = await listSuppliers();
  return res.status(200).json({ suppliers });
}

export async function getMedicationStocks(_req, res) {
  const items = await listMedicationStocks();
  return res.status(200).json({ items });
}

export async function createMedication(req, res) {
  const validation = validateCreateMedicationInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  const result = await createMedicationFlow(validation.data);
  return res.status(201).json(result);
}

export async function createMedicationCategory(req, res) {
  const validation = validateCreateCategoryInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  try {
    const category = await createCategory(validation.data);
    return res.status(201).json({ category });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create category.";
    if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
      return res.status(409).json({ error: "Category name already exists." });
    }
    throw error;
  }
}

export async function updateMedication(req, res) {
  const medicationId = Number(req.params.medicationId);
  if (!Number.isInteger(medicationId) || medicationId <= 0) {
    return res.status(400).json({ error: "'medicationId' must be a positive integer." });
  }

  const validation = validateUpdateMedicationInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  try {
    await updateMedicationFlow(medicationId, validation.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update medication.";
    if (message === "Category not found." || message === "Supplier not found.") {
      return res.status(400).json({ error: message });
    }
    throw error;
  }

  return res.status(200).json({ ok: true });
}

export async function disposeExpiredMedication(req, res) {
  const medicationId = Number(req.params.medicationId);
  if (!Number.isInteger(medicationId) || medicationId <= 0) {
    return res.status(400).json({ error: "'medicationId' must be a positive integer." });
  }

  const validation = validateDisposeExpiredMedicationInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  try {
    const result = await disposeExpiredMedicationFlow(medicationId, validation.data);
    return res.status(200).json({ ok: true, item: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to dispose expired medication.";
    if (
      message === "Medication not found." ||
      message === "No batch found for this medication." ||
      message === "Latest batch is not expired." ||
      message === "Expired batch is already disposed."
    ) {
      return res.status(400).json({ error: message });
    }
    throw error;
  }
}
