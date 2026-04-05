import { Router } from "express";
import {
  createSupplierRecord,
  getAllSuppliers,
  getSupplierProcurementInsightsRecord,
  removeSupplierRecord,
  updateSupplierRecord,
} from "./supplier.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const supplierRouter = Router();

supplierRouter.get("/", asyncHandler(getAllSuppliers));
supplierRouter.get("/:id/procurement-insights", asyncHandler(getSupplierProcurementInsightsRecord));
supplierRouter.post("/", asyncHandler(createSupplierRecord));
supplierRouter.put("/:id", asyncHandler(updateSupplierRecord));
supplierRouter.delete("/:id", asyncHandler(removeSupplierRecord));
