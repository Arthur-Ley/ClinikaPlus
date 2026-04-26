import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createMedicationCategory,
  createMedication,
  getMedicationCategories,
  getMedicationStocks,
  getMedicationSuppliers,
  updateMedication,
} from "../controllers/medicationController.js";

export const medicationRouter = Router();

medicationRouter.get("/", asyncHandler(getMedicationStocks));
medicationRouter.get("/categories", asyncHandler(getMedicationCategories));
medicationRouter.post("/categories", asyncHandler(createMedicationCategory));
medicationRouter.get("/suppliers", asyncHandler(getMedicationSuppliers));
medicationRouter.post("/", asyncHandler(createMedication));
medicationRouter.patch("/:medicationId", asyncHandler(updateMedication));
