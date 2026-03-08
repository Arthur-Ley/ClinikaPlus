import { Router } from "express";
import {
  createSupplierRecord,
  getAllSuppliers,
  removeSupplierRecord,
  updateSupplierRecord,
} from "./supplier.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const supplierRouter = Router();

supplierRouter.get("/", asyncHandler(getAllSuppliers));
supplierRouter.post("/", asyncHandler(createSupplierRecord));
supplierRouter.put("/:id", asyncHandler(updateSupplierRecord));
supplierRouter.delete("/:id", asyncHandler(removeSupplierRecord));
