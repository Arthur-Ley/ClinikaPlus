import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BillingPaymentsContext } from './BillingPaymentsContextObject.ts';
import { getAuthSession } from '../services/authApi';
import { supabase } from '../lib/supabaseClient';

export type BillStatus = 'Pending' | 'Paid' | 'Cancelled';
export type PaymentStatus = 'Pending' | 'Paid' | 'Processing';
export type BillSource = 'native' | 'integrated';
type SystemMode = 'integrated' | 'standalone';
const SYSTEM_MODE_STORAGE_KEY = 'clinikapluss_system_mode';

export type BillRecord = {
  id: string;
  patient: string;
  date: string;
  total: string;
  status: BillStatus;
  source: BillSource;
  backendBillId?: number;
  patientId?: number;
};

export type CreatedBillResult = BillRecord;

export type PaymentQueueRecord = {
  id: string;
  patient: string;
  amount: number;
  method: string;
  date: string;
  status: PaymentStatus;
  source: BillSource;
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
  addBill: (bill: NewBillInput) => Promise<CreatedBillResult>;
  updateBill: (id: string, updates: UpdateBillInput) => void;
  markPaymentPaid: (input: MarkPaymentPaidInput) => Promise<void>;
  setPaymentProcessing: (input: SetPaymentProcessingInput) => Promise<void>;
  cancelBill: (id: string) => Promise<void>;
};

type BackendBill = {
  bill_id: number;
  bill_code: string;
  patient_id?: number | null;
  public_patient_id?: string | number | null;
  tbl_patients?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  patient?: Record<string, unknown> | null;
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
  source?: BillSource;
};


type BillsResponse = {
  items?: BackendBill[];
  pagination?: {
    total_pages?: number;
  };
};

