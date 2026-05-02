import {
  createBill,
  createBillItem,
  createBillItems,
  createPatient,
  createPayment,
  deleteBillById,
  deleteBillItemById,
  deleteBillItemsByBillId,
  deletePaymentById,
  fetchAnalyticsBills,
  fetchAnalyticsPayments,
  fetchBillItemsForReports,
  fetchMedicationInventoryForReports,
  fetchBatchesForReports,
  fetchPaymentsWithBillContext,
  getAppUserById,
  getBillById,
  getBillItemById,
  getBillItemsByBillId,
  getBatchStockTotalByMedicationId,
  getInventoryByMedicationId,
  getMedicationById,
  getNextCode,
  getPaymentsByBillId,
  findPatientUuidByIdentifier,
  hasAnyPayment,
  createPrescriptionUsageLog,
  deletePrescriptionUsageLogById,
  listAvailableBatchesByMedicationId,
  listMedicationBillItemsByBillId,
  listActiveServices,
  listPatients,
  listPaymentsWithBillPatient,
  listPaymentsByBillIdWithBillPatient,
  listBillIdsByItemDateRange,
  listBillsFiltered,
  listPaymentsForBills,
  updateBillById,
  updateBillItemById,
  updateBatchById,
  updateInventoryByMedicationId,
} from "../models/billingModel.js";
import {
  buildPagedResult,
  computeSubtotal,
  isReferenceRequired,
  normalizeText,
  roundCurrency,
  toNonNegativeNumber,
  toPositiveInt,
} from "../utils/billingUtils.js";

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function conflict(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function isUniqueConstraintError(error, constraintName) {
  return error?.code === "23505" && error?.constraint === constraintName;
}

function deriveInventoryStatusForPaidFlow(totalStock, reorderThreshold) {
  if (totalStock <= 0) return "Critical";
  if (totalStock <= reorderThreshold) return "Low";
  return "Adequate";
}

function resolvePatientName(patientRelation, patientId) {
  const patient = Array.isArray(patientRelation) ? patientRelation[0] : patientRelation;
  if (!patient || typeof patient !== "object") {
    return patientId ? `Patient #${patientId}` : "Unknown Patient";
  }

  const candidates = [patient.full_name, patient.patient_name, patient.name];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const combined = [patient.first_name, patient.middle_name, patient.last_name]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .trim();

  return combined || (patientId ? `Patient #${patientId}` : "Unknown Patient");
}

function normalizeMethodLabel(value) {
  const normalized = normalizeText(value);
  return normalized || "Unspecified";
}

function resolveUserDisplayName(userRelation) {
  const user = Array.isArray(userRelation) ? userRelation[0] : userRelation;
  if (!user || typeof user !== "object") {
    return null;
  }

  const fullName = [user.first_name, user.last_name]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .trim();

  return fullName || null;
}

async function attachBillCreator(bill) {
  if (!bill || typeof bill !== "object") {
    return bill;
  }

  const creator = await getAppUserById(bill.created_by);
  return {
    ...bill,
    creator,
  };
}

async function attachPaymentReceiver(payment) {
  if (!payment || typeof payment !== "object") {
    return payment;
  }

  const receiver = await getAppUserById(payment.received_by);
  return {
    ...payment,
    receiver,
  };
}

async function attachPaymentReceivers(payments) {
  return Promise.all((payments || []).map((payment) => attachPaymentReceiver(payment)));
}

function toIsoDateOnly(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseDateOnly(value, fieldName) {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`'${fieldName}' must be a valid date.`);
  }

  return parsed.toISOString().slice(0, 10);
}

function getTodayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateOnly, days) {
  const parsed = new Date(`${dateOnly}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function startOfWeekDateOnly(dateOnly) {
  const parsed = new Date(`${dateOnly}T00:00:00.000Z`);
  const day = parsed.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  parsed.setUTCDate(parsed.getUTCDate() + diff);
  return parsed.toISOString().slice(0, 10);
}

function startOfMonthDateOnly(dateOnly) {
  const [year, month] = dateOnly.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function getRangeLabel(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function parseReportRange(query) {
  const preset = normalizeText(query?.preset).toLowerCase() || "this_month";
  let startDate = parseDateOnly(query?.start_date, "start_date");
  let endDate = parseDateOnly(query?.end_date, "end_date");

  if (!startDate || !endDate) {
    const today = getTodayDateOnly();

    if (preset === "today") {
      startDate = today;
      endDate = today;
    } else if (preset === "this_week") {
      startDate = startOfWeekDateOnly(today);
      endDate = today;
    } else {
      startDate = startOfMonthDateOnly(today);
      endDate = today;
    }
  }

  if (startDate > endDate) {
    throw badRequest("'start_date' must be less than or equal to 'end_date'.");
  }

  const daySpan = Math.max(
    1,
    Math.round(
      (new Date(`${endDate}T00:00:00.000Z`).getTime() - new Date(`${startDate}T00:00:00.000Z`).getTime())
        / 86400000
    ) + 1
  );

  const previousEndDate = addDays(startDate, -1);
  const previousStartDate = addDays(previousEndDate, -(daySpan - 1));

  return {
    preset,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    daySpan,
    label: getRangeLabel(startDate, endDate),
  };
}

function isDateWithinRange(dateOnly, startDate, endDate) {
  return Boolean(dateOnly && dateOnly >= startDate && dateOnly <= endDate);
}

function getBillActivityDate(bill) {
  return toIsoDateOnly(bill?.bill_date || bill?.created_at);
}

function percentageChange(currentValue, previousValue) {
  if (!previousValue) {
    return currentValue > 0 ? 100 : 0;
  }

  return roundCurrency(((currentValue - previousValue) / previousValue) * 100);
}

function incrementGroupedValue(map, key, amount) {
  map.set(key, roundCurrency((map.get(key) || 0) + amount));
}

function takeLastSortedEntries(map, limit, labelFormatter) {
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-limit)
    .map(([rawLabel, value]) => ({
      label: labelFormatter(rawLabel),
      value,
    }));
}

function formatMonthLabel(isoMonth) {
  const parsed = new Date(`${isoMonth}-01T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return isoMonth;
  return parsed.toLocaleDateString("en-US", { month: "short" });
}

function formatDayLabel(isoDate) {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWeekLabel(isoDate) {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return `Week of ${parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function resolveServiceBucketLabel(item) {
  const medication = Array.isArray(item?.tbl_medications) ? item.tbl_medications[0] : item?.tbl_medications;
  if (medication?.medication_name) {
    return medication.medication_name;
  }

  const description = normalizeText(item?.description);
  if (description) {
    return description;
  }

  if (toPositiveInt(item?.service_id)) {
    return `Service #${item.service_id}`;
  }

  if (toPositiveInt(item?.medication_id ?? item?.log_id)) {
    return `Medication #${item.medication_id ?? item?.log_id}`;
  }

  return "Unlabeled Item";
}

function toNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function isMedicationServiceType(value) {
  return normalizeText(value).toLowerCase() === "medications";
}

function classifyServiceSubtotal(item) {
  const amount = roundCurrency(Number(item?.subtotal || 0));
  const isMedication = toPositiveInt(item?.medication_id ?? item?.log_id);
  if (isMedication) {
    return { medications: amount, laboratory: 0, miscellaneous: 0, professional_fee: 0 };
  }

  const description = normalizeText(item?.description).toLowerCase();
  const isLaboratory =
    description.includes("laboratory") ||
    description.includes("lab") ||
    description.includes("x-ray") ||
    description.includes("xray") ||
    description.includes("urinalysis") ||
    description.includes("blood");
  const isProfessional =
    description.includes("consultation") ||
    description.includes("doctor") ||
    description.includes("professional");

  if (isLaboratory) {
    return { medications: 0, laboratory: amount, miscellaneous: 0, professional_fee: 0 };
  }
  if (isProfessional) {
    return { medications: 0, laboratory: 0, miscellaneous: 0, professional_fee: amount };
  }

  return { medications: 0, laboratory: 0, miscellaneous: amount, professional_fee: 0 };
}

function toTransactionRecord(row) {
  const bill = Array.isArray(row?.tbl_bills) ? row.tbl_bills[0] : row?.tbl_bills;
  const patientId = bill?.patient_id ?? null;
  const patientName = resolvePatientName(bill?.tbl_patients, patientId);
  const paymentDate = row?.payment_date || row?.created_at || bill?.created_at || null;

  return {
    payment_id: row.payment_id,
    payment_code: row.payment_code || `PAY-${row.payment_id}`,
    bill_id: row.bill_id,
    bill_code: bill?.bill_code || `BILL-${row.bill_id}`,
    patient_id: patientId,
    patient_name: patientName,
    amount: roundCurrency(Number(row.amount_paid || 0)),
    method: normalizeMethodLabel(row.payment_method),
    date: toIsoDateOnly(paymentDate),
    paid_at: paymentDate,
    reference_number: row.reference_number || null,
    received_by: resolveUserDisplayName(row.receiver),
    bill_status: bill?.status || "Paid",
    status: "Paid",
  };
}

function buildPaymentsByBillId(payments) {
  const paymentsByBillId = new Map();

  for (const payment of payments) {
    if (!paymentsByBillId.has(payment.bill_id)) {
      paymentsByBillId.set(payment.bill_id, []);
    }
    paymentsByBillId.get(payment.bill_id).push(payment);
  }

  return paymentsByBillId;
}

function buildReportAnalytics(bills, transactions, paymentsByBillId) {
  const totalPendingBills = bills.filter((bill) => bill.status === "Pending").length;
  const totalPaidBills = bills.filter((bill) => bill.status === "Paid").length;
  const totalRevenue = roundCurrency(transactions.reduce((sum, transaction) => sum + transaction.amount, 0));
  const totalOutstandingBalance = roundCurrency(
    bills
      .filter((bill) => bill.status !== "Cancelled")
      .reduce((sum, bill) => {
        const billPayments = paymentsByBillId.get(bill.bill_id) || [];
        const paid = billPayments.reduce((innerSum, payment) => innerSum + Number(payment.amount_paid || 0), 0);
        return sum + Math.max(Number(bill.net_amount || 0) - paid, 0);
      }, 0)
  );
  const averageBillAmount = transactions.length ? roundCurrency(totalRevenue / transactions.length) : 0;

  return {
    total_pending_bills: totalPendingBills,
    total_paid_bills: totalPaidBills,
    total_transactions: transactions.length,
    total_revenue: totalRevenue,
    total_outstanding_balance: totalOutstandingBalance,
    average_bill_amount: averageBillAmount,
  };
}

function getChartGranularity(daySpan) {
  if (daySpan <= 31) return "day";
  if (daySpan <= 180) return "week";
  return "month";
}

function parseReportsScope(query = {}) {
  const rawScope = normalizeText(query?.scope).toLowerCase();
  const scope = rawScope === "single" || rawScope === "top5" ? rawScope : "all";
  const medicationId = toPositiveInt(query?.medicationId);
  const bucket = normalizeText(query?.bucket).toLowerCase();
  const normalizedBucket = bucket === "week" || bucket === "month" ? bucket : "day";
  const topN = Math.max(1, Math.min(20, toPositiveInt(query?.topN) || 5));
  const limit = Math.max(1, Math.min(50, toPositiveInt(query?.limit) || 10));

  return {
    scope,
    medicationId: medicationId || null,
    bucket: normalizedBucket,
    topN,
    limit,
  };
}

function getPeriodKey(dateOnly, bucket) {
  if (!dateOnly) return "";
  if (bucket === "month") return dateOnly.slice(0, 7);
  if (bucket === "week") return startOfWeekDateOnly(dateOnly);
  return dateOnly;
}

function formatPeriodLabel(key, bucket) {
  if (!key) return "";
  if (bucket === "month") return formatMonthLabel(key);
  if (bucket === "week") return formatWeekLabel(key);
  return formatDayLabel(key);
}

function buildPeriodKeys(startDate, endDate, bucket) {
  const keys = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    const key = getPeriodKey(cursor, bucket);
    if (!keys.includes(key)) keys.push(key);
    cursor = addDays(cursor, 1);
  }
  return keys;
}

