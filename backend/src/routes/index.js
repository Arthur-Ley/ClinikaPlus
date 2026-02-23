import { Router } from "express";
import { healthRouter } from "./health.js";
import { medicationRouter } from "./medication.js";
import { restockRequestRouter } from "./restockRequest.js";
import { storageRouter } from "./storage.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/medications", medicationRouter);
apiRouter.use("/restock-requests", restockRequestRouter);
apiRouter.use("/storage", storageRouter);
