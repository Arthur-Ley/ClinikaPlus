import {
  addBillItemFlow,
  cancelBillFlow,
  markBillPrintedFlow,
  createBillFlow,
  createPatientFlow,
  createPaymentFlow,
  getBillDetailsFlow,
  getBillingAnalyticsFlow,
  getBillingReportsOverviewFlow,
  listPaymentsFlow,
  listPaymentsByBillIdFlow,
  listPatientsFlow,
  listServiceCatalogFlow,
  listBillsFlow,
  listBillingTransactionsFlow,
  removeBillItemFlow,
  updateBillItemFlow,
} from "../services/billingService.js";

export async function createBill(req, res) {
  const result = await createBillFlow(req.body);
  return res.status(201).json(result);
}

export async function getBills(req, res) {
  const result = await listBillsFlow(req.query);
  return res.status(200).json(result);
}

export async function addBillItem(req, res) {
  const result = await addBillItemFlow(req.params.billId, req.body);
  return res.status(201).json(result);
}

export async function createPayment(req, res) {
  const result = await createPaymentFlow(req.body, req.params.billId);
  return res.status(201).json(result);
}

export async function getPayments(req, res) {
  const result = await listPaymentsFlow();
  return res.status(200).json(result);
}

export async function getPaymentsByBillId(req, res) {
  const result = await listPaymentsByBillIdFlow(req.params.billId);
  return res.status(200).json(result);
}

export async function updateBillItem(req, res) {
  const result = await updateBillItemFlow(req.params.billId, req.params.billItemId, req.body);
  return res.status(200).json(result);
}

export async function removeBillItem(req, res) {
  const result = await removeBillItemFlow(req.params.billId, req.params.billItemId);
  return res.status(200).json(result);
}

export async function cancelBill(req, res) {
  const bill = await cancelBillFlow(req.params.billId);
  return res.status(200).json({ bill });
}

export async function markBillPrinted(req, res) {
  const bill = await markBillPrintedFlow(req.params.billId);
  return res.status(200).json({ bill });
}

export async function getBillDetails(req, res) {
  const result = await getBillDetailsFlow(req.params.billId);
  return res.status(200).json(result);
}

export async function getBillingAnalytics(_req, res) {
  const analytics = await getBillingAnalyticsFlow();
  return res.status(200).json({ analytics });
}

export async function getBillingTransactions(req, res) {
  const result = await listBillingTransactionsFlow(req.query);
  return res.status(200).json(result);
}

export async function getBillingReportsOverview(_req, res) {
  const result = await getBillingReportsOverviewFlow();
  return res.status(200).json(result);
}

export async function getPatients(req, res) {
  const result = await listPatientsFlow(req.query);
  return res.status(200).json(result);
}

export async function createPatient(req, res) {
  const result = await createPatientFlow(req.body);
  return res.status(201).json(result);
}

export async function getServices(req, res) {
  const result = await listServiceCatalogFlow();
  return res.status(200).json(result);
}