function resolveMedicationFromItem(item, medicationRowsById) {
  const relation = Array.isArray(item?.tbl_medications) ? item.tbl_medications[0] : item?.tbl_medications;
  const medicationId = toPositiveInt(item?.medication_id ?? item?.log_id);
  if (!medicationId) return null;

  return {
    medication_id: medicationId,
    medication_name:
      relation?.medication_name ||
      medicationRowsById.get(medicationId)?.medication_name ||
      `Medication #${medicationId}`,
  };
}

function mapMedicationInventoryRows(rows) {
  return (rows || []).map((row) => {
    const inventory = Array.isArray(row?.tbl_inventory) ? row.tbl_inventory[0] : row?.tbl_inventory;
    return {
      medication_id: Number(row.medication_id),
      medication_name: row.medication_name || `Medication #${row.medication_id}`,
      reorder_threshold: Number(row.reorder_threshold || 0),
      current_stock: Number(inventory?.total_stock || 0),
      unit: row.unit || "pcs",
    };
  });
}

function getStartOfWeekFromDateOnly(dateOnly) {
  return startOfWeekDateOnly(dateOnly);
}

function buildRevenueSeries(transactions, granularity) {
  const grouped = new Map();

  for (const transaction of transactions) {
    if (!transaction.date) continue;

    const key =
      granularity === "month"
        ? transaction.date.slice(0, 7)
        : granularity === "week"
          ? getStartOfWeekFromDateOnly(transaction.date)
          : transaction.date;

    incrementGroupedValue(grouped, key, transaction.amount);
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([rawLabel, value]) => ({
      label:
        granularity === "month"
          ? formatMonthLabel(rawLabel)
          : granularity === "week"
            ? formatWeekLabel(rawLabel)
            : formatDayLabel(rawLabel),
      value,
      raw_label: rawLabel,
    }));
}

async function ensureBillExists(billId) {
  try {
    return await getBillById(billId);
  } catch (error) {
    if (error?.code === "PGRST116") {
      throw notFound("Bill not found.");
    }
    throw error;
  }
}

async function ensureBillItemExists(billItemId) {
  try {
    return await getBillItemById(billItemId);
  } catch (error) {
    if (error?.code === "PGRST116") {
      throw notFound("Bill item not found.");
    }
    throw error;
  }
}

function normalizeBillItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.map((item) => {
    const quantity = toPositiveInt(item?.quantity) || 1;
    const unitPrice = toNonNegativeNumber(item?.unit_price);
    const description = normalizeText(item?.description);
    const inputServiceType = normalizeText(item?.service_type);
    const serviceId =
      item?.service_id !== undefined && item?.service_id !== null ? toPositiveInt(item.service_id) : null;
    const medicationId =
      item?.medication_id !== undefined && item?.medication_id !== null
        ? toPositiveInt(item.medication_id)
        : item?.log_id !== undefined && item?.log_id !== null
          ? toPositiveInt(item.log_id)
          : null;

    if (unitPrice === null) {
      throw badRequest("Each item requires a valid non-negative 'unit_price'.");
    }

    if (!serviceId && !medicationId) {
      throw badRequest("Each item requires either 'service_id' or 'medication_id'.");
    }

    return {
      service_id: serviceId,
      medication_id: medicationId,
      service_type: medicationId ? "Medications" : (inputServiceType || null),
      description: description || null,
      quantity,
      unit_price: roundCurrency(unitPrice),
      subtotal: computeSubtotal(quantity, unitPrice),
    };
  });
}

function resolveBillStatus(totalPaid, netAmount) {
  const paid = roundCurrency(totalPaid);
  const net = roundCurrency(netAmount);

  if (paid <= 0) return "Pending";
  if (paid >= net) return "Paid";
  return "Partially Paid";
}

function normalizePaymentInput(payload) {
  const paymentMethod = normalizeText(payload?.payment_method);
  const amountPaid = toNonNegativeNumber(payload?.amount_paid);
  const referenceNumber = normalizeText(payload?.reference_number);
  const paymentDateRaw = normalizeText(payload?.payment_date);
  const paymentDate = paymentDateRaw || new Date().toISOString();
  const notes = normalizeText(payload?.notes);

  if (!paymentMethod) {
    throw badRequest("'payment_method' is required.");
  }
  if (!["Cash", "GCash", "Maya"].includes(paymentMethod)) {
    throw badRequest("'payment_method' must be one of: Cash, GCash, Maya.");
  }

  if (amountPaid === null || amountPaid <= 0) {
    throw badRequest("'amount_paid' must be a positive number.");
  }

  if (isReferenceRequired(paymentMethod) && !referenceNumber) {
    throw badRequest("'reference_number' is required for GCash or Maya payments.");
  }

  const parsedDate = new Date(paymentDate);
  if (Number.isNaN(parsedDate.getTime())) {
    throw badRequest("'payment_date' must be a valid date/time.");
  }

  return {
    payment_method: paymentMethod,
    amount_paid: amountPaid,
    reference_number: referenceNumber || null,
    payment_date: parsedDate.toISOString(),
    notes: notes || null,
  };
}

function parseListParams(query) {
  const page = toPositiveInt(query?.page) || 1;
  const pageSize = toPositiveInt(query?.limit) || toPositiveInt(query?.page_size) || 100;
  const status = normalizeText(query?.status) || null;
  const startDate = normalizeText(query?.start_date) || null;
  const endDate = normalizeText(query?.end_date) || null;

  if (pageSize > 100) {
    throw badRequest("'limit' must not exceed 100.");
  }

  let startIso = null;
  let endIso = null;

  if (startDate) {
    const parsed = new Date(startDate);
    if (Number.isNaN(parsed.getTime())) {
      throw badRequest("'start_date' must be a valid date.");
    }
    startIso = parsed.toISOString();
  }

  if (endDate) {
    const parsed = new Date(endDate);
    if (Number.isNaN(parsed.getTime())) {
      throw badRequest("'end_date' must be a valid date.");
    }
    endIso = parsed.toISOString();
  }

  if (startIso && endIso && new Date(startIso) > new Date(endIso)) {
    throw badRequest("'start_date' must be less than or equal to 'end_date'.");
  }

  return { page, pageSize, status, startIso, endIso };
}

