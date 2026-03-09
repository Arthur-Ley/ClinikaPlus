import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { billingRecords as initialBillingRecords, paymentQueue as initialPaymentQueue } from '../data/mockData';
import { BillingPaymentsContext } from './BillingPaymentsContextObject.ts';

export type BillStatus = 'Pending' | 'Paid' | 'Cancelled';
export type PaymentStatus = 'Pending' | 'Paid' | 'Processing';

export type BillRecord = {
  id: string;
  patient: string;
  date: string;
  total: string;
  status: BillStatus;
  backendBillId?: number;
  patientId?: number;
};

export type PaymentQueueRecord = {
  id: string;
  patient: string;
  amount: number;
  method: string;
  date: string;
  status: PaymentStatus;
  backendBillId?: number;
};

type NewBillInput = {
  id: string;
  patient: string;
  date: string;
  total: string;
  status: BillStatus;
  patientId?: number;
  discountAmount?: number;
  taxAmount?: number;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    serviceId?: number | null;
    logId?: number | null;
  }>;
};

type UpdateBillInput = Partial<Pick<BillRecord, 'patient' | 'date' | 'total' | 'status'>>;

type MarkPaymentPaidInput = {
  id: string;
  method: string;
  reference?: string;
  paidDate?: string;
};

type SetPaymentProcessingInput = {
  id: string;
  method: string;
};

export type BillingPaymentsContextValue = {
  billingRecords: BillRecord[];
  paymentQueue: PaymentQueueRecord[];
  addBill: (bill: NewBillInput) => Promise<void>;
  updateBill: (id: string, updates: UpdateBillInput) => void;
  markPaymentPaid: (input: MarkPaymentPaidInput) => Promise<void>;
  setPaymentProcessing: (input: SetPaymentProcessingInput) => Promise<void>;
};

type BackendBill = {
  bill_id: number;
  bill_code?: string | null;
  patient_id: number;
  tbl_patients?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  total_amount?: number | null;
  net_amount?: number | null;
  status: string;
  remaining_balance?: number | null;
  latest_payment_date?: string | null;
};

type BillsResponse = {
  items?: BackendBill[];
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

function parseAmount(total: string) {
  const parsed = Number(total.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoneyTag(value: number) {
  return `P${Math.round(value).toLocaleString()}`;
}

function toDateOnly(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function toPaymentStatus(status: BillStatus): PaymentStatus {
  return status === 'Paid' ? 'Paid' : 'Pending';
}

function statusCode(status: BillStatus) {
  if (status === 'Paid') return 'PD';
  if (status === 'Cancelled') return 'CN';
  return 'PN';
}

function isFrancoJallorina(name: string) {
  return name.trim().toLowerCase() === 'franco jallorina';
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function extractPositiveInteger(value: string) {
  const match = value.match(/\d+/);
  if (!match) return null;
  return toPositiveInteger(match[0]);
}

function normalizeBillStatus(value: string): BillStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'paid') return 'Paid';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
  return 'Pending';
}

function buildNormalizedBillingRecords(records: BillRecord[]) {
  const statusCounters: Record<BillStatus, number> = {
    Pending: 0,
    Paid: 0,
    Cancelled: 0,
  };
  const idMap = new Map<string, string>();

  const normalizedRecords = records.map((record) => {
    statusCounters[record.status] += 1;
    const sequence = String(statusCounters[record.status]).padStart(4, '0');
    const code = statusCode(record.status);
    const normalizedId = `B-${code}-${sequence}`;
    idMap.set(record.id, normalizedId);
    return { ...record, id: normalizedId };
  });

  return { normalizedRecords, idMap };
}

function mapBackendRows(rows: BackendBill[]) {
  function resolvePatientName(row: BackendBill) {
    const relation = Array.isArray(row.tbl_patients) ? row.tbl_patients[0] : row.tbl_patients;
    const patient = relation && typeof relation === 'object' ? relation : null;
    if (!patient) return `Patient #${row.patient_id}`;

    const fullNameCandidates = [
      patient.full_name,
      patient.patient_name,
      patient.name,
    ];

    for (const value of fullNameCandidates) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    const firstName = typeof patient.first_name === 'string' ? patient.first_name.trim() : '';
    const middleName = typeof patient.middle_name === 'string' ? patient.middle_name.trim() : '';
    const lastName = typeof patient.last_name === 'string' ? patient.last_name.trim() : '';
    const combined = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
    if (combined) return combined;

    return `Patient #${row.patient_id}`;
  }

  const billing = rows.map((row) => {
    const amount = Number(row.net_amount ?? row.total_amount ?? 0);
    return {
      id: String(row.bill_code || `BILL-${row.bill_id}`),
      patient: resolvePatientName(row),
      date: toDateOnly(row.latest_payment_date),
      total: toMoneyTag(amount),
      status: normalizeBillStatus(row.status),
      backendBillId: row.bill_id,
      patientId: row.patient_id,
    } satisfies BillRecord;
  });

  const payment = rows
    .filter((row) => normalizeBillStatus(row.status) !== 'Cancelled')
    .map((row) => {
      const normalizedStatus = normalizeBillStatus(row.status);
      const remaining = Number(row.remaining_balance ?? 0);
      const amount = normalizedStatus === 'Paid' ? Number(row.net_amount ?? row.total_amount ?? 0) : remaining;

      return {
        id: String(row.bill_code || `BILL-${row.bill_id}`),
        patient: resolvePatientName(row),
        amount: amount > 0 ? amount : Number(row.net_amount ?? row.total_amount ?? 0),
        method: '-',
        date: toDateOnly(row.latest_payment_date),
        status: toPaymentStatus(normalizedStatus),
        backendBillId: row.bill_id,
      } satisfies PaymentQueueRecord;
    });

  return {
    billing,
    payment,
  };
}

async function parseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) return payload.error;
  } catch {
    // Fall through to generic message.
  }
  return `Request failed with status ${response.status}.`;
}

