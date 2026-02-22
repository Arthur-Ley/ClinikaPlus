import {
  createMedicationFlow,
  listCategories,
  listMedicationStocks,
  listSuppliers,
} from "../services/medicationService.js";
import { validateCreateMedicationInput } from "../models/medicationModel.js";

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
