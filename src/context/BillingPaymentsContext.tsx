import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  doctorInCharge?: string;
  age?: string;
  gender?: string;
  finalDiagnosis?: string;
  admissionDateTime?: string;
  dischargeDateTime?: string;
  referredBy?: string;
  dischargeStatus?: string;
  isSeniorCitizen?: boolean;
  isPwd?: boolean;
  discountType?: string;
  discountRate?: number;
  subtotalMedications?: number;
  subtotalLaboratory?: number;
  subtotalMiscellaneous?: number;
  lessAmount?: number;
  subtotalRoomCharge?: number;
  subtotalProfessionalFee?: number;
  group1Total?: number;
  group2Total?: number;
  netAmount?: number;
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
  amountPaid: number;
  reference?: string;
  notes?: string;
  paidDate?: string;
};

type SetPaymentProcessingInput = {
  id: string;
  method: string;
};

export type BillingPaymentsContextValue = {
  billingRecords: BillRecord[];
  paymentQueue: PaymentQueueRecord[];
  isLoading: boolean;
  addBill: (bill: NewBillInput) => Promise<void>;
  updateBill: (id: string, updates: UpdateBillInput) => void;
  markPaymentPaid: (input: MarkPaymentPaidInput) => Promise<void>;
  setPaymentProcessing: (input: SetPaymentProcessingInput) => Promise<void>;
  cancelBill: (id: string) => Promise<void>;
};

type BackendBill = {
  bill_id: number;
  bill_code: string;
  patient_id?: number | null;
  tbl_patients?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  tbl_payments?: Array<{
    payment_id: number;
    amount_paid: number;
    payment_date: string | null;
    payment_method: string | null;
  }> | null;
  total_amount?: number | null;
  net_amount?: number | null;
  status: string;
  created_at?: string | null;
  remaining_balance?: number | null;
};