type CreateBillResponse = {
  bill?: {
    bill_id?: number | null;
    bill_code?: string | null;
    patient_id?: number | null;
    total_amount?: number | null;
    net_amount?: number | null;
    status?: string | null;
    created_at?: string | null;
  } | null;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

function createAuthHeaders() {
  const session = getAuthSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return headers;
}

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
    const publicPatient = row.patient && typeof row.patient === 'object' ? row.patient : null;
    if (publicPatient) {
      const candidates = [publicPatient.full_name, publicPatient.patient_name, publicPatient.name];
      for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      const combined = [publicPatient.first_name, publicPatient.middle_name, publicPatient.last_name]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' ')
        .trim();
      if (combined) return combined;
    }

    const relation = Array.isArray(row.tbl_patients) ? row.tbl_patients[0] : row.tbl_patients;
    const patient = relation && typeof relation === 'object' ? relation : null;
    if (!patient) {
      const fallbackId = row.patient_id ?? row.public_patient_id;
      return fallbackId ? `Patient #${fallbackId}` : 'Unknown Patient';
    }

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

    const fallbackId = row.patient_id ?? row.public_patient_id;
    return fallbackId ? `Patient #${fallbackId}` : 'Unknown Patient';
  }

  const billing = rows.map((row) => {
    const amount = Number(row.net_amount ?? row.total_amount ?? 0);
    return {
      id: String(row.bill_code),
      patient: resolvePatientName(row),
      date: toDateOnly(row.created_at),
      total: toMoneyTag(amount),
      status: normalizeBillStatus(row.status),
      source: row.source ?? 'native',
      backendBillId: row.bill_id,
      patientId: toPositiveInteger(row.patient_id ?? row.public_patient_id) ?? undefined,
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
      source: row.source ?? 'native',
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

function getSavedSystemMode(): SystemMode {
  if (typeof window === 'undefined') return 'standalone';
  return window.localStorage.getItem(SYSTEM_MODE_STORAGE_KEY) === 'integrated' ? 'integrated' : 'standalone';
}


function getSortTimestamp(value: string | null | undefined) {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

async function fetchPublicBillRows(): Promise<BackendBill[]> {
  if (!supabase) return [];
  const client = supabase;

  const { data: billsData, error: billsError } = await supabase
    .schema('public')
    .from('tbl_bills')
    .select('bill_id, bill_code, public_patient_id, total_amount, net_amount, status, created_at')
    .order('created_at', { ascending: false });

  if (billsError) throw billsError;

  const bills = Array.isArray(billsData) ? billsData : [];

  const toIdKey = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    return text;
  };
  const baseRows = bills.map((bill) => {
    const publicPatientId = toIdKey(bill.public_patient_id) || null;
    return {
      bill_id: Number(bill.bill_id),
      bill_code: typeof bill.bill_code === 'string' && bill.bill_code.trim() ? bill.bill_code.trim() : `BILL-${bill.bill_id}`,
      public_patient_id: publicPatientId,
      patient_id: null,
      patient: null,
      tbl_payments: [],
      total_amount: Number(bill.total_amount ?? 0),
      net_amount: Number(bill.net_amount ?? bill.total_amount ?? 0),
      status: typeof bill.status === 'string' ? bill.status : 'Pending',
      created_at: typeof bill.created_at === 'string' ? bill.created_at : null,
      source: 'integrated',
    } satisfies BackendBill;
  });

  const enrichedRows = await Promise.all(
    baseRows.map(async (row) => {
      try {
        const { data, error } = await client.rpc('get_bill_with_patient', { p_bill_id: row.bill_id });
        if (error) return row;
        const rpcBill = Array.isArray(data) ? data[0] : data;
        if (!rpcBill || typeof rpcBill !== 'object') return row;
        const record = rpcBill as Record<string, unknown>;
        const patientObj = record.patient && typeof record.patient === 'object' ? record.patient as Record<string, unknown> : null;
        const patientId = Number((patientObj?.patient_id ?? record.patient_id) ?? 0) || row.patient_id;
        if (!patientObj && row.public_patient_id) {
          const { data: fallbackPatient } = await client
            .schema('public')
            .from('tbl_patient')
            .select('patient_id, first_name, middle_name, last_name, full_name')
            .eq('user_id', String(row.public_patient_id))
            .maybeSingle();
          if (fallbackPatient && typeof fallbackPatient === 'object') {
            const fallbackPatientId = Number((fallbackPatient as Record<string, unknown>).patient_id ?? 0) || patientId;
            return {
              ...row,
              patient: fallbackPatient as Record<string, unknown>,
              patient_id: fallbackPatientId || null,
            } satisfies BackendBill;
          }
        }
        return {
          ...row,
          patient: patientObj ?? row.patient,
          patient_id: patientId || null,
        } satisfies BackendBill;
      } catch {
        return row;
      }
    }),
  );

  return enrichedRows;
}

async function fetchBillRowsByMode(mode: SystemMode): Promise<BackendBill[]> {
  const nativeRows = await fetchAllBillRows();
  const nativeTagged = nativeRows.map((row) => ({ ...row, source: 'native' as const }));
  if (mode !== 'integrated') return nativeTagged;

  try {
    const integratedRows = await fetchPublicBillRows();
    return [...nativeTagged, ...integratedRows].sort((a, b) => getSortTimestamp(b.created_at) - getSortTimestamp(a.created_at));
  } catch (error) {
    console.warn('Integrated bills fetch failed; showing native bills only.', error);
    return nativeTagged;
  }
}

export function BillingPaymentsProvider({ children }: { children: ReactNode }) {
  const [billingRecords, setBillingRecords] = useState<BillRecord[]>([]);
  const [paymentQueue, setPaymentQueue] = useState<PaymentQueueRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [systemMode, setSystemMode] = useState<SystemMode>(() => getSavedSystemMode());

  const refreshBillingData = useCallback(async () => {
    const rows = await fetchBillRowsByMode(systemMode);
    const mapped = mapBackendRows(rows);

    setBillingRecords(mapped.billing);
    setPaymentQueue(mapped.payment);
  }, [systemMode]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const rows = await fetchBillRowsByMode(systemMode);
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
  }, [systemMode]);

  useEffect(() => {
    const syncMode = () => setSystemMode(getSavedSystemMode());
    window.addEventListener('storage', syncMode);
    window.addEventListener('focus', syncMode);
    window.addEventListener('clinikapluss:system-mode-changed', syncMode as EventListener);
    return () => {
      window.removeEventListener('storage', syncMode);
      window.removeEventListener('focus', syncMode);
      window.removeEventListener('clinikapluss:system-mode-changed', syncMode as EventListener);
    };
  }, []);

  const addBill = useCallback(async (bill: NewBillInput) => {
    if (isFrancoJallorina(bill.patient)) {
      return {
        id: bill.id,
        patient: bill.patient,
        date: bill.date,
        total: bill.total,
        status: bill.status,
        source: 'native',
        patientId: bill.patientId,
      } satisfies CreatedBillResult;
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
      headers: createAuthHeaders(),
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

    const payload = (await response.json()) as CreateBillResponse;
    const createdBill = payload.bill;
    const createdRecord: CreatedBillResult = {
      id: createdBill?.bill_code?.trim() || bill.id,
      patient: bill.patient,
      date: toDateOnly(createdBill?.created_at) || bill.date,
      total: toMoneyTag(Number(createdBill?.net_amount ?? createdBill?.total_amount ?? parseAmount(bill.total))),
      status: normalizeBillStatus(createdBill?.status || bill.status),
      source: 'native',
      backendBillId: createdBill?.bill_id ?? undefined,
      patientId: bill.patientId,
    };

    await refreshBillingData();
    return createdRecord;
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
      headers: createAuthHeaders(),
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
      headers: createAuthHeaders(),
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