function parseTransactionListParams(query) {
  const page = toPositiveInt(query?.page) || 1;
  const pageSize = toPositiveInt(query?.limit) || toPositiveInt(query?.page_size) || 10;
  const search = normalizeText(query?.search).toLowerCase();
  const method = normalizeText(query?.method);

  if (pageSize > 100) {
    throw badRequest("'limit' must not exceed 100.");
  }

  return {
    page,
    pageSize,
    search,
    method: method && method.toLowerCase() !== "all" ? method : null,
  };
}

async function createBillWithGeneratedCode(payload) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const billCode = await getNextCode("tbl_bills", "bill_code", "BILL");

    try {
      const bill = await createBill({
        ...payload,
        bill_code: billCode,
      });
      return attachBillCreator(bill);
    } catch (error) {
      if (isUniqueConstraintError(error, "tbl_bills_bill_code_key")) {
        continue;
      }
      throw error;
    }
  }

  throw conflict("Unable to generate unique bill code. Please retry.");
}

async function createPaymentWithGeneratedCode(payload) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const paymentCode = await getNextCode("tbl_payments", "payment_code", "PAY");

    try {
      const payment = await createPayment({
        ...payload,
        payment_code: paymentCode,
      });
      return attachPaymentReceiver(payment);
    } catch (error) {
      if (isUniqueConstraintError(error, "tbl_payments_payment_code_key")) {
        continue;
      }
      throw error;
    }
  }

  throw conflict("Unable to generate unique payment code. Please retry.");
}

async function createBillFlow(payload, currentUserId = null) {
  const rawPatientId = payload?.patient_id;
  const hasPatientId = rawPatientId !== undefined && rawPatientId !== null && String(rawPatientId).trim() !== "";
  const patientId = hasPatientId ? String(rawPatientId).trim() : null;
  if (hasPatientId && !patientId) {
    throw badRequest("'patient_id' is required when provided.");
  }

  let resolvedPatientUuid = null;
  if (patientId) {
    resolvedPatientUuid = await findPatientUuidByIdentifier(patientId);
    if (!resolvedPatientUuid) {
      throw badRequest("Invalid 'patient_id'. Patient does not exist.");
    }
  }

  const normalizedItems = normalizeBillItems(payload?.items);
  const itemDerivedBreakdown = normalizedItems.reduce(
    (acc, item) => {
      const bucket = classifyServiceSubtotal(item);
      return {
        medications: roundCurrency(acc.medications + bucket.medications),
        laboratory: roundCurrency(acc.laboratory + bucket.laboratory),
        miscellaneous: roundCurrency(acc.miscellaneous + bucket.miscellaneous),
        professional_fee: roundCurrency(acc.professional_fee + bucket.professional_fee),
      };
    },
    { medications: 0, laboratory: 0, miscellaneous: 0, professional_fee: 0 }
  );

  const subtotalMedications = toNonNegativeNumber(payload?.subtotal_medications)
    ?? (itemDerivedBreakdown.medications || 0);
  const subtotalLaboratory = toNonNegativeNumber(payload?.subtotal_laboratory)
    ?? (itemDerivedBreakdown.laboratory || 0);
  const subtotalMiscellaneous = toNonNegativeNumber(payload?.subtotal_miscellaneous)
    ?? (itemDerivedBreakdown.miscellaneous || 0);
  const subtotalRoomCharge = toNonNegativeNumber(payload?.subtotal_room_charge) ?? 0;
  const subtotalProfessionalFee = toNonNegativeNumber(payload?.subtotal_professional_fee)
    ?? (itemDerivedBreakdown.professional_fee || 0);
  const requestedSeniorCitizen = payload?.is_senior_citizen === true;
  const requestedPwd = payload?.is_pwd === true;
  const isSeniorCitizen = requestedSeniorCitizen;
  const isPwd = !requestedSeniorCitizen && requestedPwd;
  const discountType = isSeniorCitizen ? "Senior Citizen" : isPwd ? "PWD" : "None";
  const discountRate = isSeniorCitizen || isPwd ? 0.2 : 0;

  const group1TotalComputed = roundCurrency(subtotalMedications + subtotalLaboratory + subtotalMiscellaneous);
  const group1Total = toNonNegativeNumber(payload?.group1_total) ?? group1TotalComputed;
  const group2TotalComputed = roundCurrency(subtotalRoomCharge + subtotalProfessionalFee);
  const group2Total = toNonNegativeNumber(payload?.group2_total) ?? group2TotalComputed;
  const totalAmount = roundCurrency(group1Total + group2Total);
  const lessAmount = roundCurrency(totalAmount * discountRate);
  const finalNetAmount = roundCurrency(Math.max(0, totalAmount - lessAmount));

  let bill = null;
  let itemsInserted = false;

  try {
    bill = await createBillWithGeneratedCode({
      patient_id: resolvedPatientUuid,
      created_by: currentUserId,
      doctor_in_charge: toNullableText(payload?.doctor_in_charge),
      final_diagnosis: toNullableText(payload?.final_diagnosis),
      admission_datetime: toNullableText(payload?.admission_datetime),
      discharge_datetime: toNullableText(payload?.discharge_datetime),
      referred_by: toNullableText(payload?.referred_by),
      discharge_status: toNullableText(payload?.discharge_status),
      subtotal_medications: subtotalMedications,
      subtotal_laboratory: subtotalLaboratory,
      subtotal_miscellaneous: subtotalMiscellaneous,
      subtotal_room_charge: subtotalRoomCharge,
      subtotal_professional_fee: subtotalProfessionalFee,
      is_senior_citizen: isSeniorCitizen,
      is_pwd: isPwd,
      discount_type: discountType,
      discount_rate: discountRate,
      less_amount: lessAmount,
      group1_total: group1Total,
      group2_total: group2Total,
      total_amount: totalAmount,
      net_amount: finalNetAmount,
      status: "Pending",
    });

    const itemRows = normalizedItems.map((item) => ({ ...item, bill_id: bill.bill_id }));
    const items = itemRows.length ? await createBillItems(itemRows) : [];
    itemsInserted = itemRows.length > 0;

    return {
      bill,
      items,
    };
  } catch (error) {
    try {
      if (bill?.bill_id && itemsInserted) {
        await deleteBillItemsByBillId(bill.bill_id);
      }
      if (bill?.bill_id) {
        await deleteBillById(bill.bill_id);
      }
    } catch {
      // Best-effort rollback.
    }

    if (error?.code === "23503" && error?.constraint === "tbl_bills_patient_id_fkey") {
      throw badRequest("Invalid 'patient_id'. Patient does not exist.");
    }

    throw error;
  }
}

async function refreshBillTotals(billId) {
  const bill = await ensureBillExists(billId);
  const items = await getBillItemsByBillId(billId);
  const itemDerivedBreakdown = items.reduce(
    (acc, item) => {
      const bucket = classifyServiceSubtotal(item);
      return {
        medications: roundCurrency(acc.medications + bucket.medications),
        laboratory: roundCurrency(acc.laboratory + bucket.laboratory),
        miscellaneous: roundCurrency(acc.miscellaneous + bucket.miscellaneous),
        professional_fee: roundCurrency(acc.professional_fee + bucket.professional_fee),
      };
    },
    { medications: 0, laboratory: 0, miscellaneous: 0, professional_fee: 0 }
  );
  const subtotalMedications = roundCurrency(itemDerivedBreakdown.medications);
  const subtotalLaboratory = roundCurrency(itemDerivedBreakdown.laboratory);
  const subtotalMiscellaneous = roundCurrency(itemDerivedBreakdown.miscellaneous);
  const subtotalRoomCharge = roundCurrency(Number(bill.subtotal_room_charge || 0));
  const subtotalProfessionalFee = roundCurrency(
    Number(itemDerivedBreakdown.professional_fee || bill.subtotal_professional_fee || 0)
  );
  const lessAmount = roundCurrency(Number(bill.less_amount || 0));
  const group1Total = roundCurrency(subtotalMedications + subtotalLaboratory + subtotalMiscellaneous);
  const group1Net = roundCurrency(Math.max(0, group1Total - lessAmount));
  const group2Total = roundCurrency(subtotalRoomCharge + subtotalProfessionalFee);
  const netAmount = roundCurrency(group1Net + group2Total);

  const payments = await getPaymentsByBillId(billId);
  const totalPaid = roundCurrency(payments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0));
  const nextStatus = resolveBillStatus(totalPaid, netAmount);

  return updateBillById(billId, {
    subtotal_medications: subtotalMedications,
    subtotal_laboratory: subtotalLaboratory,
    subtotal_miscellaneous: subtotalMiscellaneous,
    subtotal_room_charge: subtotalRoomCharge,
    subtotal_professional_fee: subtotalProfessionalFee,
    less_amount: lessAmount,
    group1_total: group1Total,
    group2_total: group2Total,
    total_amount: netAmount,
    net_amount: netAmount,
    status: nextStatus,
  });
}

async function rollbackPaidMedicationDeductions(state) {
  for (const snapshot of [...state.inventorySnapshots].reverse()) {
    try {
      await updateInventoryByMedicationId(snapshot.medication_id, {
        total_stock: snapshot.total_stock,
        status: snapshot.status,
        last_updated: snapshot.last_updated || new Date().toISOString(),
      });
    } catch {
      // Best-effort rollback.
    }
  }

  for (const updatedItem of [...state.updatedBillItems].reverse()) {
    try {
      await updateBillItemById(updatedItem.bill_item_id, {
        log_id: updatedItem.previous_log_id,
      });
    } catch {
      // Best-effort rollback.
    }
  }

  for (const logId of [...state.insertedLogIds].reverse()) {
    try {
      await deletePrescriptionUsageLogById(logId);
    } catch {
      // Best-effort rollback.
    }
  }

  for (const batch of [...state.batchSnapshots].reverse()) {
    try {
      await updateBatchById(batch.batch_id, {
        quantity: batch.previous_quantity,
      });
    } catch {
      // Best-effort rollback.
    }
  }
}

