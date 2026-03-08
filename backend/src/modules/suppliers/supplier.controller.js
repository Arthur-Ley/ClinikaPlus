import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from "./supplier.service.js";

export async function getAllSuppliers(_req, res) {
  const suppliers = await getSuppliers();
  return res.status(200).json({ suppliers });
}

export async function createSupplierRecord(req, res) {
  const supplier = await createSupplier(req.body);
  return res.status(201).json({ supplier });
}

export async function updateSupplierRecord(req, res) {
  const supplier = await updateSupplier(req.params.id, req.body);
  return res.status(200).json({ supplier });
}

export async function removeSupplierRecord(req, res) {
  await deleteSupplier(req.params.id);
  return res.status(200).json({ message: "Supplier deleted" });
}
