import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createMedication,
  getMedicationCategories,
  getMedicationStocks,
  getMedicationSuppliers,
} from "../controllers/medicationController.js";

export const medicationRouter = Router();

medicationRouter.get("/", asyncHandler(getMedicationStocks));
medicationRouter.get("/categories", asyncHandler(getMedicationCategories));
medicationRouter.get("/suppliers", asyncHandler(getMedicationSuppliers));
medicationRouter.post("/", asyncHandler(createMedication));
