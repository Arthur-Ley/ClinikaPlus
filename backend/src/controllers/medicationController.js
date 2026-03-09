import {
  createMedicationFlow,
  listCategories,
  listMedicationStocks,
  listSuppliers,
  updateMedicationFlow,
} from "../services/medicationService.js";
import { validateCreateMedicationInput, validateUpdateMedicationInput } from "../models/medicationModel.js";

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

export async function updateMedication(req, res) {
  const medicationId = Number(req.params.medicationId);
  if (!Number.isInteger(medicationId) || medicationId <= 0) {
    return res.status(400).json({ error: "'medicationId' must be a positive integer." });
  }

  const validation = validateUpdateMedicationInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  await updateMedicationFlow(medicationId, validation.data);
  return res.status(200).json({ ok: true });
}
