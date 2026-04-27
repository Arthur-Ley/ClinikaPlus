import { Router } from "express";
import { authenticateRequest } from "../middlewares/authenticateRequest.js";
import { supplierRouter } from "../modules/suppliers/supplier.routes.js";
import { authRouter } from "./auth.js";
import { billingRouter } from "./billing.js";
import { healthRouter } from "./health.js";
import { insuranceClaimRouter } from "./insuranceClaim.routes.js";
import { inventoryAlertRouter } from "./inventoryAlert.js";
import { medicationRouter } from "./medication.js";
import { overviewRouter } from "./overview.js";
import { notificationRouter } from "./notifications.js";
import { restockRequestRouter } from "./restockRequest.js";
import { storageRouter } from "./storage.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use(authenticateRequest);
apiRouter.use("/overview", overviewRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/inventory-alerts", inventoryAlertRouter);
apiRouter.use("/medications", medicationRouter);
apiRouter.use("/restock-requests", restockRequestRouter);
apiRouter.use("/storage", storageRouter);
apiRouter.use("/suppliers", supplierRouter);
apiRouter.use("/billing", billingRouter);
apiRouter.use("/claims", insuranceClaimRouter);
