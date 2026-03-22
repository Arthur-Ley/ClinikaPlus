import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  addBillItem,
  cancelBill,
  createBill,
  createPayment,
  getBillDetails,
  getBillingAnalytics,
  getBillingReportsOverview,
  getBillingTransactions,
  getBills,
  removeBillItem,
  updateBillItem,
} from "../controllers/billingController.js";

export const billingRouter = Router();

billingRouter.get("/dashboard/analytics", asyncHandler(getBillingAnalytics));
billingRouter.get("/reports/overview", asyncHandler(getBillingReportsOverview));
billingRouter.get("/transactions", asyncHandler(getBillingTransactions));
billingRouter.get("/bills", asyncHandler(getBills));
billingRouter.get("/bills/:billId", asyncHandler(getBillDetails));
billingRouter.post("/bills", asyncHandler(createBill));
billingRouter.post("/bills/:billId/items", asyncHandler(addBillItem));
billingRouter.patch("/bills/:billId/items/:billItemId", asyncHandler(updateBillItem));
billingRouter.delete("/bills/:billId/items/:billItemId", asyncHandler(removeBillItem));
billingRouter.post("/bills/:billId/payments", asyncHandler(createPayment));
billingRouter.patch("/bills/:billId/cancel", asyncHandler(cancelBill));
