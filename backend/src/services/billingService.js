import {
  createBill,
  createBillItem,
  createBillItems,
  createPayment,
  deleteBillById,
  deleteBillItemById,
  deleteBillItemsByBillId,
  deletePaymentById,
  fetchAnalyticsBills,
  fetchAnalyticsPayments,
  getBillById,
  getBillItemById,
  getBillItemsByBillId,
  getInventoryByMedicationId,
  getMedicationById,
  getNextCode,
  getPaymentsByBillId,
  hasPatientById,
  hasAnyPayment,
  listBillIdsByItemDateRange,
  listBillsFiltered,
  listPaymentsForBills,
  updateBillById,
  updateBillItemById,
  updateInventoryByMedicationId,
} from "../models/billingModel.js";
import {
  buildPagedResult,
  computeBillTotals,
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

function deriveInventoryStatus(totalStock, reorderThreshold) {
  if (totalStock <= 0) return "Critical";
  if (totalStock < reorderThreshold) return "Low";
  return "Adequate";
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
    throw badRequest("'items' must be a non-empty array.");
  }

  return items.map((item) => {
    const quantity = toPositiveInt(item?.quantity) || 1;
    const unitPrice = toNonNegativeNumber(item?.unit_price);
    const description = normalizeText(item?.description);
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
  const receivedBy = normalizeText(payload?.received_by);
  const notes = normalizeText(payload?.notes);

  if (!paymentMethod) {
    throw badRequest("'payment_method' is required.");
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
    received_by: receivedBy || null,
    notes: notes || null,
  };
}

function parseListParams(query) {
  const page = toPositiveInt(query?.page) || 1;
  const pageSize = toPositiveInt(query?.limit) || toPositiveInt(query?.page_size) || 10;
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

async function updateMedicationStock(medicationId, quantityDelta) {
  if (!medicationId || quantityDelta === 0) {
    return null;
  }

  const [medication, inventory] = await Promise.all([
    getMedicationById(medicationId),
    getInventoryByMedicationId(medicationId),
  ]);

  const currentStock = Number(inventory?.total_stock || 0);
  const nextStock = currentStock + quantityDelta;

  if (nextStock < 0) {
    throw conflict(`Insufficient stock for medication #${medicationId}. Available: ${currentStock}.`);
  }

  const nextStatus = deriveInventoryStatus(nextStock, Number(medication?.reorder_threshold || 0));

  await updateInventoryByMedicationId(medicationId, {
    total_stock: nextStock,
    status: nextStatus,
    last_updated: new Date().toISOString(),
  });

  return {
    medication_id: medicationId,
    reverse_delta: -quantityDelta,
  };
}

async function rollbackInventoryAdjustments(adjustments) {
  for (const adjustment of [...adjustments].reverse()) {
    try {
      await updateMedicationStock(adjustment.medication_id, adjustment.reverse_delta);
    } catch {
      // Best-effort rollback.
    }
  }
}

async function applyInventoryForItems(items, direction) {
  const adjustments = [];

  for (const item of items) {
    const medicationId = toPositiveInt(item?.medication_id ?? item?.log_id);
    if (!medicationId) continue;

    const quantity = toPositiveInt(item?.quantity) || 0;
    if (quantity <= 0) continue;

    const adjustment = await updateMedicationStock(medicationId, quantity * direction);
    if (adjustment) {
      adjustments.push(adjustment);
    }
  }

  return adjustments;
}

async function createBillWithGeneratedCode(payload) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const billCode = await getNextCode("tbl_bills", "bill_code", "BILL");

    try {
      return await createBill({
        ...payload,
        bill_code: billCode,
      });
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
      return await createPayment({
        ...payload,
        payment_code: paymentCode,
      });
    } catch (error) {
      if (isUniqueConstraintError(error, "tbl_payments_payment_code_key")) {
        continue;
      }
      throw error;
    }
  }

  throw conflict("Unable to generate unique payment code. Please retry.");
}

async function createBillFlow(payload) {
  const patientId = toPositiveInt(payload?.patient_id);
  const discountAmount = toNonNegativeNumber(payload?.discount_amount) ?? 0;
  const taxAmount = toNonNegativeNumber(payload?.tax_amount) ?? 0;
  const insuranceCoverage = toNonNegativeNumber(payload?.insurance_coverage) ?? 0;

  if (!patientId) {
    throw badRequest("'patient_id' must be a positive integer.");
  }

  const patientExists = await hasPatientById(patientId);
  if (!patientExists) {
    throw badRequest("Invalid 'patient_id'. Patient does not exist.");
  }

  const normalizedItems = normalizeBillItems(payload?.items);
  const totals = computeBillTotals(normalizedItems, discountAmount, insuranceCoverage, taxAmount);

  let bill = null;
  let itemsInserted = false;
  let inventoryAdjustments = [];

  try {
    bill = await createBillWithGeneratedCode({
      patient_id: patientId,
      total_amount: totals.total_amount,
      discount_amount: discountAmount,
      insurance_coverage: insuranceCoverage,
      net_amount: totals.net_amount,
      status: "Pending",
    });

    const itemRows = normalizedItems.map((item) => ({ ...item, bill_id: bill.bill_id }));
    const items = await createBillItems(itemRows);
    itemsInserted = true;

    // Deduct medication stock only after bill and items are saved.
    inventoryAdjustments = await applyInventoryForItems(itemRows, -1);

    return {
      bill,
      items,
    };
  } catch (error) {
    if (inventoryAdjustments.length) {
      await rollbackInventoryAdjustments(inventoryAdjustments);
    }

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
  const totals = computeBillTotals(items, bill.discount_amount, bill.insurance_coverage);

  const payments = await getPaymentsByBillId(billId);
  const totalPaid = roundCurrency(payments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0));
  const nextStatus = resolveBillStatus(totalPaid, totals.net_amount);

  return updateBillById(billId, {
    total_amount: totals.total_amount,
    net_amount: totals.net_amount,
    status: nextStatus,
  });
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
    quantity,
    unit_price: roundCurrency(unitPrice),
    subtotal: computeSubtotal(quantity, unitPrice),
  };

  if (!row.service_id && !row.medication_id) {
    throw badRequest("Bill item requires either 'service_id' or 'medication_id'.");
  }

  let item = null;
  let inventoryAdjustments = [];

  try {
    item = await createBillItem(row);
    inventoryAdjustments = await applyInventoryForItems([item], -1);
    const updatedBill = await refreshBillTotals(numericBillId);

    return {
      item,
      bill: updatedBill,
    };
  } catch (error) {
    if (inventoryAdjustments.length) {
      await rollbackInventoryAdjustments(inventoryAdjustments);
    }

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

  let inventoryAdjustments = [];
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

    if (!nextServiceId && !nextMedicationId) {
      throw badRequest("Bill item requires either 'service_id' or 'medication_id'.");
    }

    if (existingMedicationId && existingMedicationId !== nextMedicationId) {
      inventoryAdjustments.push(await updateMedicationStock(existingMedicationId, Number(existingItem.quantity || 0)));
      inventoryAdjustments = inventoryAdjustments.filter(Boolean);
    }

    if (nextMedicationId) {
      const existingQtyForSameMedication = existingMedicationId === nextMedicationId ? Number(existingItem.quantity || 0) : 0;
      const delta = quantity - existingQtyForSameMedication;
      if (delta !== 0) {
        const adjustment = await updateMedicationStock(nextMedicationId, -delta);
        if (adjustment) {
          inventoryAdjustments.push(adjustment);
        }
      }
    }

    updatedItem = await updateBillItemById(numericBillItemId, {
      service_id: nextServiceId,
      medication_id: nextMedicationId,
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
    if (inventoryAdjustments.length) {
      await rollbackInventoryAdjustments(
        inventoryAdjustments
          .filter(Boolean)
          .map((adjustment) => ({
            medication_id: adjustment.medication_id,
            reverse_delta: adjustment.reverse_delta,
          }))
      );
    }

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

  let inventoryAdjustments = [];

  try {
    const medicationId = toPositiveInt(existingItem.medication_id ?? existingItem.log_id);
    if (medicationId) {
      const adjustment = await updateMedicationStock(medicationId, Number(existingItem.quantity || 0));
      if (adjustment) {
        inventoryAdjustments.push(adjustment);
      }
    }

    await deleteBillItemById(numericBillItemId);

    const updatedBill = await refreshBillTotals(numericBillId);

    return {
      bill: updatedBill,
    };
  } catch (error) {
    if (inventoryAdjustments.length) {
      await rollbackInventoryAdjustments(inventoryAdjustments);
    }

    throw error;
  }
}

async function createPaymentFlow(billId, payload) {
  const numericBillId = toPositiveInt(billId);
  if (!numericBillId) {
    throw badRequest("'billId' must be a positive integer.");
  }

  const bill = await ensureBillExists(numericBillId);
  if (bill.status === "Cancelled") {
    throw conflict("Cannot record payment for a cancelled bill.");
  }

  const paymentInput = normalizePaymentInput(payload);

  let payment = null;

  try {
    payment = await createPaymentWithGeneratedCode({
      bill_id: numericBillId,
      payment_method: paymentInput.payment_method,
      amount_paid: paymentInput.amount_paid,
      reference_number: paymentInput.reference_number,
      payment_date: paymentInput.payment_date,
      received_by: paymentInput.received_by,
      notes: paymentInput.notes,
    });

    const payments = await getPaymentsByBillId(numericBillId);
    const totalPaid = roundCurrency(payments.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0));
    const nextStatus = resolveBillStatus(totalPaid, bill.net_amount);

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

  const totalPaid = roundCurrency(payments.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0));
  const remainingBalance = roundCurrency(Math.max(0, Number(bill.net_amount || 0) - totalPaid));

  return {
    bill,
    items,
    payments,
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
    total_revenue: totalRevenue,
    total_outstanding_balance: totalOutstandingBalance,
    average_bill_amount: averageBillAmount,
  };
}

export {
  addBillItemFlow,
  cancelBillFlow,
  createBillFlow,
  createPaymentFlow,
  getBillDetailsFlow,
  getBillingAnalyticsFlow,
  listBillsFlow,
  removeBillItemFlow,
  updateBillItemFlow,
};