async function applyPaidMedicationDeductionsForBill({ billId, billCode }) {
  const medicationItems = (await listMedicationBillItemsByBillId(billId)).filter(
    (item) => isMedicationServiceType(item?.service_type) || Boolean(toPositiveInt(item?.medication_id))
  );

  if (!medicationItems.length) {
    return null;
  }

  const rollbackState = {
    batchSnapshots: [],
    insertedLogIds: [],
    updatedBillItems: [],
    inventorySnapshots: [],
  };

  try {
    const affectedMedicationIds = new Set();

    for (const item of medicationItems) {
      const medicationId = toPositiveInt(item?.medication_id);
      const quantityRequired = toPositiveInt(item?.quantity) || 0;

      if (!medicationId || quantityRequired <= 0) {
        continue;
      }

      affectedMedicationIds.add(medicationId);

      const medication = await getMedicationById(medicationId);
      const medicationName = normalizeText(medication?.medication_name) || `Medication #${medicationId}`;
      const availableBatches = await listAvailableBatchesByMedicationId(medicationId);
      const selectedBatch = availableBatches[0] || null;

      if (!selectedBatch || Number(selectedBatch.quantity || 0) < quantityRequired) {
        throw conflict(`Insufficient stock for ${medicationName}. Please update inventory before marking as Paid.`);
      }

      rollbackState.batchSnapshots.push({
        batch_id: selectedBatch.batch_id,
        previous_quantity: Number(selectedBatch.quantity || 0),
      });

      const nextBatchQty = Number(selectedBatch.quantity || 0) - quantityRequired;
      await updateBatchById(selectedBatch.batch_id, {
        quantity: nextBatchQty,
      });

      const usageLog = await createPrescriptionUsageLog({
        medication_id: medicationId,
        batch_id: selectedBatch.batch_id,
        quantity_dispensed: quantityRequired,
        dispensed_at: new Date().toISOString(),
        reference_number: billCode,
      });

      rollbackState.insertedLogIds.push(usageLog.log_id);
      rollbackState.updatedBillItems.push({
        bill_item_id: item.bill_item_id,
        previous_log_id: item.log_id ?? null,
      });

      await updateBillItemById(item.bill_item_id, {
        log_id: usageLog.log_id,
      });
    }

    for (const medicationId of affectedMedicationIds) {
      const [totalStockFromBatches, medication, inventory] = await Promise.all([
        getBatchStockTotalByMedicationId(medicationId),
        getMedicationById(medicationId),
        getInventoryByMedicationId(medicationId),
      ]);

      rollbackState.inventorySnapshots.push({
        medication_id: medicationId,
        total_stock: Number(inventory?.total_stock || 0),
        status: inventory?.status || "Adequate",
        last_updated: inventory?.last_updated || null,
      });

      const reorderThreshold = Number(medication?.reorder_threshold || 0);
      const nextTotalStock = Number(totalStockFromBatches || 0);
      await updateInventoryByMedicationId(medicationId, {
        total_stock: nextTotalStock,
        status: deriveInventoryStatusForPaidFlow(nextTotalStock, reorderThreshold),
        last_updated: new Date().toISOString(),
      });
    }

    return rollbackState;
  } catch (error) {
    await rollbackPaidMedicationDeductions(rollbackState);
    throw error;
  }
}

function parsePatientListParams(query) {
  const search = normalizeText(query?.search);
  const limit = toPositiveInt(query?.limit) || 20;
  if (limit > 100) {
    throw badRequest("'limit' must not exceed 100.");
  }
  return { search, limit };
}

async function addBillItemFlow(billId, payload) {
  const numericBillId = toPositiveInt(billId);
  if (!numericBillId) {
    throw badRequest("'billId' must be a positive integer.");
  }

  const bill = await ensureBillExists(numericBillId);
  if (bill.status === "Cancelled") {
    throw conflict("Cannot add item to a cancelled bill.");
  }

  const quantity = toPositiveInt(payload?.quantity) || 1;
  const unitPrice = toNonNegativeNumber(payload?.unit_price);
  if (unitPrice === null) {
    throw badRequest("'unit_price' must be a non-negative number.");
  }

  const row = {
    bill_id: numericBillId,
    service_id: payload?.service_id !== undefined && payload?.service_id !== null ? toPositiveInt(payload.service_id) : null,
    medication_id:
      payload?.medication_id !== undefined && payload?.medication_id !== null
        ? toPositiveInt(payload.medication_id)
        : payload?.log_id !== undefined && payload?.log_id !== null
          ? toPositiveInt(payload.log_id)
          : null,
    description: normalizeText(payload?.description) || null,
    service_type: payload?.medication_id !== undefined && payload?.medication_id !== null
      ? "Medications"
      : (normalizeText(payload?.service_type) || null),
    quantity,
    unit_price: roundCurrency(unitPrice),
    subtotal: computeSubtotal(quantity, unitPrice),
  };

  if (!row.service_id && !row.medication_id) {
    throw badRequest("Bill item requires either 'service_id' or 'medication_id'.");
  }

  let item = null;

  try {
    item = await createBillItem(row);
    const updatedBill = await refreshBillTotals(numericBillId);

    return {
      item,
      bill: updatedBill,
    };
  } catch (error) {
    try {
      if (item?.bill_item_id) {
        await deleteBillItemById(item.bill_item_id);
      }
    } catch {
      // Best-effort rollback.
    }

    throw error;
  }
}

async function updateBillItemFlow(billId, billItemId, payload) {
  const numericBillId = toPositiveInt(billId);
  const numericBillItemId = toPositiveInt(billItemId);

  if (!numericBillId) {
    throw badRequest("'billId' must be a positive integer.");
  }

  if (!numericBillItemId) {
    throw badRequest("'billItemId' must be a positive integer.");
  }

  const bill = await ensureBillExists(numericBillId);
  if (bill.status === "Cancelled") {
    throw conflict("Cannot update item on a cancelled bill.");
  }

  const existingItem = await ensureBillItemExists(numericBillItemId);
  if (existingItem.bill_id !== numericBillId) {
    throw badRequest("Bill item does not belong to the bill.");
  }

  const quantity = payload?.quantity !== undefined ? toPositiveInt(payload.quantity) : Number(existingItem.quantity || 1);
  const unitPrice = payload?.unit_price !== undefined
    ? toNonNegativeNumber(payload.unit_price)
    : roundCurrency(Number(existingItem.unit_price || 0));

  if (!quantity) {
    throw badRequest("'quantity' must be a positive integer.");
  }

  if (unitPrice === null) {
    throw badRequest("'unit_price' must be a non-negative number.");
  }

  const description = payload?.description !== undefined ? normalizeText(payload.description) || null : existingItem.description;
  const subtotal = computeSubtotal(quantity, unitPrice);

  let updatedItem = null;

  try {
    const existingMedicationId = toPositiveInt(existingItem.medication_id ?? existingItem.log_id);
    const nextMedicationId = payload?.medication_id !== undefined || payload?.log_id !== undefined
      ? (payload.medication_id !== undefined
          ? (payload.medication_id !== null ? toPositiveInt(payload.medication_id) : null)
          : (payload.log_id !== null ? toPositiveInt(payload.log_id) : null))
      : existingMedicationId;

    const nextServiceId = payload?.service_id !== undefined
      ? (payload.service_id !== null ? toPositiveInt(payload.service_id) : null)
      : (existingItem.service_id || null);
    const nextServiceType = payload?.service_type !== undefined
      ? (normalizeText(payload.service_type) || null)
      : (existingItem.service_type || null);

    if (!nextServiceId && !nextMedicationId) {
      throw badRequest("Bill item requires either 'service_id' or 'medication_id'.");
    }

    updatedItem = await updateBillItemById(numericBillItemId, {
      service_id: nextServiceId,
      medication_id: nextMedicationId,
      service_type: nextMedicationId ? "Medications" : nextServiceType,
      description,
      quantity,
      unit_price: unitPrice,
      subtotal,
    });

    const updatedBill = await refreshBillTotals(numericBillId);

    return {
      item: updatedItem,
      bill: updatedBill,
    };
  } catch (error) {
    throw error;
  }
}

async function removeBillItemFlow(billId, billItemId) {
  const numericBillId = toPositiveInt(billId);
  const numericBillItemId = toPositiveInt(billItemId);

  if (!numericBillId) {
    throw badRequest("'billId' must be a positive integer.");
  }

  if (!numericBillItemId) {
    throw badRequest("'billItemId' must be a positive integer.");
  }

  const bill = await ensureBillExists(numericBillId);
  if (bill.status === "Cancelled") {
    throw conflict("Cannot remove item from a cancelled bill.");
  }

  const existingItem = await ensureBillItemExists(numericBillItemId);
  if (existingItem.bill_id !== numericBillId) {
    throw badRequest("Bill item does not belong to the bill.");
  }

  try {
    await deleteBillItemById(numericBillItemId);

    const updatedBill = await refreshBillTotals(numericBillId);

    return {
      bill: updatedBill,
    };
  } catch (error) {
    throw error;
  }
}

