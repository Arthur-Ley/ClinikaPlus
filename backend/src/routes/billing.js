import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  addBillItem,
  cancelBill,
  createBill,
  createPatient,
  createPayment,
  getPayments,
  getPaymentsByBillId,
  getBillDetails,
  markBillPrinted,
  getBillingAnalytics,
  getBillingReportsOverview,
  getReportsSummary,
  getMedicationDemandTrend,
  getTopMovers,
  getInventoryRunway,
  getExpiryRisk,
  getRevenueMix,
  getUnitPriceTrend,
  getPatients,
  getServices,
  getBillingTransactions,
  getBills,
  removeBillItem,
  updateBillItem,
} from "../controllers/billingController.js";

export const billingRouter = Router();

billingRouter.get("/dashboard/analytics", asyncHandler(getBillingAnalytics));
billingRouter.get("/reports/overview", asyncHandler(getBillingReportsOverview));
billingRouter.get("/reports/summary", asyncHandler(getReportsSummary));
billingRouter.get("/reports/medication-demand-trend", asyncHandler(getMedicationDemandTrend));
billingRouter.get("/reports/top-movers", asyncHandler(getTopMovers));
billingRouter.get("/reports/inventory-runway", asyncHandler(getInventoryRunway));
billingRouter.get("/reports/expiry-risk", asyncHandler(getExpiryRisk));
billingRouter.get("/reports/revenue-mix", asyncHandler(getRevenueMix));
billingRouter.get("/reports/unit-price-trend", asyncHandler(getUnitPriceTrend));
billingRouter.get("/transactions", asyncHandler(getBillingTransactions));
billingRouter.get("/services", asyncHandler(getServices));
billingRouter.get("/patients", asyncHandler(getPatients));
billingRouter.get("/payments", asyncHandler(getPayments));
billingRouter.get("/payments/:billId", asyncHandler(getPaymentsByBillId));
billingRouter.get("/bills", asyncHandler(getBills));
billingRouter.get("/bills/:billId", asyncHandler(getBillDetails));
billingRouter.post("/bills", asyncHandler(createBill));
billingRouter.post("/patients", asyncHandler(createPatient));
billingRouter.post("/payments", asyncHandler(createPayment));
billingRouter.post("/bills/:billId/items", asyncHandler(addBillItem));
billingRouter.patch("/bills/:billId/items/:billItemId", asyncHandler(updateBillItem));
billingRouter.delete("/bills/:billId/items/:billItemId", asyncHandler(removeBillItem));
billingRouter.post("/bills/:billId/payments", asyncHandler(createPayment));
billingRouter.patch("/bills/:billId/cancel", asyncHandler(cancelBill));
billingRouter.patch("/bills/:billId/printed", asyncHandler(markBillPrinted));
