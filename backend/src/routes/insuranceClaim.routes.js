import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  approveInsuranceClaimController,
  createInsuranceClaimController,
  getAllInsuranceClaimsController,
  getClaimCreateOptionsController,
  getInsuranceClaimByIdController,
  getInsuranceClaimsByBillIdController,
  payInsuranceClaimController,
  rejectInsuranceClaimController,
  submitInsuranceClaimController,
} from "../controllers/insuranceClaim.controller.js";

export const insuranceClaimRouter = Router();

insuranceClaimRouter.post("/", asyncHandler(createInsuranceClaimController));
insuranceClaimRouter.post("/:id/submit", asyncHandler(submitInsuranceClaimController));
insuranceClaimRouter.post("/:id/approve", asyncHandler(approveInsuranceClaimController));
insuranceClaimRouter.post("/:id/reject", asyncHandler(rejectInsuranceClaimController));
insuranceClaimRouter.post("/:id/pay", asyncHandler(payInsuranceClaimController));
insuranceClaimRouter.get("/", asyncHandler(getAllInsuranceClaimsController));
insuranceClaimRouter.get("/options", asyncHandler(getClaimCreateOptionsController));
insuranceClaimRouter.get("/bill/:billId", asyncHandler(getInsuranceClaimsByBillIdController));
insuranceClaimRouter.get("/:id", asyncHandler(getInsuranceClaimByIdController));
