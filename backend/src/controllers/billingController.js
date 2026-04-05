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
import { supabase } from "../lib/supabase.js";
import { supabaseAuth } from "../lib/supabaseAuth.js";

function getUserMetadata(user) {
  if (user?.user_metadata && typeof user.user_metadata === "object") {
    return user.user_metadata;
  }

  if (user?.raw_user_meta_data && typeof user.raw_user_meta_data === "object") {
    return user.raw_user_meta_data;
  }

  return {};
}

async function resolveCurrentUser(req) {
  const authorizationHeader = req.headers.authorization || "";
  const token = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user?.id) {
    return null;
  }

  const metadata = getUserMetadata(data.user);
  const { data: profile } = await supabase
    .schema("subsystem3")
    .from("tbl_users")
    .select("first_name, last_name, email, role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const firstName =
    (typeof profile?.first_name === "string" && profile.first_name.trim()) ||
    (typeof metadata.first_name === "string" && metadata.first_name.trim()) ||
    "";
  const lastName =
    (typeof profile?.last_name === "string" && profile.last_name.trim()) ||
    (typeof metadata.last_name === "string" && metadata.last_name.trim()) ||
    "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    id: data.user.id,
    fullName: fullName || profile?.email || data.user.email || null,
  };
}

export async function createBill(req, res) {
  const currentUser = await resolveCurrentUser(req);
  if (!currentUser?.id) {
    return res.status(401).json({ error: "Unable to resolve the current logged-in user for this bill." });
  }
  const result = await createBillFlow(req.body, currentUser?.id ?? null);
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
  const currentUser = await resolveCurrentUser(req);
  if (!currentUser?.id) {
    return res.status(401).json({ error: "Unable to resolve the current logged-in user for this payment." });
  }
  const result = await createPaymentFlow(req.body, req.params.billId, currentUser ?? null);
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