async function createPaymentFlow(payload, fallbackBillId = null, currentUser = null) {
  const numericBillId = toPositiveInt(payload?.bill_id ?? fallbackBillId);
  if (!numericBillId) {
    throw badRequest("'bill_id' is required and must be a positive integer.");
  }

  const bill = await ensureBillExists(numericBillId);
  if (bill.status === "Cancelled") {
    throw conflict("Cannot record payment for a cancelled bill.");
  }

  const paymentInput = normalizePaymentInput(payload);

  let payment = null;
  let medicationDeductionState = null;

  try {
    payment = await createPaymentWithGeneratedCode({
      bill_id: numericBillId,
      payment_method: paymentInput.payment_method,
      amount_paid: paymentInput.amount_paid,
      reference_number: paymentInput.reference_number,
      payment_date: paymentInput.payment_date,
      received_by: currentUser?.id || null,
      notes: paymentInput.notes,
    });

    const payments = await getPaymentsByBillId(numericBillId);
    const totalPaid = roundCurrency(payments.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0));
    const netAmount = roundCurrency(Number(bill.net_amount || 0));
    const nextStatus = totalPaid >= netAmount ? "Paid" : "Pending";
    const isTransitioningToPaid = bill.status !== "Paid" && nextStatus === "Paid";

    if (isTransitioningToPaid) {
      medicationDeductionState = await applyPaidMedicationDeductionsForBill({
        billId: numericBillId,
        billCode: bill.bill_code || `BILL-${numericBillId}`,
      });
    }

    const updatedBill = await updateBillById(numericBillId, {
      status: nextStatus,
    });

    return {
      payment,
      bill: updatedBill,
      total_paid: totalPaid,
      remaining_balance: roundCurrency(Math.max(0, Number(updatedBill.net_amount || 0) - totalPaid)),
    };
  } catch (error) {
    if (medicationDeductionState) {
      await rollbackPaidMedicationDeductions(medicationDeductionState);
    }

    try {
      if (payment?.payment_id) {
        await deletePaymentById(payment.payment_id);
      }
    } catch {
      // Best-effort rollback.
    }
    throw error;
  }
}

async function cancelBillFlow(billId) {
  const numericBillId = toPositiveInt(billId);
  if (!numericBillId) {
    throw badRequest("'billId' must be a positive integer.");
  }

  await ensureBillExists(numericBillId);

  const paid = await hasAnyPayment(numericBillId);
  if (paid) {
    throw conflict("Cannot cancel bill with existing payments.");
  }

  const updated = await updateBillById(numericBillId, {
    status: "Cancelled",
  });

  return updated;
}

async function markBillPrintedFlow(billId) {
  const numericBillId = toPositiveInt(billId);
  if (!numericBillId) {
    throw badRequest("'billId' must be a positive integer.");
  }

  await ensureBillExists(numericBillId);

  const updated = await updateBillById(numericBillId, {
    is_printed: true,
    printed_at: new Date().toISOString(),
  });

  return updated;
}

async function getBillDetailsFlow(billId) {
  const numericBillId = toPositiveInt(billId);
  if (!numericBillId) {
    throw badRequest("'billId' must be a positive integer.");
  }

  const bill = await ensureBillExists(numericBillId);
  const [items, payments] = await Promise.all([
    getBillItemsByBillId(numericBillId),
    getPaymentsByBillId(numericBillId),
  ]);
  const hydratedBill = await attachBillCreator(bill);
  const hydratedPayments = await attachPaymentReceivers(payments);

  const totalPaid = roundCurrency(payments.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0));
  const remainingBalance = roundCurrency(Math.max(0, Number(bill.net_amount || 0) - totalPaid));

  return {
    bill: hydratedBill,
    items,
    payments: hydratedPayments,
    total_paid: totalPaid,
    remaining_balance: remainingBalance,
  };
}

async function listBillsFlow(query) {
  const params = parseListParams(query);

  const billIds = params.startIso || params.endIso
    ? await listBillIdsByItemDateRange(params.startIso, params.endIso)
    : null;

  const { rows, total } = await listBillsFiltered({
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
    billIds,
  });

  const ids = rows.map((row) => row.bill_id);
  const payments = await listPaymentsForBills(ids);

  const paymentsByBillId = new Map();
  for (const payment of payments) {
    if (!paymentsByBillId.has(payment.bill_id)) {
      paymentsByBillId.set(payment.bill_id, []);
    }
    paymentsByBillId.get(payment.bill_id).push(payment);
  }

  const enriched = rows.map((bill) => {
    const billPayments = paymentsByBillId.get(bill.bill_id) || [];
    const totalPaid = roundCurrency(billPayments.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0));
    const remainingBalance = roundCurrency(Math.max(0, Number(bill.net_amount || 0) - totalPaid));

    return {
      ...bill,
      total_paid: totalPaid,
      remaining_balance: remainingBalance,
    };
  });

  return buildPagedResult(enriched, params.page, params.pageSize, total);
}

async function getBillingAnalyticsFlow() {
  const [bills, payments] = await Promise.all([fetchAnalyticsBills(), fetchAnalyticsPayments()]);

  const totalPendingBills = bills.filter((bill) => bill.status === "Pending").length;
  const totalPaidBills = bills.filter((bill) => bill.status === "Paid").length;

  const totalRevenue = roundCurrency(
    payments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0)
  );

  const paidByBillId = new Map();
  for (const payment of payments) {
    const current = paidByBillId.get(payment.bill_id) || 0;
    paidByBillId.set(payment.bill_id, current + Number(payment.amount_paid || 0));
  }

  const totalOutstandingBalance = roundCurrency(
    bills
      .filter((bill) => bill.status !== "Cancelled")
      .reduce((sum, bill) => {
        const paid = Number(paidByBillId.get(bill.bill_id) || 0);
        const remaining = Number(bill.net_amount || 0) - paid;
        return sum + Math.max(remaining, 0);
      }, 0)
  );

  const averageBillAmount = bills.length
    ? roundCurrency(bills.reduce((sum, bill) => sum + Number(bill.net_amount || 0), 0) / bills.length)
    : 0;

  return {
  total_pending_bills: totalPendingBills,
  total_paid_bills: totalPaidBills,
  total_transactions: payments.length,
  total_revenue: totalRevenue,
  total_outstanding_balance: totalOutstandingBalance,
  average_bill_amount: averageBillAmount,
  payments: payments.map((p) => ({
    bill_id: p.bill_id,
    amount: Number(p.amount_paid || 0),
    date: p.payment_date ? new Date(p.payment_date).toISOString().slice(0, 10) : null,
    method: p.payment_method || '-',
    status: 'Paid',
  })),
};
}