export function BillingPaymentsProvider({ children }: { children: ReactNode }) {
  const preparedInitialData = useMemo(() => {
    const sourceBilling = (initialBillingRecords as BillRecord[])
      .map((record) => ({ ...record }))
      .filter((record) => !isFrancoJallorina(record.patient));
    const { normalizedRecords, idMap } = buildNormalizedBillingRecords(sourceBilling);

    const sourcePaymentQueue = (initialPaymentQueue as PaymentQueueRecord[])
      .map((record) => ({ ...record }))
      .filter((record) => !isFrancoJallorina(record.patient))
      .map((record) => ({ ...record, id: idMap.get(record.id) ?? record.id }));

    return {
      billingRecords: normalizedRecords,
      paymentQueue: sourcePaymentQueue,
    };
  }, []);

  const [billingRecords, setBillingRecords] = useState<BillRecord[]>(
    () => preparedInitialData.billingRecords,
  );
  const [paymentQueue, setPaymentQueue] = useState<PaymentQueueRecord[]>(
    () => preparedInitialData.paymentQueue,
  );

  const refreshBillingData = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/billing/bills?page=1&page_size=100`);
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const payload = (await response.json()) as BillsResponse;
    const rows = Array.isArray(payload.items) ? payload.items : [];
    const mapped = mapBackendRows(rows);

    if (mapped.billing.length) {
      setBillingRecords(mapped.billing);
      setPaymentQueue(mapped.payment);
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/billing/bills?page=1&page_size=100`);
        if (!response.ok) return;

        const payload = (await response.json()) as BillsResponse;
        const rows = Array.isArray(payload.items) ? payload.items : [];
        const mapped = mapBackendRows(rows);

        if (!active || !mapped.billing.length) return;
        setBillingRecords(mapped.billing);
        setPaymentQueue(mapped.payment);
      } catch {
        // Keep mock data as fallback when API is unavailable.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const addBill = useCallback(async (bill: NewBillInput) => {
    if (isFrancoJallorina(bill.patient)) {
      return;
    }

    const patientId = toPositiveInteger(bill.patientId);
    const itemRows =
      bill.items?.length
        ? bill.items
            .filter((item) => item.quantity > 0 && item.unitPrice >= 0)
            .map((item) => ({
              description: item.name,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              service_id: item.serviceId ?? null,
              medication_id: item.logId ?? null,
            }))
        : null;

    if (!patientId) {
      throw new Error('Valid numeric Patient ID is required.');
    }

    if (!itemRows?.length) {
      throw new Error('Add at least one service or medication before creating a bill.');
    }

    const response = await fetch(`${API_BASE_URL}/billing/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patientId,
        discount_amount: bill.discountAmount ?? 0,
        tax_amount: bill.taxAmount ?? 0,
        items: itemRows,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    await refreshBillingData();
  }, [refreshBillingData]);

  const updateBill = useCallback((id: string, updates: UpdateBillInput) => {
    let updatedBill: BillRecord | null = null;

    setBillingRecords((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        updatedBill = { ...row, ...updates };
        return updatedBill;
      }),
    );

    if (!updatedBill) return;

    setPaymentQueue((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          patient: updatedBill!.patient,
          amount: parseAmount(updatedBill!.total),
          date: updatedBill!.date,
          status: toPaymentStatus(updatedBill!.status),
        };
      }),
    );
  }, []);

  const setPaymentProcessing = useCallback(async (input: SetPaymentProcessingInput) => {
    setPaymentQueue((prev) =>
      prev.map((row) => {
        if (row.id !== input.id) return row;
        return {
          ...row,
          method: input.method,
          status: 'Processing',
        };
      }),
    );
  }, []);

  const markPaymentPaid = useCallback(async (input: MarkPaymentPaidInput) => {
    const row = paymentQueue.find((item) => item.id === input.id);
    if (!row) {
      throw new Error('Payment record not found.');
    }

    const backendBillId = toPositiveInteger(row.backendBillId) ?? extractPositiveInteger(row.id);
    if (!backendBillId) {
      throw new Error('Unable to resolve bill ID for payment.');
    }

    const response = await fetch(`${API_BASE_URL}/billing/bills/${backendBillId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_method: input.method,
        amount_paid: row.amount,
        reference_number: input.reference || null,
        payment_date: input.paidDate || new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    await refreshBillingData();

    const paidDate = input.paidDate || new Date().toISOString().slice(0, 10);

    setPaymentQueue((prev) =>
      prev.map((item) => {
        if (item.id !== input.id) return item;
        return {
          ...item,
          method: input.method,
          date: paidDate,
          status: 'Paid',
        };
      }),
    );

    setBillingRecords((prev) =>
      prev.map((item) => {
        if (item.id !== input.id) return item;
        return {
          ...item,
          date: paidDate,
          status: 'Paid',
        };
      }),
    );
  }, [paymentQueue, refreshBillingData]);

  const value = useMemo(
    () => ({
      billingRecords,
      paymentQueue,
      addBill,
      updateBill,
      markPaymentPaid,
      setPaymentProcessing,
    }),
    [billingRecords, paymentQueue, addBill, updateBill, markPaymentPaid, setPaymentProcessing],
  );

  return <BillingPaymentsContext.Provider value={value}>{children}</BillingPaymentsContext.Provider>;
}
