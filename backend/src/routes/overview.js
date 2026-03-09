import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getOverview } from "../controllers/overviewController.js";

export const overviewRouter = Router();

overviewRouter.get("/", asyncHandler(getOverview));

