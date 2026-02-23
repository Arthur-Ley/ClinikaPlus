import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createRestockRequest,
  getRestockRequests,
  updateRestockRequest,
} from "../controllers/restockRequestController.js";

export const restockRequestRouter = Router();

restockRequestRouter.get("/", asyncHandler(getRestockRequests));
restockRequestRouter.post("/", asyncHandler(createRestockRequest));
restockRequestRouter.patch("/:requestId", asyncHandler(updateRestockRequest));