async function listBillingTransactionsFlow(query) {
  const params = parseTransactionListParams(query);
  const rows = await fetchPaymentsWithBillContext();
  const hydratedRows = await attachPaymentReceivers(rows);

  const allTransactions = hydratedRows
    .map(toTransactionRecord)
    .filter((row) => row.amount > 0)
    .sort((a, b) => new Date(b.paid_at || 0).getTime() - new Date(a.paid_at || 0).getTime());

  const filtered = allTransactions.filter((row) => {
    const matchesMethod = !params.method || row.method === params.method;
    if (!matchesMethod) return false;

    if (!params.search) return true;

    const haystack = [
      row.bill_code,
      row.payment_code,
      row.patient_name,
      row.method,
      row.reference_number,
      `RCT-${row.bill_code}`,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(params.search);
  });

  const totalRevenue = roundCurrency(allTransactions.reduce((sum, row) => sum + row.amount, 0));
  const cashCount = allTransactions.filter((row) => row.method === "Cash").length;
  const digitalCount = allTransactions.filter((row) => row.method === "GCash" || row.method === "Maya").length;

  const from = (params.page - 1) * params.pageSize;
  const pagedRows = filtered.slice(from, from + params.pageSize);

  return {
    ...buildPagedResult(pagedRows, params.page, params.pageSize, filtered.length),
    summary: {
      total_transactions: allTransactions.length,
      total_revenue: totalRevenue,
      cash_count: cashCount,
      digital_count: digitalCount,
    },
  };
}

async function getBillingReportsOverviewFlow(query = {}) {
  const range = parseReportRange(query);
  const [bills, paymentRows, billItemRows] = await Promise.all([
    fetchAnalyticsBills(),
    fetchPaymentsWithBillContext(),
    fetchBillItemsForReports(),
  ]);
  const hydratedPaymentRows = await attachPaymentReceivers(paymentRows);

  const transactions = hydratedPaymentRows
    .map(toTransactionRecord)
    .filter((row) => row.amount > 0)
    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

  const paymentsByBillId = buildPaymentsByBillId(paymentRows);
  const filteredTransactions = transactions.filter((transaction) =>
    isDateWithinRange(transaction.date, range.startDate, range.endDate)
  );
  const previousTransactions = transactions.filter((transaction) =>
    isDateWithinRange(transaction.date, range.previousStartDate, range.previousEndDate)
  );
  const filteredBills = bills.filter((bill) =>
    isDateWithinRange(getBillActivityDate(bill), range.startDate, range.endDate)
  );
  const previousBills = bills.filter((bill) =>
    isDateWithinRange(getBillActivityDate(bill), range.previousStartDate, range.previousEndDate)
  );

  const analytics = buildReportAnalytics(filteredBills, filteredTransactions, paymentsByBillId);
  const previousAnalytics = buildReportAnalytics(previousBills, previousTransactions, paymentsByBillId);
  const revenueByMethodMap = new Map();

  for (const transaction of filteredTransactions) {
    incrementGroupedValue(revenueByMethodMap, transaction.method, transaction.amount);
  }

  const revenueByServiceMap = new Map();
  const filteredBillIds = new Set(filteredTransactions.map((transaction) => transaction.bill_id));
  for (const item of billItemRows) {
    const bill = Array.isArray(item?.tbl_bills) ? item.tbl_bills[0] : item?.tbl_bills;
    if (bill?.status !== "Paid" || !filteredBillIds.has(item.bill_id)) continue;

    const label = resolveServiceBucketLabel(item);
    incrementGroupedValue(revenueByServiceMap, label, Number(item?.subtotal || 0));
  }

  const chartGranularity = getChartGranularity(range.daySpan);

  return {
    analytics,
    comparison_analytics: previousAnalytics,
    date_range: {
      preset: range.preset,
      start_date: range.startDate,
      end_date: range.endDate,
      previous_start_date: range.previousStartDate,
      previous_end_date: range.previousEndDate,
      label: range.label,
      granularity: chartGranularity,
    },
    charts: {
      revenue_by_period: buildRevenueSeries(filteredTransactions, chartGranularity),
      revenue_by_date: buildRevenueSeries(filteredTransactions, "day").slice(-Math.min(range.daySpan, 14)),
      revenue_by_method: [...revenueByMethodMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, value]) => ({ label, value })),
      revenue_by_service: [...revenueByServiceMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, value]) => ({ label, value })),
    },
    trends: {
      total_revenue_pct: percentageChange(analytics.total_revenue, previousAnalytics.total_revenue),
      total_transactions_pct: percentageChange(analytics.total_transactions, previousAnalytics.total_transactions),
      total_outstanding_balance_pct: percentageChange(
        analytics.total_outstanding_balance,
        previousAnalytics.total_outstanding_balance
      ),
      average_bill_amount_pct: percentageChange(analytics.average_bill_amount, previousAnalytics.average_bill_amount),
    },
    recent_transactions: [...filteredTransactions]
      .sort((a, b) => new Date(b.paid_at || 0).getTime() - new Date(a.paid_at || 0).getTime())
      .slice(0, 5),
  };
}

async function getReportsSummaryFlow(query = {}) {
  const range = parseReportRange(query);
  const [billItems, inventoryRows, batchRows] = await Promise.all([
    fetchBillItemsForReports(),
    fetchMedicationInventoryForReports(),
    fetchBatchesForReports(),
  ]);

  const medicationRows = mapMedicationInventoryRows(inventoryRows);
  const medicationRowsById = new Map(medicationRows.map((row) => [row.medication_id, row]));
  const filteredMedicationItems = (billItems || []).filter((item) => {
    const bill = Array.isArray(item?.tbl_bills) ? item.tbl_bills[0] : item?.tbl_bills;
    if (bill?.status === "Cancelled") return false;
    const createdDate = toIsoDateOnly(item?.created_at);
    if (!isDateWithinRange(createdDate, range.startDate, range.endDate)) return false;
    return Boolean(toPositiveInt(item?.medication_id ?? item?.log_id));
  });

  const usageByMedication = new Map();
  for (const item of filteredMedicationItems) {
    const medication = resolveMedicationFromItem(item, medicationRowsById);
    if (!medication) continue;
    const qty = Number(item?.quantity || 0);
    const revenue = Number(item?.subtotal || qty * Number(item?.unit_price || 0) || 0);
    const current = usageByMedication.get(medication.medication_id) || { ...medication, qty: 0, revenue: 0 };
    current.qty += qty;
    current.revenue += revenue;
    usageByMedication.set(medication.medication_id, current);
  }

  const avgDailyUsageByMedication = new Map();
  for (const entry of usageByMedication.values()) {
    avgDailyUsageByMedication.set(entry.medication_id, entry.qty / Math.max(range.daySpan, 1));
  }

  const stockoutAlerts = medicationRows.filter((row) => {
    const avgDaily = avgDailyUsageByMedication.get(row.medication_id) || 0;
    if (avgDaily <= 0) return false;
    const daysLeft = row.current_stock / avgDaily;
    return Number.isFinite(daysLeft) && daysLeft < 7;
  }).length;

  const previousStart = range.previousStartDate;
  const previousEnd = range.previousEndDate;
  const currentQtyByMedication = new Map();
  const previousQtyByMedication = new Map();

  for (const item of billItems || []) {
    const bill = Array.isArray(item?.tbl_bills) ? item.tbl_bills[0] : item?.tbl_bills;
    if (bill?.status === "Cancelled") continue;
    const medication = resolveMedicationFromItem(item, medicationRowsById);
    if (!medication) continue;
    const qty = Number(item?.quantity || 0);
    const createdDate = toIsoDateOnly(item?.created_at);
    if (isDateWithinRange(createdDate, range.startDate, range.endDate)) {
      currentQtyByMedication.set(medication.medication_id, (currentQtyByMedication.get(medication.medication_id) || 0) + qty);
    }
    if (isDateWithinRange(createdDate, previousStart, previousEnd)) {
      previousQtyByMedication.set(medication.medication_id, (previousQtyByMedication.get(medication.medication_id) || 0) + qty);
    }
  }

  let demandSpikes = 0;
  for (const [medId, currentQty] of currentQtyByMedication.entries()) {
    const prevQty = previousQtyByMedication.get(medId) || 0;
    if (currentQty < 10) continue;
    if (prevQty <= 0 && currentQty > 0) {
      demandSpikes += 1;
      continue;
    }
    const growth = ((currentQty - prevQty) / prevQty) * 100;
    if (growth >= 25) demandSpikes += 1;
  }

  const nowDate = getTodayDateOnly();
  const nearExpiryCutoff = addDays(nowDate, 30);
  let expiryValueAtRisk = 0;
  for (const batch of batchRows || []) {
    const expiryDate = toIsoDateOnly(batch?.expiry_date);
    const qty = Number(batch?.quantity || 0);
    if (!expiryDate || qty <= 0) continue;
    if (expiryDate < nowDate || expiryDate > nearExpiryCutoff) continue;
    expiryValueAtRisk += qty * Number(batch?.unit_price || 0);
  }

  const topMedicationByRevenue = [...usageByMedication.values()].sort((a, b) => b.revenue - a.revenue)[0] || null;

  return {
    range: {
      start_date: range.startDate,
      end_date: range.endDate,
      label: range.label,
    },
    insights: {
      stockout_alerts_next_7_days: stockoutAlerts,
      demand_spikes_wow: demandSpikes,
      expiry_value_at_risk: roundCurrency(expiryValueAtRisk),
      top_medication_by_revenue: topMedicationByRevenue
        ? {
            medication_id: topMedicationByRevenue.medication_id,
            medication_name: topMedicationByRevenue.medication_name,
            revenue: roundCurrency(topMedicationByRevenue.revenue),
          }
        : null,
    },
  };
}

async function getMedicationDemandTrendFlow(query = {}) {
  const range = parseReportRange(query);
  const scope = parseReportsScope(query);
  const [billItems, inventoryRows] = await Promise.all([fetchBillItemsForReports(), fetchMedicationInventoryForReports()]);
  const medicationRows = mapMedicationInventoryRows(inventoryRows);
  const medicationRowsById = new Map(medicationRows.map((row) => [row.medication_id, row]));

  const filtered = (billItems || []).filter((item) => {
    const bill = Array.isArray(item?.tbl_bills) ? item.tbl_bills[0] : item?.tbl_bills;
    if (bill?.status === "Cancelled") return false;
    const dateOnly = toIsoDateOnly(item?.created_at);
    if (!isDateWithinRange(dateOnly, range.startDate, range.endDate)) return false;
    const medId = toPositiveInt(item?.medication_id ?? item?.log_id);
    if (!medId) return false;
    if (scope.scope === "single" && scope.medicationId && medId !== scope.medicationId) return false;
    return true;
  });

  const totalsByMedication = new Map();
  for (const item of filtered) {
    const medication = resolveMedicationFromItem(item, medicationRowsById);
    if (!medication) continue;
    const qty = Number(item?.quantity || 0);
    totalsByMedication.set(medication.medication_id, (totalsByMedication.get(medication.medication_id) || 0) + qty);
  }

  let selectedMedicationIds = [...totalsByMedication.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([medicationId]) => medicationId);

  if (scope.scope === "top5") {
    selectedMedicationIds = selectedMedicationIds.slice(0, scope.topN);
  } else if (scope.scope === "all") {
    selectedMedicationIds = selectedMedicationIds.slice(0, 12);
  } else if (scope.scope === "single" && scope.medicationId) {
    selectedMedicationIds = [scope.medicationId];
  }

  const periodKeys = buildPeriodKeys(range.startDate, range.endDate, scope.bucket);
  const seriesMap = new Map();
  for (const medicationId of selectedMedicationIds) {
    seriesMap.set(medicationId, new Map(periodKeys.map((key) => [key, 0])));
  }

  for (const item of filtered) {
    const medId = toPositiveInt(item?.medication_id ?? item?.log_id);
    if (!medId || !seriesMap.has(medId)) continue;
    const dateOnly = toIsoDateOnly(item?.created_at);
    const key = getPeriodKey(dateOnly, scope.bucket);
    const map = seriesMap.get(medId);
    map.set(key, (map.get(key) || 0) + Number(item?.quantity || 0));
  }

  const series = selectedMedicationIds.map((medicationId) => {
    const medicationName = medicationRowsById.get(medicationId)?.medication_name || `Medication #${medicationId}`;
    const values = periodKeys.map((key) => {
      const value = Number(seriesMap.get(medicationId)?.get(key) || 0);
      return {
        key,
        label: formatPeriodLabel(key, scope.bucket),
        value: roundCurrency(value),
      };
    });

    const movingAverage = values.map((_, index) => {
      const window = values.slice(Math.max(0, index - 2), index + 1);
      const avg = window.reduce((sum, point) => sum + point.value, 0) / Math.max(window.length, 1);
      return roundCurrency(avg);
    });

    return {
      medication_id: medicationId,
      medication_name: medicationName,
      points: values,
      moving_average: movingAverage,
      total_quantity: roundCurrency(values.reduce((sum, point) => sum + point.value, 0)),
    };
  });

  return {
    range: {
      start_date: range.startDate,
      end_date: range.endDate,
      label: range.label,
      bucket: scope.bucket,
    },
    series,
  };
}

