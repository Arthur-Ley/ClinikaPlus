import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getInventoryAlerts, markInventoryAlertResolved } from "../controllers/inventoryAlertController.js";

export const inventoryAlertRouter = Router();

inventoryAlertRouter.get("/", asyncHandler(getInventoryAlerts));
inventoryAlertRouter.patch("/:alertId/resolve", asyncHandler(markInventoryAlertResolved));