type BillsResponse = {
  items?: BackendBill[];
  pagination?: {
    total_pages?: number;
  };
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
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function toPaymentStatus(status: BillStatus): PaymentStatus {
  return status === 'Paid' ? 'Paid' : 'Pending';
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

function mapBackendRows(rows: BackendBill[]) {
  function resolvePatientName(row: BackendBill) {
    const relation = Array.isArray(row.tbl_patients) ? row.tbl_patients[0] : row.tbl_patients;
    const patient = relation && typeof relation === 'object' ? relation : null;
    if (!patient) return row.patient_id ? `Patient #${row.patient_id}` : 'Unknown Patient';

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

    return row.patient_id ? `Patient #${row.patient_id}` : 'Unknown Patient';
  }

  const billing = rows.map((row) => {
    const amount = Number(row.net_amount ?? row.total_amount ?? 0);
    return {
      id: String(row.bill_code),
      patient: resolvePatientName(row),
      date: toDateOnly(row.created_at),
      total: toMoneyTag(amount),
      status: normalizeBillStatus(row.status),
      backendBillId: row.bill_id,
      patientId: row.patient_id ?? undefined,
    } satisfies BillRecord;
  });

  const payment = rows
  .filter((row) => normalizeBillStatus(row.status) !== 'Cancelled')
  .map((row) => {
    const normalizedStatus = normalizeBillStatus(row.status);
    const payments = Array.isArray(row.tbl_payments) ? row.tbl_payments : [];
    const latestPayment = payments.length
      ? payments.sort((a, b) => new Date(b.payment_date ?? 0).getTime() - new Date(a.payment_date ?? 0).getTime())[0]
      : null;
    const remaining = Number(row.remaining_balance ?? 0);
    const amount = normalizedStatus === 'Paid'
      ? Number(row.net_amount ?? row.total_amount ?? 0)
      : remaining > 0 ? remaining : Number(row.net_amount ?? row.total_amount ?? 0);

    return {
      id: String(row.bill_code),
      patient: resolvePatientName(row),
      amount,
      method: latestPayment?.payment_method ?? '-',
      date: toDateOnly(latestPayment?.payment_date ?? row.created_at),
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

async function fetchAllBillRows() {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const allRows: BackendBill[] = [];

  while (page <= totalPages) {
    const response = await fetch(`${API_BASE_URL}/billing/bills?page=${page}&page_size=${pageSize}`);
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const payload = (await response.json()) as BillsResponse;
    const rows = Array.isArray(payload.items) ? payload.items : [];
    allRows.push(...rows);

    const nextTotalPages = Number(payload.pagination?.total_pages ?? 1);
    totalPages = Number.isInteger(nextTotalPages) && nextTotalPages > 0 ? nextTotalPages : 1;
    page += 1;
  }

  return allRows;
}

export function BillingPaymentsProvider({ children }: { children: ReactNode }) {
  const [billingRecords, setBillingRecords] = useState<BillRecord[]>([]);
  const [paymentQueue, setPaymentQueue] = useState<PaymentQueueRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshBillingData = useCallback(async () => {
    const rows = await fetchAllBillRows();
    const mapped = mapBackendRows(rows);

    setBillingRecords(mapped.billing);
    setPaymentQueue(mapped.payment);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const rows = await fetchAllBillRows();
        const mapped = mapBackendRows(rows);

        if (!active) return;
        setBillingRecords(mapped.billing);
        setPaymentQueue(mapped.payment);
      } catch {
        if (!active) return;
        setBillingRecords([]);
        setPaymentQueue([]);
      } finally {
        if (active) {
          setIsLoading(false);
        }
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

    const response = await fetch(`${API_BASE_URL}/billing/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patientId,
        doctor_in_charge: bill.doctorInCharge ?? null,
        age: bill.age ?? null,
        gender: bill.gender ?? null,
        final_diagnosis: bill.finalDiagnosis ?? null,
        admission_datetime: bill.admissionDateTime || null,
        discharge_datetime: bill.dischargeDateTime || null,
        referred_by: bill.referredBy || null,
        discharge_status: bill.dischargeStatus || null,
        is_senior_citizen: bill.isSeniorCitizen ?? false,
        is_pwd: bill.isPwd ?? false,
        discount_type: bill.discountType ?? 'None',
        discount_rate: bill.discountRate ?? 0,
        subtotal_medications: bill.subtotalMedications ?? 0,
        subtotal_laboratory: bill.subtotalLaboratory ?? 0,
        subtotal_miscellaneous: bill.subtotalMiscellaneous ?? 0,
        less_amount: bill.lessAmount ?? 0,
        subtotal_room_charge: bill.subtotalRoomCharge ?? 0,
        subtotal_professional_fee: bill.subtotalProfessionalFee ?? 0,
        group1_total: bill.group1Total ?? 0,
        group2_total: bill.group2Total ?? 0,
        total_amount: bill.total ? parseAmount(bill.total) : (bill.netAmount ?? 0),
        net_amount: bill.netAmount ?? parseAmount(bill.total),
        items: itemRows ?? [],
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

    const response = await fetch(`${API_BASE_URL}/billing/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bill_id: backendBillId,
        payment_method: input.method,
        amount_paid: input.amountPaid,
        reference_number: input.reference || null,
        notes: input.notes || null,
        payment_date: input.paidDate || new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    await refreshBillingData();
  }, [paymentQueue, refreshBillingData]);

  const cancelBill = useCallback(async (id: string) => {
    const row = billingRecords.find((item) => item.id === id);
    if (!row) {
      throw new Error('Bill record not found.');
    }

    const backendBillId = toPositiveInteger(row.backendBillId) ?? extractPositiveInteger(row.id);
    if (!backendBillId) {
      throw new Error('Unable to resolve bill ID for cancellation.');
    }

    const response = await fetch(`${API_BASE_URL}/billing/bills/${backendBillId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    await refreshBillingData();
  }, [billingRecords, refreshBillingData]);

  const value = useMemo(
    () => ({
      billingRecords,
      paymentQueue,
      isLoading,
      addBill,
      updateBill,
      markPaymentPaid,
      setPaymentProcessing,
      cancelBill,
    }),
    [billingRecords, paymentQueue, isLoading, addBill, updateBill, markPaymentPaid, setPaymentProcessing, cancelBill],
  );

  return <BillingPaymentsContext.Provider value={value}>{children}</BillingPaymentsContext.Provider>;
}