async function getTopMoversFlow(query = {}) {
  const range = parseReportRange(query);
  const scope = parseReportsScope(query);
  const [billItems, inventoryRows] = await Promise.all([fetchBillItemsForReports(), fetchMedicationInventoryForReports()]);
  const medicationRows = mapMedicationInventoryRows(inventoryRows);
  const medicationRowsById = new Map(medicationRows.map((row) => [row.medication_id, row]));

  const current = new Map();
  const previous = new Map();
  for (const item of billItems || []) {
    const bill = Array.isArray(item?.tbl_bills) ? item.tbl_bills[0] : item?.tbl_bills;
    if (bill?.status === "Cancelled") continue;
    const medId = toPositiveInt(item?.medication_id ?? item?.log_id);
    if (!medId) continue;
    if (scope.scope === "single" && scope.medicationId && medId !== scope.medicationId) continue;
    const qty = Number(item?.quantity || 0);
    const dateOnly = toIsoDateOnly(item?.created_at);
    if (isDateWithinRange(dateOnly, range.startDate, range.endDate)) {
      current.set(medId, (current.get(medId) || 0) + qty);
    } else if (isDateWithinRange(dateOnly, range.previousStartDate, range.previousEndDate)) {
      previous.set(medId, (previous.get(medId) || 0) + qty);
    }
  }

  const allMedicationIds = new Set([...current.keys(), ...previous.keys()]);
  const movers = [...allMedicationIds].map((medId) => {
    const currentQty = Number(current.get(medId) || 0);
    const previousQty = Number(previous.get(medId) || 0);
    const growthPct = previousQty > 0 ? ((currentQty - previousQty) / previousQty) * 100 : currentQty > 0 ? 100 : 0;
    return {
      medication_id: medId,
      medication_name: medicationRowsById.get(medId)?.medication_name || `Medication #${medId}`,
      current_quantity: roundCurrency(currentQty),
      previous_quantity: roundCurrency(previousQty),
      growth_pct: roundCurrency(growthPct),
    };
  });

  const rising = movers.filter((m) => m.growth_pct >= 0).sort((a, b) => b.growth_pct - a.growth_pct).slice(0, scope.limit);
  const falling = movers.filter((m) => m.growth_pct < 0).sort((a, b) => a.growth_pct - b.growth_pct).slice(0, scope.limit);

  return {
    range: {
      start_date: range.startDate,
      end_date: range.endDate,
      previous_start_date: range.previousStartDate,
      previous_end_date: range.previousEndDate,
    },
    rising,
    falling,
  };
}

async function getInventoryRunwayFlow(query = {}) {
  const range = parseReportRange(query);
  const scope = parseReportsScope(query);
  const [inventoryRows, billItems] = await Promise.all([fetchMedicationInventoryForReports(), fetchBillItemsForReports()]);
  const medications = mapMedicationInventoryRows(inventoryRows);

  const usageMap = new Map();
  for (const item of billItems || []) {
    const bill = Array.isArray(item?.tbl_bills) ? item.tbl_bills[0] : item?.tbl_bills;
    if (bill?.status === "Cancelled") continue;
    const medId = toPositiveInt(item?.medication_id ?? item?.log_id);
    if (!medId) continue;
    const dateOnly = toIsoDateOnly(item?.created_at);
    if (!isDateWithinRange(dateOnly, range.startDate, range.endDate)) continue;
    usageMap.set(medId, (usageMap.get(medId) || 0) + Number(item?.quantity || 0));
  }

  let rows = medications.map((medication) => {
    const totalDispensed = Number(usageMap.get(medication.medication_id) || 0);
    const avgDailyUsage = totalDispensed / Math.max(range.daySpan, 1);
    const daysLeft = avgDailyUsage > 0 ? medication.current_stock / avgDailyUsage : null;
    const risk =
      daysLeft === null ? "No Usage Data"
      : daysLeft < 7 ? "High"
      : daysLeft <= 14 ? "Medium"
      : "Low";

    return {
      medication_id: medication.medication_id,
      medication_name: medication.medication_name,
      unit: medication.unit,
      current_stock: roundCurrency(medication.current_stock),
      avg_daily_usage: roundCurrency(avgDailyUsage),
      days_left: daysLeft == null ? null : roundCurrency(daysLeft),
      risk,
      reorder_threshold: roundCurrency(medication.reorder_threshold),
    };
  });

  if (scope.scope === "single" && scope.medicationId) {
    rows = rows.filter((row) => row.medication_id === scope.medicationId);
  }

  rows.sort((a, b) => {
    const score = (risk) => (risk === "High" ? 0 : risk === "Medium" ? 1 : risk === "Low" ? 2 : 3);
    return score(a.risk) - score(b.risk);
  });

  return {
    range: { start_date: range.startDate, end_date: range.endDate },
    items: rows.slice(0, 20),
  };
}

async function getExpiryRiskFlow(query = {}) {
  const range = parseReportRange(query);
  const scope = parseReportsScope(query);
  const [batches, inventoryRows] = await Promise.all([fetchBatchesForReports(), fetchMedicationInventoryForReports()]);
  const medicationRows = mapMedicationInventoryRows(inventoryRows);
  const medicationRowsById = new Map(medicationRows.map((row) => [row.medication_id, row]));
  const today = getTodayDateOnly();
  const nearExpiryCutoff = addDays(today, 30);
  const periodKeys = buildPeriodKeys(range.startDate, range.endDate, scope.bucket);
  const nearExpiryMap = new Map(periodKeys.map((key) => [key, 0]));
  const disposedMap = new Map(periodKeys.map((key) => [key, 0]));
  let atRiskValue = 0;
  let nearExpiryQty = 0;
  let disposedQty = 0;

  for (const batch of batches || []) {
    const medId = Number(batch?.medication_id || 0);
    if (scope.scope === "single" && scope.medicationId && medId !== scope.medicationId) continue;

    const qty = Number(batch?.quantity || 0);
    const unitPrice = Number(batch?.unit_price || 0);
    const expiryDate = toIsoDateOnly(batch?.expiry_date);
    if (expiryDate && qty > 0 && expiryDate >= today && expiryDate <= nearExpiryCutoff) {
      nearExpiryQty += qty;
      atRiskValue += qty * unitPrice;
      const key = getPeriodKey(expiryDate, scope.bucket);
      if (nearExpiryMap.has(key)) {
        nearExpiryMap.set(key, nearExpiryMap.get(key) + qty);
      }
    }

    const disposedQuantity = Number(batch?.disposed_quantity || 0);
    if (disposedQuantity > 0) {
      const disposedDate = toIsoDateOnly(batch?.disposed_at || batch?.updated_at);
      if (isDateWithinRange(disposedDate, range.startDate, range.endDate)) {
        disposedQty += disposedQuantity;
        const key = getPeriodKey(disposedDate, scope.bucket);
        if (disposedMap.has(key)) {
          disposedMap.set(key, disposedMap.get(key) + disposedQuantity);
        }
      }
    }
  }

  return {
    range: { start_date: range.startDate, end_date: range.endDate, bucket: scope.bucket },
    metrics: {
      near_expiry_quantity: roundCurrency(nearExpiryQty),
      disposed_quantity: roundCurrency(disposedQty),
      at_risk_value: roundCurrency(atRiskValue),
    },
    trend: periodKeys.map((key) => ({
      key,
      label: formatPeriodLabel(key, scope.bucket),
      near_expiry_quantity: roundCurrency(nearExpiryMap.get(key) || 0),
      disposed_quantity: roundCurrency(disposedMap.get(key) || 0),
    })),
  };
}

async function getRevenueMixFlow(query = {}) {
  const range = parseReportRange(query);
  const scope = parseReportsScope(query);
  const [billItems, inventoryRows] = await Promise.all([fetchBillItemsForReports(), fetchMedicationInventoryForReports()]);
  const medicationRows = mapMedicationInventoryRows(inventoryRows);
  const medicationRowsById = new Map(medicationRows.map((row) => [row.medication_id, row]));
  const revenueByMedication = new Map();

  for (const item of billItems || []) {
    const bill = Array.isArray(item?.tbl_bills) ? item.tbl_bills[0] : item?.tbl_bills;
    if (bill?.status === "Cancelled") continue;
    const medId = toPositiveInt(item?.medication_id ?? item?.log_id);
    if (!medId) continue;
    if (scope.scope === "single" && scope.medicationId && medId !== scope.medicationId) continue;
    const dateOnly = toIsoDateOnly(item?.created_at);
    if (!isDateWithinRange(dateOnly, range.startDate, range.endDate)) continue;
    const subtotal = Number(item?.subtotal || Number(item?.quantity || 0) * Number(item?.unit_price || 0) || 0);
    revenueByMedication.set(medId, (revenueByMedication.get(medId) || 0) + subtotal);
  }

  const sorted = [...revenueByMedication.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(scope.limit, 15))
    .map(([medicationId, revenue]) => ({
      medication_id: medicationId,
      medication_name: medicationRowsById.get(medicationId)?.medication_name || `Medication #${medicationId}`,
      revenue: roundCurrency(revenue),
    }));

  const total = sorted.reduce((sum, item) => sum + item.revenue, 0);
  let cumulative = 0;
  const items = sorted.map((item) => {
    const share = total > 0 ? (item.revenue / total) * 100 : 0;
    cumulative += share;
    return {
      ...item,
      share_pct: roundCurrency(share),
      cumulative_pct: roundCurrency(cumulative),
    };
  });

  return {
    range: { start_date: range.startDate, end_date: range.endDate },
    total_revenue: roundCurrency(total),
    items,
  };
}

async function getUnitPriceTrendFlow(query = {}) {
  const range = parseReportRange(query);
  const scope = parseReportsScope(query);
  const [batches, billItems, inventoryRows] = await Promise.all([
    fetchBatchesForReports(),
    fetchBillItemsForReports(),
    fetchMedicationInventoryForReports(),
  ]);
  const medicationRows = mapMedicationInventoryRows(inventoryRows);
  const medicationRowsById = new Map(medicationRows.map((row) => [row.medication_id, row]));

  let medicationId = scope.medicationId;
  if (!medicationId) {
    const revenueByMedication = new Map();
    for (const item of billItems || []) {
      const bill = Array.isArray(item?.tbl_bills) ? item.tbl_bills[0] : item?.tbl_bills;
      if (bill?.status === "Cancelled") continue;
      const medId = toPositiveInt(item?.medication_id ?? item?.log_id);
      if (!medId) continue;
      const dateOnly = toIsoDateOnly(item?.created_at);
      if (!isDateWithinRange(dateOnly, range.startDate, range.endDate)) continue;
      const subtotal = Number(item?.subtotal || Number(item?.quantity || 0) * Number(item?.unit_price || 0) || 0);
      revenueByMedication.set(medId, (revenueByMedication.get(medId) || 0) + subtotal);
    }
    medicationId = [...revenueByMedication.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  if (!medicationId) {
    return {
      range: { start_date: range.startDate, end_date: range.endDate, bucket: scope.bucket },
      medication: null,
      points: [],
    };
  }

  const periodKeys = buildPeriodKeys(range.startDate, range.endDate, scope.bucket);
  const aggregate = new Map(periodKeys.map((key) => [key, { sum: 0, count: 0 }]));

  for (const batch of batches || []) {
    const medId = Number(batch?.medication_id || 0);
    if (medId !== medicationId) continue;
    const dateOnly = toIsoDateOnly(batch?.received_date || batch?.updated_at);
    if (!isDateWithinRange(dateOnly, range.startDate, range.endDate)) continue;
    const key = getPeriodKey(dateOnly, scope.bucket);
    if (!aggregate.has(key)) continue;
    const unitPrice = Number(batch?.unit_price || 0);
    const qtyWeight = Math.max(1, Number(batch?.quantity || 0));
    const slot = aggregate.get(key);
    slot.sum += unitPrice * qtyWeight;
    slot.count += qtyWeight;
  }

  return {
    range: { start_date: range.startDate, end_date: range.endDate, bucket: scope.bucket },
    medication: {
      medication_id: medicationId,
      medication_name: medicationRowsById.get(medicationId)?.medication_name || `Medication #${medicationId}`,
    },
    points: periodKeys.map((key) => {
      const slot = aggregate.get(key) || { sum: 0, count: 0 };
      const avg = slot.count > 0 ? slot.sum / slot.count : 0;
      return {
        key,
        label: formatPeriodLabel(key, scope.bucket),
        average_unit_price: roundCurrency(avg),
      };
    }),
  };
}

function toPaymentListItem(row) {
  const bill = Array.isArray(row?.tbl_bills) ? row.tbl_bills[0] : row?.tbl_bills;
  const patient = Array.isArray(bill?.tbl_patients) ? bill.tbl_patients[0] : bill?.tbl_patients;
  return {
    payment_id: row.payment_id,
    payment_code: row.payment_code,
    bill_id: row.bill_id,
    payment_method: row.payment_method,
    amount_paid: roundCurrency(Number(row.amount_paid || 0)),
    reference_number: row.reference_number || null,
    payment_date: row.payment_date || null,
    notes: row.notes || null,
    created_at: row.created_at || null,
    bill_code: bill?.bill_code || null,
    patient_first_name: patient?.first_name || null,
    patient_last_name: patient?.last_name || null,
  };
}

async function listPaymentsFlow() {
  const rows = await listPaymentsWithBillPatient();
  const hydratedRows = await attachPaymentReceivers(rows);
  return {
    items: hydratedRows.map(toPaymentListItem),
  };
}

async function listPaymentsByBillIdFlow(billId) {
  const numericBillId = toPositiveInt(billId);
  if (!numericBillId) {
    throw badRequest("'bill_id' must be a positive integer.");
  }
  const rows = await listPaymentsByBillIdWithBillPatient(numericBillId);
  const hydratedRows = await attachPaymentReceivers(rows);
  return {
    items: hydratedRows.map(toPaymentListItem),
  };
}

async function listPatientsFlow(query) {
  const params = parsePatientListParams(query);
  const rows = await listPatients(params);
  return {
    items: rows.map((row) => ({
      patient_id: row.patient_id,
      first_name: row.first_name,
      last_name: row.last_name,
      date_of_birth: row.date_of_birth,
      gender: row.gender,
      contact_number: row.contact_number ?? null,
      email_address: row.email_address ?? null,
      full_name: `${row.first_name} ${row.last_name}`.trim(),
    })),
  };
}

async function createPatientFlow(payload) {
  const firstName = normalizeText(payload?.first_name);
  const lastName = normalizeText(payload?.last_name);
  const dateOfBirth = normalizeText(payload?.date_of_birth);
  const gender = normalizeText(payload?.gender);
  const contactNumber = normalizeText(payload?.contact_number);
  const emailAddress = normalizeText(payload?.email_address);

  if (!firstName) throw badRequest("'first_name' is required.");
  if (!lastName) throw badRequest("'last_name' is required.");
  if (!dateOfBirth) throw badRequest("'date_of_birth' is required.");
  if (!gender) throw badRequest("'gender' is required.");

  const parsedDob = new Date(dateOfBirth);
  if (Number.isNaN(parsedDob.getTime())) {
    throw badRequest("'date_of_birth' must be a valid date.");
  }

  const patient = await createPatient({
    first_name: firstName,
    last_name: lastName,
    date_of_birth: parsedDob.toISOString().slice(0, 10),
    gender,
    contact_number: contactNumber || null,
    email_address: emailAddress || null,
  });

  return {
    patient: {
      ...patient,
      full_name: `${patient.first_name} ${patient.last_name}`.trim(),
    },
  };
}

async function listServiceCatalogFlow() {
  const rows = await listActiveServices();
  const grouped = new Map();

  for (const row of rows) {
    const serviceType = normalizeText(row.service_type) || "Uncategorized";
    if (!grouped.has(serviceType)) {
      grouped.set(serviceType, []);
    }
    grouped.get(serviceType).push({
      id: Number(row.service_id),
      name: row.service_name,
      unitPrice: Number(row.price || 0),
    });
  }

  const items = [...grouped.entries()].map(([category, services], index) => ({
    id: String(index + 1),
    name: category,
    services,
  }));

  return { items };
}

export {
  addBillItemFlow,
  cancelBillFlow,
  markBillPrintedFlow,
  createBillFlow,
  createPaymentFlow,
  getBillDetailsFlow,
  getBillingAnalyticsFlow,
  getBillingReportsOverviewFlow,
  getReportsSummaryFlow,
  getMedicationDemandTrendFlow,
  getTopMoversFlow,
  getInventoryRunwayFlow,
  getExpiryRiskFlow,
  getRevenueMixFlow,
  getUnitPriceTrendFlow,
  listPaymentsFlow,
  listPaymentsByBillIdFlow,
  createPatientFlow,
  listServiceCatalogFlow,
  listBillsFlow,
  listBillingTransactionsFlow,
  listPatientsFlow,
  removeBillItemFlow,
  updateBillItemFlow,
};
