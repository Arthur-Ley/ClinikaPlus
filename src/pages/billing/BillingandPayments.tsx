import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, ChevronDown, PlusCircle,
  CheckCircle2, X, ReceiptText, Stethoscope, CircleGauge,
  Info, CircleDollarSign, Coins, XCircle,
  CreditCard, Hash, MinusCircle, User, Plus, Minus, Wallet, Printer, AlertTriangle, Check, Maximize2,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Pagination from '../../components/ui/Pagination';
import SectionToolbar from '../../components/ui/SectionToolbar';
import {
  BillingPaginationSkeleton,
  BillingTableSkeleton,
  SkeletonBlock,
} from './BillingSkeletonParts';
import { printFinalBill } from './printFinalBill';
import { type BillStatus } from '../../context/BillingPaymentsContext';
import { useBillingPayments } from '../../context/useBillingPayments';

type BillRow = {
  id: string;
  patient: string;
  date: string;
  total: string;
  status: BillStatus;
  backendBillId?: number;
  patientId?: number;
};
type ServiceItem = { type: 'service' | 'medication'; name: string; quantity: number; unitPrice: number; serviceId?: number | null; logId?: number | null; serviceType?: string | null; };
type MedicationCatalogItem = { medication_id: number; medication_name: string; total_stock: number; batch_number?: string; expiry_date?: string; unit?: string; };
type MedicationStockApiItem = { medication_id: number; medication_name: string; total_stock: number; batch_number?: string; expiry_date?: string; unit?: string; };
type PaymentBillDetail = {
  bill_id: number;
  bill_code: string;
  patient_id: number;
  total_amount?: number | null;
  net_amount?: number | null;
  status?: string;
  created_at?: string | null;
  tbl_patients?: Record<string, unknown> | Array<Record<string, unknown>> | null;
};
type PaymentBillDetailsResponse = {
  bill?: PaymentBillDetail;
  total_paid?: number;
  remaining_balance?: number;
};
type ViewBillItem = {
  bill_item_id?: number;
  service_type?: string | null;
  service_id?: number | null;
  medication_id?: number | null;
  log_id?: number | null;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
};
type ViewBillPayment = {
  payment_id?: number;
  payment_method?: string | null;
  amount_paid?: number | null;
  reference_number?: string | null;
  payment_date?: string | null;
  received_by?: string | null;
  receiver?: Record<string, unknown> | Array<Record<string, unknown>> | null;
};
type ViewBillDetailsResponse = {
  bill?: Record<string, unknown> | null;
  items?: ViewBillItem[] | Record<string, unknown>[];
  payments?: ViewBillPayment[];
  total_paid?: number;
  remaining_balance?: number;
};
type PaymentMethod = 'Cash' | 'GCash' | 'Maya';
type PatientLookup = {
  patient_id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  contact_number?: string | null;
  email_address?: string | null;
  full_name: string;
};
type ServiceCatalogOption = {
  id: string;
  name: string;
  services: Array<{ id: number; name: string; unitPrice: number }>;
};
type BillingFilter = 'all' | 'pending' | 'paid' | 'cancelled';
type BillingSort = 'date' | 'status' | 'amount';
type ActiveModal =
  | 'none' | 'createBill' | 'viewBill' | 'billSuccess'
  | 'payBill' | 'cancelBill' | 'receipt'
  | 'payMethod' | 'payCash' | 'payGcash' | 'payConfirm' | 'paySuccess' | 'payCancelConfirm' | 'payCancelled'
  | 'addService' | 'addMedication' | 'viewBillServicesFull';
type ToastState = { type: 'success' | 'error'; message: string } | null;
type PaymentValidationErrors = {
  payment_method?: string;
  amount_paid?: string;
  reference_number?: string;
};
type BillUiMeta = {
  createdAt: string;
  patientId: string;
  age: string;
  gender: string;
  doctor: string;
  diagnosis: string;
  admissionDate: string;
  dischargeDate: string;
  services: ServiceItem[];
  isSeniorCitizen: boolean;
  processedBy: string;
  paymentMethod?: PaymentMethod;
  paymentDateTime?: string;
  paymentReference?: string;
  amountPaid?: number;
  cancelledBy?: string;
  cancelledReason?: string;
};

const fallbackMedicationCatalog: MedicationCatalogItem[] = [
  { medication_id: 1, medication_name: 'Amoxicillin 250mg', total_stock: 999, batch_number: 'L2408AMX01', expiry_date: '2026-04-03', unit: 'pcs' },
  { medication_id: 2, medication_name: 'Penicillin', total_stock: 500, batch_number: 'L2408PCN01', expiry_date: '2026-06-15', unit: 'pcs' },
  { medication_id: 3, medication_name: 'Insulin (Rapid)', total_stock: 120, batch_number: 'L2408INS01', expiry_date: '2026-03-21', unit: 'pens' },
  { medication_id: 4, medication_name: 'Vitamin C', total_stock: 800, batch_number: 'L2408VTC01', expiry_date: '2026-09-01', unit: 'pcs' },
  { medication_id: 5, medication_name: 'Cetirizin', total_stock: 350, batch_number: 'L2408CTZ01', expiry_date: '2026-08-20', unit: 'pcs' },
  { medication_id: 6, medication_name: 'Paracetamol 500mg', total_stock: 600, batch_number: 'L2408PCM01', expiry_date: '2027-01-12', unit: 'pcs' },
  { medication_id: 7, medication_name: 'Metformin', total_stock: 280, batch_number: 'L2408MET01', expiry_date: '2026-11-30', unit: 'pcs' },
  { medication_id: 8, medication_name: 'Bioflu', total_stock: 450, batch_number: 'L2408BFL01', expiry_date: '2026-07-10', unit: 'pcs' },
];

const medicationPriceByName: Record<string, number> = {
  'Amoxicillin 250mg': 20, Penicillin: 15, 'Insulin (Rapid)': 180,
  'Vitamin C': 8, Cetirizin: 10, 'Paracetamol 500mg': 12, Metformin: 18, Bioflu: 22,
};

const existingBillServices: ServiceItem[] = [
  { type: 'service', name: 'Consultation', quantity: 1, unitPrice: 500, serviceId: null, logId: null, serviceType: 'Professional Fee' },
  { type: 'medication', name: 'Amoxicillin 250mg', quantity: 10, unitPrice: 20, serviceId: null, logId: 1, serviceType: 'Medications' },
  { type: 'service', name: 'X-Ray', quantity: 1, unitPrice: 1200, serviceId: null, logId: null, serviceType: 'Laboratory' },
];

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const G_CASH_LOGO_URL = '/payment-logos/gcash.svg';
const MAYA_LOGO_URL = '/payment-logos/maya.svg';
const VAT_RATE = 0.12;
const SENIOR_DISCOUNT_RATE = 0.2;
const MIN_TABLE_ROWS = 1;
const MAX_TABLE_ROWS = 100;
const BILL_QUEUE_PAGE_SIZE = 10;

function toAmount(total: string) { const p = Number(total.replace(/[^\d.-]/g, '')); return Number.isFinite(p) ? p : 0; }
function formatPhp(value: number) { return `PHP ${Math.round(value).toLocaleString()}`; }
function formatDateForTable(value: string) { const p = new Date(value); if (Number.isNaN(p.getTime())) return value; return p.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }); }
function formatDateLong(value: string) { const p = new Date(value); if (Number.isNaN(p.getTime())) return value; return p.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
function formatDateMed(value: string) { const p = new Date(value); if (Number.isNaN(p.getTime())) return value; return p.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }); }
function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function parsePositiveInt(value: string) { const n = value.trim(); if (!/^\d+$/.test(n)) return null; const p = Number(n); if (!Number.isInteger(p) || p <= 0) return null; return p; }
function toNonNegativeInputNumber(value: string) { const p = Number(value); if (!Number.isFinite(p) || p < 0) return 0; return p; }
function toAgeFromBirthDate(value: string) {
  if (!value) return '';
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  const dayDiff = now.getDate() - dob.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return age >= 0 ? String(age) : '';
}
function resolveMedicationUnitPrice(name: string) { return medicationPriceByName[name] ?? 20; }
function toSafeQuantity(value: string) { const p = Number(value); if (!Number.isInteger(p) || p <= 0) return 1; return p; }
function normalizeBillStatus(value: string): BillStatus { const n = value.trim().toLowerCase(); if (n === 'paid') return 'Paid'; if (n === 'cancelled' || n === 'canceled') return 'Cancelled'; return 'Pending'; }
function statusCode(status: BillStatus) { if (status === 'Paid') return 'PD'; if (status === 'Cancelled') return 'CN'; return 'PN'; }
function toAutoIds(status: BillStatus, records: BillRow[]) { const code = statusCode(status); const next = records.filter(r => r.status === status).length + 1; return { billId: `B-${code}-${String(next).padStart(4, '0')}` }; }
function toPeso(value: number) { return `\u20b1${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function toDateTimeDisplay(value: string) { const p = new Date(value); if (Number.isNaN(p.getTime())) return value; return p.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function toDateTimeDisplayNoTimezoneShift(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (match) {
    const [, y, m, d, hh, mm] = match;
    const localDate = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
    if (!Number.isNaN(localDate.getTime())) {
      return localDate.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  return toDateTimeDisplay(value);
}
function formatRoleLabel(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return 'N/A';
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
function toSortRank(status: BillStatus) { if (status === 'Pending') return 0; if (status === 'Paid') return 1; return 2; }
function normalizeBreakdownType(service: ServiceItem) {
  if (service.type === 'medication') return 'Medications';
  const raw = (service.serviceType || '').trim().toLowerCase();
  if (raw.includes('room')) return 'Room Charge';
  if (raw.includes('laboratory') || raw.includes('lab') || raw.includes('x-ray') || raw.includes('xray') || raw.includes('urinalysis')) return 'Laboratory';
  if (raw.includes('professional') || raw.includes('consult')) return 'Professional Fee';
  if (raw.includes('misc')) return 'Miscellaneous';

  const fallback = service.name.trim().toLowerCase();
  if (fallback.includes('room')) return 'Room Charge';
  if (fallback.includes('laboratory') || fallback.includes('lab') || fallback.includes('x-ray') || fallback.includes('xray') || fallback.includes('urinalysis') || fallback.includes('blood')) return 'Laboratory';
  if (fallback.includes('consult') || fallback.includes('professional') || fallback.includes('doctor')) return 'Professional Fee';
  return 'Miscellaneous';
}
function toFallbackPaymentDetails(bill: BillRow): PaymentBillDetailsResponse {
  const amount = toAmount(bill.total);
  return {
    bill: {
      bill_id: bill.backendBillId ?? 0,
      bill_code: bill.id,
      patient_id: bill.patientId ?? 0,
      total_amount: amount,
      net_amount: amount,
      status: bill.status,
      created_at: bill.date,
    },
    total_paid: 0,
    remaining_balance: amount,
  };
}
function buildDefaultBillMeta(bill: BillRow): BillUiMeta {
  const createdAt = `${bill.date}T08:30:00`;
  return {
    createdAt,
    patientId: 'P-1021',
    age: '45',
    gender: 'Male',
    doctor: 'Dr. Henry G. Malibiran',
    diagnosis: 'Community Acquired Pneumonia',
    admissionDate: bill.date,
    dischargeDate: bill.date,
    services: existingBillServices,
    isSeniorCitizen: false,
    processedBy: 'Staff',
    paymentMethod: bill.status === 'Paid' ? 'Cash' : undefined,
    paymentDateTime: bill.status === 'Paid' ? `${bill.date}T09:15:00` : undefined,
    paymentReference: bill.status === 'Paid' ? `REF-${bill.id}` : undefined,
    amountPaid: bill.status === 'Paid' ? toAmount(bill.total) : undefined,
    cancelledBy: bill.status === 'Cancelled' ? 'Staff' : undefined,
    cancelledReason: bill.status === 'Cancelled' ? 'Cancelled at front desk.' : undefined,
  };
}

const EMPTY_BILL_ROW: BillRow = { id: '', patient: '', date: '', total: 'P0', status: 'Pending' };

function StatusPill({ status }: { status: string }) {
  const styles = status === 'Paid' ? 'bg-green-100 text-green-700' : status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return <span className={`inline-flex min-w-[74px] justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles}`}>{status}</span>;
}

const paymentProgressSteps = [
  'Bill Details & Payment Method',
  'Payment',
  'Review Payment',
] as const;

function PaymentProgressTracker({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <div className="w-full border-b border-gray-200 bg-gray-50 px-6 py-4">
      <div className="flex items-start">
        {paymentProgressSteps.map((label, index) => {
          const step = index + 1;
          const isCompleted = currentStep > step;
          const isActive = currentStep === step;

          return (
            <div key={label} className="flex flex-1 items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col items-center text-center">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${isCompleted || isActive ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                    {isCompleted ? <Check size={14} strokeWidth={3} /> : isActive ? step : ''}
                  </span>
                  <span className={`mt-2 text-xs font-semibold ${isActive ? 'text-blue-700' : 'text-gray-600'}`}>{label}</span>
                </div>
              </div>
              {step < paymentProgressSteps.length && (
                <div className="mx-3 mt-4 h-0.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div className={`h-full ${currentStep > step ? 'w-full bg-blue-600' : 'w-0 bg-blue-600'}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs font-semibold text-gray-600">Step {currentStep} of 3</p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BillingAndPayments() {
  const { billingRecords, addBill, markPaymentPaid, paymentQueue, isLoading, cancelBill } = useBillingPayments();
  const location = useLocation();
  const [forceSkeletonVisible, setForceSkeletonVisible] = useState(true);

  const [modal, setModal] = useState<ActiveModal>('none');
  const [prevModal, setPrevModal] = useState<ActiveModal>('none');
  const [searchTerm, setSearchTerm] = useState('');
  const [billingFilter, setBillingFilter] = useState<BillingFilter>('all');
  const [sortBy, setSortBy] = useState<BillingSort>('date');
  const [toast, setToast] = useState<ToastState>(null);

  const [selectedBill, setSelectedBill] = useState<BillRow | null>(null);
  const [billMetaById, setBillMetaById] = useState<Record<string, BillUiMeta>>({});
  const [billIdInput, setBillIdInput] = useState('');
  const [billStatusInput, setBillStatusInput] = useState('');
  const [patientIdInput, setPatientIdInput] = useState('');
  const [patientNameInput, setPatientNameInput] = useState('');
  const [patientSearchInput, setPatientSearchInput] = useState('');
  const [patientOptions, setPatientOptions] = useState<PatientLookup[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [isPatientLoading, setIsPatientLoading] = useState(false);
  const [showAddPatientForm, setShowAddPatientForm] = useState(false);
  const [newPatientFirstName, setNewPatientFirstName] = useState('');
  const [newPatientLastName, setNewPatientLastName] = useState('');
  const [newPatientDob, setNewPatientDob] = useState('');
  const [newPatientGender, setNewPatientGender] = useState('');
  const [newPatientContactNumber, setNewPatientContactNumber] = useState('');
  const [newPatientEmailAddress, setNewPatientEmailAddress] = useState('');
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [isCreatingBill, setIsCreatingBill] = useState(false);
  const [patientAgeInput, setPatientAgeInput] = useState('');
  const [patientGenderInput, setPatientGenderInput] = useState('');
  const [doctorInput, setDoctorInput] = useState('');
  const [diagnosisInput, setDiagnosisInput] = useState('');
  const [referredByInput, setReferredByInput] = useState('');
  const [dischargeStatusInput, setDischargeStatusInput] = useState('');
  const [visitDateInput, setVisitDateInput] = useState('');
  const [admissionDateInput, setAdmissionDateInput] = useState('');
  const [dischargeDateInput, setDischargeDateInput] = useState('');
  const [lessAmountInput, setLessAmountInput] = useState('');
  const [roomChargeInput, setRoomChargeInput] = useState('');
  const [professionalFeeInput, setProfessionalFeeInput] = useState('');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [medicationCatalog, setMedicationCatalog] = useState<MedicationCatalogItem[]>(fallbackMedicationCatalog);
  const [isSeniorCitizen, setIsSeniorCitizen] = useState(false);
  const [isPwd, setIsPwd] = useState(false);

  const [serviceTypeSearch, setServiceTypeSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceTypeOptions, setServiceTypeOptions] = useState<ServiceCatalogOption[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceCatalogOption | null>(null);
  const [selectedService, setSelectedService] = useState<{ id: number; name: string; unitPrice: number } | null>(null);
  const [serviceQty, setServiceQty] = useState(1);
  const [serviceUnitPrice, setServiceUnitPrice] = useState(0);
  const [showServiceTypeDropdown, setShowServiceTypeDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  const [medicationSearch, setMedicationSearch] = useState('');
  const [selectedMedication, setSelectedMedication] = useState<MedicationCatalogItem | null>(null);
  const [medicationQty, setMedicationQty] = useState(1);
  const [medicationUnitPrice, setMedicationUnitPrice] = useState(0);
  const [showMedicationDropdown, setShowMedicationDropdown] = useState(false);
  const [addItemFeedback, setAddItemFeedback] = useState('');

  const [selectedPayRow, setSelectedPayRow] = useState<BillRow>(EMPTY_BILL_ROW);
  const [paymentBillDetails, setPaymentBillDetails] = useState<PaymentBillDetailsResponse | null>(null);
  const [viewBillDetails, setViewBillDetails] = useState<ViewBillDetailsResponse | null>(null);
  const [isPaymentDetailsLoading, setIsPaymentDetailsLoading] = useState(false);
  const [isViewBillDetailsLoading, setIsViewBillDetailsLoading] = useState(false);
  const [paymentDetailsError, setPaymentDetailsError] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReferenceInput, setPaymentReferenceInput] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentErrors, setPaymentErrors] = useState<PaymentValidationErrors>({});
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusHandledKey, setFocusHandledKey] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(8);
  const tableCardRef = useRef<HTMLDivElement | null>(null);
  const tableToolbarRef = useRef<HTMLDivElement | null>(null);
  const tableFooterRef = useRef<HTMLDivElement | null>(null);
  const tableHeadRef = useRef<HTMLTableSectionElement | null>(null);
  const patientPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/medications`);
        if (!response.ok) return;
        const payload = (await response.json()) as { items?: MedicationStockApiItem[] };
        if (!active || !Array.isArray(payload.items) || !payload.items.length) return;
        setMedicationCatalog(payload.items.map(item => ({ medication_id: item.medication_id, medication_name: item.medication_name, total_stock: item.total_stock ?? 0, batch_number: item.batch_number, expiry_date: item.expiry_date, unit: item.unit })));
      } catch { /* keep fallback */ }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/billing/services`);
        if (!response.ok) return;
        const payload = (await response.json()) as { items?: ServiceCatalogOption[] };
        if (!active || !Array.isArray(payload.items)) return;
        setServiceTypeOptions(payload.items);
      } catch {
        if (!active) return;
        setServiceTypeOptions([]);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (modal !== 'createBill') return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setIsPatientLoading(true);
        const query = patientSearchInput.trim();
        const response = await fetch(`${API_BASE_URL}/billing/patients?search=${encodeURIComponent(query)}&limit=20`);
        if (!response.ok) return;
        const payload = (await response.json()) as { items?: PatientLookup[] };
        if (!active) return;
        setPatientOptions(Array.isArray(payload.items) ? payload.items : []);
      } catch {
        if (!active) return;
        setPatientOptions([]);
      } finally {
        if (active) setIsPatientLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [patientSearchInput, modal]);

  useEffect(() => {
    if (!showPatientDropdown) return;
    function handleOutsideClick(event: MouseEvent) {
      if (!patientPickerRef.current) return;
      if (!patientPickerRef.current.contains(event.target as Node)) setShowPatientDropdown(false);
    }
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [showPatientDropdown]);

  useEffect(() => {
    setBillMetaById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const bill of billingRecords) {
        if (!next[bill.id]) {
          next[bill.id] = buildDefaultBillMeta(bill);
          changed = true;
          continue;
        }
        if (bill.status === 'Paid' && !next[bill.id].paymentDateTime) {
          next[bill.id] = {
            ...next[bill.id],
            paymentMethod: next[bill.id].paymentMethod ?? 'Cash',
            paymentDateTime: `${bill.date}T09:15:00`,
            paymentReference: next[bill.id].paymentReference ?? `REF-${bill.id}`,
            amountPaid: next[bill.id].amountPaid ?? toAmount(bill.total),
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [billingRecords]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => setForceSkeletonVisible(false), 550);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredBills = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    const visible = billingRecords.filter(bill => {
      const matchesSearch = !normalized || bill.patient.toLowerCase().includes(normalized) || bill.id.toLowerCase().includes(normalized);
      const matchesFilter = billingFilter === 'all' || (billingFilter === 'pending' && bill.status === 'Pending') || (billingFilter === 'paid' && bill.status === 'Paid') || (billingFilter === 'cancelled' && bill.status === 'Cancelled');
      return matchesSearch && matchesFilter;
    });
    const queueRank = (status: BillStatus) => {
      if (status === 'Pending') return 0;
      if (status === 'Paid') return 1;
      if (status === 'Cancelled') return 2;
      return 3;
    };
    return [...visible].sort((a, b) => {
      const byStatus = queueRank(a.status) - queueRank(b.status);
      if (byStatus !== 0) return byStatus;

      const byDateDesc = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (byDateDesc !== 0) return byDateDesc;

      return Number(b.backendBillId || 0) - Number(a.backendBillId || 0);
    });
  }, [billingRecords, searchTerm, billingFilter, sortBy]);

  useEffect(() => {
    function measureRowsThatFit() {
      const card = tableCardRef.current;
      const toolbar = tableToolbarRef.current;
      const footer = tableFooterRef.current;
      const tableHead = tableHeadRef.current;
      if (!card || !toolbar) return;

      const cardHeight = card.clientHeight;
      if (!cardHeight) return;

      const toolbarHeight = toolbar.offsetHeight;
      const footerHeight = footer?.offsetHeight ?? 0;
      const headerHeight = tableHead?.getBoundingClientRect().height || 40;
      const rowNode = card.querySelector<HTMLTableRowElement>('tbody tr[data-bill-row="true"]');
      const rowHeight = rowNode?.getBoundingClientRect().height || 40;
      const verticalPaddingReserve = 28;
      const availableTableBodyHeight = cardHeight - toolbarHeight - footerHeight - headerHeight - verticalPaddingReserve;
      const nextPageSize = Math.max(MIN_TABLE_ROWS, Math.min(MAX_TABLE_ROWS, Math.floor(availableTableBodyHeight / Math.max(rowHeight, 1))));
      setTablePageSize(prev => (prev === nextPageSize ? prev : nextPageSize));
    }

    measureRowsThatFit();
    const frame = window.requestAnimationFrame(() => measureRowsThatFit());
    const settleTimer = window.setTimeout(() => measureRowsThatFit(), 120);
    const observer = new ResizeObserver(() => measureRowsThatFit());
    const mutationObserver = new MutationObserver(() => measureRowsThatFit());
    if (tableCardRef.current) observer.observe(tableCardRef.current);
    if (tableToolbarRef.current) observer.observe(tableToolbarRef.current);
    if (tableFooterRef.current) observer.observe(tableFooterRef.current);
    if (tableCardRef.current) mutationObserver.observe(tableCardRef.current, { childList: true, subtree: true });
    window.addEventListener('resize', measureRowsThatFit);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', measureRowsThatFit);
    };
  }, [filteredBills.length, isLoading, forceSkeletonVisible]);

  const effectivePageSize = Math.min(BILL_QUEUE_PAGE_SIZE, Math.max(MIN_TABLE_ROWS, tablePageSize));
  const shouldShowLoading = isLoading || forceSkeletonVisible;
  const usePagination = filteredBills.length > effectivePageSize;
  const totalPages = usePagination ? Math.max(1, Math.ceil(filteredBills.length / effectivePageSize)) : 1;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const pagedBills = usePagination ? filteredBills.slice(startIndex, startIndex + effectivePageSize) : filteredBills;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, billingFilter, sortBy, effectivePageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const selectedBillMeta = useMemo(
    () => (selectedBill ? billMetaById[selectedBill.id] : undefined),
    [billMetaById, selectedBill],
  );
  const selectedPaymentRecord = useMemo(
    () => (selectedBill ? paymentQueue.find((item) => item.id === selectedBill.id) : undefined),
    [paymentQueue, selectedBill],
  );
  const viewBill = useMemo(() => (viewBillDetails?.bill && typeof viewBillDetails.bill === 'object' ? viewBillDetails.bill as Record<string, unknown> : null), [viewBillDetails]);
  const viewPatient = useMemo(() => {
    if (!viewBill) return null;
    const relation = Array.isArray(viewBill.tbl_patients) ? viewBill.tbl_patients[0] : viewBill.tbl_patients;
    return relation && typeof relation === 'object' ? relation as Record<string, unknown> : null;
  }, [viewBill]);
  const viewCreator = useMemo(() => {
    if (!viewBill) return null;
    const relation = Array.isArray(viewBill.creator) ? viewBill.creator[0] : viewBill.creator;
    return relation && typeof relation === 'object' ? relation as Record<string, unknown> : null;
  }, [viewBill]);
  const viewPayments = useMemo(() => (Array.isArray(viewBillDetails?.payments) ? viewBillDetails.payments : []), [viewBillDetails]);
  const latestViewPayment = useMemo(() => (viewPayments.length ? viewPayments[viewPayments.length - 1] : null), [viewPayments]);
  const latestViewPaymentWithReference = useMemo(
    () => [...viewPayments].reverse().find((payment) => typeof payment?.reference_number === 'string' && payment.reference_number.trim().length > 0) ?? null,
    [viewPayments],
  );
  const latestViewPaymentReceiver = useMemo(() => {
    if (!latestViewPayment) return null;
    const relation = Array.isArray(latestViewPayment.receiver) ? latestViewPayment.receiver[0] : latestViewPayment.receiver;
    return relation && typeof relation === 'object' ? relation as Record<string, unknown> : null;
  }, [latestViewPayment]);
  const latestViewPaymentReceiverName = useMemo(() => {
    if (!latestViewPaymentReceiver) return '';
    return [latestViewPaymentReceiver.first_name, latestViewPaymentReceiver.last_name]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
      .trim();
  }, [latestViewPaymentReceiver]);
  const latestViewPaymentReceiverRole = useMemo(() => (
    typeof latestViewPaymentReceiver?.role === 'string' && latestViewPaymentReceiver.role.trim().length > 0
      ? formatRoleLabel(latestViewPaymentReceiver.role)
      : ''
  ), [latestViewPaymentReceiver]);
  const viewServicesByType = useMemo(() => {
    const order = ['Medications', 'Laboratory', 'Miscellaneous', 'Room Charge', 'Professional Fee'] as const;
    const grouped = new Map<string, ViewBillItem[]>();
    const sourceItems = Array.isArray(viewBillDetails?.items) ? viewBillDetails.items : [];
    const normalize = (value: string) => value.trim().toLowerCase();
    const resolveType = (item: ViewBillItem) => {
      if (item.medication_id || item.log_id) return 'Medications';
      const rawType = typeof item?.service_type === 'string' ? item.service_type : '';
      const normalizedType = normalize(rawType);
      if (normalizedType.includes('room')) return 'Room Charge';
      if (normalizedType.includes('lab') || normalizedType.includes('laboratory') || normalizedType.includes('ecg')) return 'Laboratory';
      if (normalizedType.includes('professional') || normalizedType.includes('consult')) return 'Professional Fee';
      if (normalizedType.includes('misc')) return 'Miscellaneous';
      const desc = normalize(String(item.description || ''));
      if (desc.includes('room')) return 'Room Charge';
      if (desc.includes('lab') || desc.includes('laboratory') || desc.includes('x-ray') || desc.includes('xray') || desc.includes('blood') || desc.includes('urinalysis') || desc.includes('ecg')) return 'Laboratory';
      if (desc.includes('professional') || desc.includes('consult') || desc.includes('doctor')) return 'Professional Fee';
      return 'Miscellaneous';
    };
    for (const key of order) grouped.set(key, []);
    for (const item of sourceItems) {
      const match = resolveType(item);
      grouped.get(match)?.push(item);
    }
    return order
      .map((label) => {
        const items = grouped.get(label) || [];
        const total = items.reduce((sum, item) => sum + Number(item?.subtotal || 0), 0);
        return { label, items, total };
      })
      .filter((group) => group.items.length > 0 && group.total > 0);
  }, [viewBillDetails]);
  const viewSummary = useMemo(() => {
    const toNum = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
    return {
      subtotalMedications: toNum(viewBill?.subtotal_medications),
      subtotalLaboratory: toNum(viewBill?.subtotal_laboratory),
      subtotalMiscellaneous: toNum(viewBill?.subtotal_miscellaneous),
      subtotalRoomCharge: toNum(viewBill?.subtotal_room_charge),
      subtotalProfessionalFee: toNum(viewBill?.subtotal_professional_fee),
      group1Total: toNum(viewBill?.group1_total),
      group2Total: toNum(viewBill?.group2_total),
      subtotal: toNum(viewBill?.total_amount),
      lessAmount: toNum(viewBill?.less_amount),
      netAmount: toNum(viewBill?.net_amount),
      discountType: typeof viewBill?.discount_type === 'string' ? viewBill.discount_type : '',
    };
  }, [viewBill]);
  const creatorFullName = useMemo(() => {
    if (!viewCreator) return '';
    return [viewCreator.first_name, viewCreator.last_name]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
      .trim();
  }, [viewCreator]);
  const creatorRole = useMemo(() => (
    typeof viewCreator?.role === 'string' && viewCreator.role.trim().length > 0
      ? formatRoleLabel(viewCreator.role)
      : ''
  ), [viewCreator]);

  const subtotal = useMemo(() => services.reduce((acc, s) => acc + s.quantity * s.unitPrice, 0), [services]);
  const discount = isSeniorCitizen ? subtotal * SENIOR_DISCOUNT_RATE : 0;
  const tax = isSeniorCitizen ? 0 : subtotal * VAT_RATE;
  const total = subtotal - discount + tax;

  const groupedBreakdownTotals = useMemo(() => {
    const totals: Record<string, number> = {
      'Medications': 0,
      'Laboratory': 0,
      'Miscellaneous': 0,
      'Room Charge': 0,
      'Professional Fee': 0,
    };
    for (const service of services) {
      const key = normalizeBreakdownType(service);
      totals[key] = (totals[key] || 0) + (service.quantity * service.unitPrice);
    }
    return totals;
  }, [services]);
  const subtotalMedications = groupedBreakdownTotals['Medications'] || 0;
  const subtotalLaboratory = groupedBreakdownTotals['Laboratory'] || 0;
  const subtotalMiscellaneous = groupedBreakdownTotals['Miscellaneous'] || 0;
  const group1Total = subtotalMedications + subtotalLaboratory + subtotalMiscellaneous;
  const subtotalRoomCharge = Math.max(groupedBreakdownTotals['Room Charge'] || 0, toNonNegativeInputNumber(roomChargeInput));
  const subtotalProfessionalFee = Math.max(groupedBreakdownTotals['Professional Fee'] || 0, toNonNegativeInputNumber(professionalFeeInput));
  const group2Total = subtotalRoomCharge + subtotalProfessionalFee;
  const totalBeforeDiscount = group1Total + group2Total;
  const discountRate = (isSeniorCitizen || isPwd) ? 0.2 : 0;
  const discountType = isSeniorCitizen ? 'Senior Citizen' : isPwd ? 'PWD' : 'None';
  const computedLessAmount = totalBeforeDiscount * discountRate;
  const lessAmount = Number((computedLessAmount || toNonNegativeInputNumber(lessAmountInput)).toFixed(2));
  const finalBillTotal = totalBeforeDiscount - computedLessAmount;

  const filteredServiceTypes = useMemo(() => {
    const q = serviceTypeSearch.trim().toLowerCase();
    return q ? serviceTypeOptions.filter(t => t.name.toLowerCase().includes(q)) : serviceTypeOptions;
  }, [serviceTypeSearch, serviceTypeOptions]);

  const filteredServiceOptions = useMemo(() => {
    if (!selectedServiceType) return [];
    const q = serviceSearch.trim().toLowerCase();
    return q ? selectedServiceType.services.filter(s => s.name.toLowerCase().includes(q)) : selectedServiceType.services;
  }, [selectedServiceType, serviceSearch]);

  const filteredMedicationOptions = useMemo(() => {
    const q = medicationSearch.trim().toLowerCase();
    return q ? medicationCatalog.filter(m => m.medication_name.toLowerCase().includes(q)) : medicationCatalog;
  }, [medicationSearch, medicationCatalog]);

  const medicationSubtotal = medicationQty * medicationUnitPrice;

  function openAddServiceModal() {
    setSelectedServiceType(null); setSelectedService(null);
    setServiceTypeSearch(''); setServiceSearch('');
    setServiceQty(1); setServiceUnitPrice(0);
    setAddItemFeedback('');
    setShowServiceTypeDropdown(false); setShowServiceDropdown(false);
    setPrevModal(modal);
    setModal('addService');
  }

  function openAddMedicationModal() {
    setSelectedMedication(null); setMedicationSearch('');
    setMedicationQty(1); setMedicationUnitPrice(0);
    setAddItemFeedback('');
    setShowMedicationDropdown(false);
    setPrevModal(modal);
    setModal('addMedication');
  }

  function confirmAddService() {
    if (!selectedService) return;
    const nextServiceType = selectedServiceType?.name ?? null;
    const hasDuplicate = services.some(item =>
      item.type === 'service' &&
      ((item.serviceId != null && item.serviceId === selectedService.id) ||
        (item.name.trim().toLowerCase() === selectedService.name.trim().toLowerCase() && (item.serviceType || '').trim().toLowerCase() === (nextServiceType || '').trim().toLowerCase()))
    );
    if (hasDuplicate) {
      const message = 'This service is already added.';
      setToast({ type: 'error', message });
      setAddItemFeedback(message);
      return;
    }
    setAddItemFeedback('');
    setServices(prev => [...prev, { type: 'service', name: selectedService.name, quantity: serviceQty, unitPrice: serviceUnitPrice || selectedService.unitPrice, serviceId: selectedService.id, logId: null, serviceType: nextServiceType }]);
    setModal(prevModal);
  }

  function confirmAddMedication() {
    if (!selectedMedication) return;
    if (selectedMedication.total_stock < medicationQty) {
      const message = `Insufficient stock. Available: ${selectedMedication.total_stock}`;
      setToast({ type: 'error', message });
      setAddItemFeedback(message);
      return;
    }
    const hasDuplicate = services.some(item =>
      item.type === 'medication' &&
      ((item.logId != null && item.logId === selectedMedication.medication_id) ||
        item.name.trim().toLowerCase() === selectedMedication.medication_name.trim().toLowerCase())
    );
    if (hasDuplicate) {
      const message = 'This medication is already added.';
      setToast({ type: 'error', message });
      setAddItemFeedback(message);
      return;
    }
    setAddItemFeedback('');
    setServices(prev => [...prev, { type: 'medication', name: selectedMedication.medication_name, quantity: medicationQty, unitPrice: medicationUnitPrice || resolveMedicationUnitPrice(selectedMedication.medication_name), serviceId: null, logId: selectedMedication.medication_id }]);
    setModal(prevModal);
  }

  function selectPatientOption(patient: PatientLookup) {
    setPatientIdInput(String(patient.patient_id));
    setPatientNameInput(patient.full_name);
    setPatientSearchInput(patient.full_name);
    setPatientGenderInput(patient.gender || '');
    setPatientAgeInput(toAgeFromBirthDate(patient.date_of_birth));
    setShowPatientDropdown(false);
    setShowAddPatientForm(false);
  }

  async function handleCreatePatientOption() {
    if (!newPatientFirstName.trim() || !newPatientLastName.trim() || !newPatientDob || !newPatientGender.trim()) {
      window.alert('First Name, Last Name, Date of Birth, and Gender are required.');
      return;
    }
    try {
      setIsCreatingPatient(true);
      const response = await fetch(`${API_BASE_URL}/billing/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: newPatientFirstName.trim(),
          last_name: newPatientLastName.trim(),
          date_of_birth: newPatientDob,
          gender: newPatientGender.trim(),
          contact_number: newPatientContactNumber.trim() || null,
          email_address: newPatientEmailAddress.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error('Unable to create patient record.');
      }
      const payload = (await response.json()) as { patient?: PatientLookup };
      if (!payload.patient) return;
      selectPatientOption(payload.patient);
      setPatientOptions(prev => [payload.patient as PatientLookup, ...prev.filter(p => p.patient_id !== payload.patient!.patient_id)]);
      setNewPatientFirstName('');
      setNewPatientLastName('');
      setNewPatientDob('');
      setNewPatientGender('');
      setNewPatientContactNumber('');
      setNewPatientEmailAddress('');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to create patient record.');
    } finally {
      setIsCreatingPatient(false);
    }
  }

  function resetCreateForm() {
    const defaultStatus: BillStatus = 'Pending';
    const ids = toAutoIds(defaultStatus, billingRecords);
    setBillIdInput(ids.billId); setBillStatusInput(defaultStatus);
    setPatientIdInput(''); setPatientNameInput(''); setPatientAgeInput('');
    setPatientSearchInput(''); setPatientOptions([]); setShowPatientDropdown(false); setShowAddPatientForm(false);
    setNewPatientFirstName(''); setNewPatientLastName(''); setNewPatientDob(''); setNewPatientGender(''); setNewPatientContactNumber(''); setNewPatientEmailAddress('');
    setPatientGenderInput(''); setDoctorInput(''); setDiagnosisInput(''); setReferredByInput(''); setDischargeStatusInput('');
    setVisitDateInput(''); setAdmissionDateInput(''); setDischargeDateInput('');
    setLessAmountInput(''); setRoomChargeInput(''); setProfessionalFeeInput('');
    setServices([]); setIsSeniorCitizen(false); setIsPwd(false);
  }

  function openCreateModal() { resetCreateForm(); setSelectedBill(null); setModal('createBill'); }

  function loadBillDetails(bill: BillRow) {
    const meta = billMetaById[bill.id] ?? buildDefaultBillMeta(bill);
    setSelectedBill(bill);
    setBillIdInput(bill.id);
    setBillStatusInput(bill.status);
    setPatientIdInput(meta.patientId);
    setPatientNameInput(bill.patient);
    setPatientSearchInput(bill.patient);
    setPatientAgeInput(meta.age);
    setPatientGenderInput(meta.gender);
    setDoctorInput(meta.doctor);
    setDiagnosisInput(meta.diagnosis);
    setReferredByInput('');
    setDischargeStatusInput('');
    setVisitDateInput(bill.date);
    setAdmissionDateInput(meta.admissionDate);
    setDischargeDateInput(meta.dischargeDate);
    setLessAmountInput('');
    setRoomChargeInput('');
    setProfessionalFeeInput('');
    setServices(meta.services);
    setIsSeniorCitizen(meta.isSeniorCitizen);
    setIsPwd(false);
  }

  function openViewModal(bill: BillRow) {
    const resolvedBackendBillId = bill.backendBillId ?? billingRecords.find((row) => row.id === bill.id)?.backendBillId;
    const billWithBackendId: BillRow = resolvedBackendBillId ? { ...bill, backendBillId: resolvedBackendBillId } : bill;
    loadBillDetails(billWithBackendId);
    void fetchViewBillDetails(billWithBackendId);
    setModal('viewBill');
  }

  async function fetchPaymentBillDetails(bill: BillRow) {
    const backendBillId = bill.backendBillId ?? billingRecords.find((row) => row.id === bill.id)?.backendBillId;
    if (!backendBillId) {
      const fallback = toFallbackPaymentDetails(bill);
      setPaymentBillDetails(fallback);
      setPaymentDetailsError('');
      setPaymentAmount(String(fallback.remaining_balance ?? toAmount(bill.total)));
      return;
    }

    try {
      setIsPaymentDetailsLoading(true);
      setPaymentDetailsError('');
      const response = await fetch(`${API_BASE_URL}/billing/bills/${backendBillId}`);
      if (!response.ok) {
        throw new Error(`Billing details request failed (${response.status}).`);
      }

      const payload = (await response.json()) as PaymentBillDetailsResponse | PaymentBillDetail;
      const normalizedPayload = payload && typeof payload === 'object' && 'bill' in payload
        ? payload as PaymentBillDetailsResponse
        : ({ bill: payload as PaymentBillDetail } as PaymentBillDetailsResponse);
      setPaymentBillDetails(normalizedPayload);
      const due = Number(normalizedPayload.remaining_balance ?? normalizedPayload.bill?.net_amount ?? normalizedPayload.bill?.total_amount ?? toAmount(bill.total));
      setPaymentAmount(String(Number.isFinite(due) ? Math.max(0, due) : toAmount(bill.total)));
    } catch (error) {
      const fallback = toFallbackPaymentDetails(bill);
      setPaymentBillDetails(fallback);
      setPaymentDetailsError('Unable to refresh live bill details right now. Showing the current bill snapshot.');
      setPaymentAmount(String(fallback.remaining_balance ?? toAmount(bill.total)));
    } finally {
      setIsPaymentDetailsLoading(false);
    }
  }

  function openPaymentModal(bill: BillRow) {
    const resolvedBackendBillId = bill.backendBillId ?? billingRecords.find((row) => row.id === bill.id)?.backendBillId;
    if (!resolvedBackendBillId) {
      setToast({ type: 'error', message: 'Unable to open payment modal. Missing bill ID.' });
      return;
    }
    const billWithBackendId: BillRow = { ...bill, backendBillId: resolvedBackendBillId };
    loadBillDetails(billWithBackendId);
    setSelectedPayRow(billWithBackendId);
    setSelectedMethod('Cash');
    setPaymentAmount(String(toAmount(bill.total)));
    setPaymentReferenceInput('');
    setPaymentNotes('');
    setPaymentErrors({});
    setPaymentDetailsError('');
    setPaymentBillDetails(null);
    setModal('payMethod');
    void fetchPaymentBillDetails(billWithBackendId);
  }

  async function fetchViewBillDetails(bill: BillRow) {
    const backendBillId = bill.backendBillId ?? billingRecords.find((row) => row.id === bill.id)?.backendBillId;
    if (!backendBillId) {
      setViewBillDetails(null);
      return;
    }

    try {
      setIsViewBillDetailsLoading(true);
      const response = await fetch(`${API_BASE_URL}/billing/bills/${backendBillId}`);
      if (!response.ok) {
        throw new Error(`Bill details request failed (${response.status}).`);
      }
      const payload = (await response.json()) as ViewBillDetailsResponse;
      setViewBillDetails(payload);
      const billRow = payload.bill && typeof payload.bill === 'object' ? payload.bill as Record<string, unknown> : null;
      const fetchedDiagnosis = billRow && typeof billRow.final_diagnosis === 'string' ? billRow.final_diagnosis.trim() : '';
      setDiagnosisInput(fetchedDiagnosis);
    } catch {
      setViewBillDetails(null);
      setDiagnosisInput('');
    } finally {
      setIsViewBillDetailsLoading(false);
    }
  }

  async function handlePrintBill(bill: BillRow) {
    const backendBillId = bill.backendBillId ?? billingRecords.find((row) => row.id === bill.id)?.backendBillId;
    if (!backendBillId) {
      setToast({ type: 'error', message: 'Unable to print bill. Missing bill ID.' });
      return;
    }

    try {
      const detailsResponse = await fetch(`${API_BASE_URL}/billing/bills/${backendBillId}`);
      if (!detailsResponse.ok) {
        throw new Error(`Bill details request failed (${detailsResponse.status}).`);
      }

      const detailsPayload = (await detailsResponse.json()) as ViewBillDetailsResponse;
      const detailsBill = detailsPayload.bill && typeof detailsPayload.bill === 'object'
        ? detailsPayload.bill as Record<string, unknown>
        : null;

      if (!detailsBill) {
        throw new Error('Unable to print bill. Missing bill details.');
      }

      const wasPrinted = detailsBill.is_printed === true;
      if (wasPrinted) {
        const shouldPrintAgain = window.confirm('This bill has already been printed. Print again?');
        if (!shouldPrintAgain) return;
      }

      await printFinalBill({
        bill: detailsBill,
        items: (Array.isArray(detailsPayload.items) ? detailsPayload.items : []) as Record<string, unknown>[],
      });

      const markPrintedResponse = await fetch(`${API_BASE_URL}/billing/bills/${backendBillId}/printed`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!markPrintedResponse.ok) {
        throw new Error(`Failed to mark bill as printed (${markPrintedResponse.status}).`);
      }

      const markPayload = (await markPrintedResponse.json()) as { bill?: Record<string, unknown> };
      const updatedPrintedBill = markPayload.bill && typeof markPayload.bill === 'object'
        ? markPayload.bill
        : detailsBill;

      setViewBillDetails((prev) => {
        if (!prev || !prev.bill || Number((prev.bill as Record<string, unknown>).bill_id) !== backendBillId) return prev;
        return {
          ...prev,
          bill: {
            ...(prev.bill as Record<string, unknown>),
            is_printed: updatedPrintedBill.is_printed ?? true,
            printed_at: updatedPrintedBill.printed_at ?? new Date().toISOString(),
          },
        };
      });

      setToast({ type: 'success', message: 'Bill printed successfully.' });
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Unable to print bill.' });
    }
  }

  function openCancelModal(bill: BillRow) {
    loadBillDetails(bill);
    setCancelReason('');
    setModal('cancelBill');
  }

  function openReceiptModal(bill: BillRow) {
    loadBillDetails(bill);
    setSelectedPayRow(bill);
    setModal('receipt');
  }

  function updateServiceQuantity(index: number, rawValue: string) {
    setServices(prev => {
      const next = [...prev]; const target = next[index]; if (!target) return prev;
      const requestedQuantity = toSafeQuantity(rawValue);
      if (target.type !== 'medication') { next[index] = { ...target, quantity: requestedQuantity }; return next; }
      const catalogItem = medicationCatalog.find(i => i.medication_id === target.logId);
      const available = catalogItem?.total_stock ?? 0;
      if (available <= 0) { next[index] = { ...target, quantity: 1 }; return next; }
      if (requestedQuantity > available) { next[index] = { ...target, quantity: available }; return next; }
      next[index] = { ...target, quantity: requestedQuantity }; return next;
    });
  }

  function changeServiceQuantity(index: number, delta: number) {
    setServices(prev => {
      const next = [...prev]; const target = next[index]; if (!target) return prev;
      const requestedQuantity = Math.max(1, target.quantity + delta);
      if (target.type !== 'medication') { next[index] = { ...target, quantity: requestedQuantity }; return next; }
      const catalogItem = medicationCatalog.find(i => i.medication_id === target.logId);
      const available = catalogItem?.total_stock ?? 0;
      if (requestedQuantity > available) { next[index] = { ...target, quantity: available }; return next; }
      next[index] = { ...target, quantity: requestedQuantity }; return next;
    });
  }

  function removeService(index: number) { setServices(prev => prev.filter((_, i) => i !== index)); }

  function handleCreateStatusChange(value: BillStatus) {
    setBillStatusInput(value);
    setBillIdInput(toAutoIds(value, billingRecords).billId);
  }

  async function handleSubmitBill() {
    if (isCreatingBill) return;

    setIsCreatingBill(true);
    try {
      const isEditingExisting = modal === 'viewBill';
      if (!isEditingExisting) {
        const patientId = parsePositiveInt(patientIdInput) ?? undefined;
        const status = normalizeBillStatus(billStatusInput);
        const id = billIdInput.trim() || toAutoIds(status, billingRecords).billId;
        await addBill({
          id, patient: patientNameInput.trim() || (patientId ? `Patient #${patientId}` : 'Unknown Patient'),
          date: visitDateInput.trim() || new Date().toISOString().slice(0, 10),
          total: `P${Math.round(finalBillTotal).toLocaleString()}`, status, patientId,
          doctorInCharge: doctorInput,
          age: patientAgeInput,
          gender: patientGenderInput,
          finalDiagnosis: diagnosisInput,
          admissionDateTime: admissionDateInput || undefined,
          dischargeDateTime: dischargeDateInput || undefined,
          referredBy: referredByInput,
          dischargeStatus: dischargeStatusInput,
          isSeniorCitizen,
          isPwd,
          discountType,
          discountRate,
          subtotalMedications: Number(subtotalMedications.toFixed(2)),
          subtotalLaboratory: Number(subtotalLaboratory.toFixed(2)),
          subtotalMiscellaneous: Number(subtotalMiscellaneous.toFixed(2)),
          lessAmount: Number(computedLessAmount.toFixed(2)),
          subtotalRoomCharge: Number(subtotalRoomCharge.toFixed(2)),
          subtotalProfessionalFee: Number(subtotalProfessionalFee.toFixed(2)),
          group1Total: Number(group1Total.toFixed(2)),
          group2Total: Number(group2Total.toFixed(2)),
          netAmount: Number(finalBillTotal.toFixed(2)),
          items: services.map(s => ({ name: s.name, quantity: s.quantity, unitPrice: s.unitPrice, serviceId: s.serviceId ?? null, logId: s.logId ?? null })),
        });
      }
      setModal('billSuccess');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to create bill.');
    } finally {
      setIsCreatingBill(false);
    }
  }

  const paymentMethodLabel = selectedMethod === 'Cash' ? 'Cash' : selectedMethod === 'Maya' ? 'E-Wallet (Maya)' : 'E-Wallet (GCash)';

  const paymentBill = paymentBillDetails?.bill ?? null;
  const paymentAmountDue = Number(
    paymentBillDetails?.remaining_balance ??
      paymentBill?.net_amount ??
      paymentBill?.total_amount ??
      toAmount(selectedPayRow.total)
  );
  const safePaymentAmountDue = Number.isFinite(paymentAmountDue) ? Math.max(0, paymentAmountDue) : 0;
  const paymentBillCode = paymentBill?.bill_code || selectedPayRow.id;
  const paymentPatientId = paymentBill?.patient_id ?? selectedPayRow.patientId ?? null;
  const paymentBillStatus = paymentBill?.status || selectedPayRow.status;
  const paymentBillCreatedAt = paymentBill?.created_at || selectedPayRow.date;
  const paymentTotalPaid = Number(paymentBillDetails?.total_paid ?? 0);

  const paymentPatientName = useMemo(() => {
    const relation = Array.isArray(paymentBill?.tbl_patients) ? paymentBill.tbl_patients[0] : paymentBill?.tbl_patients;
    const patient = relation && typeof relation === 'object' ? relation : null;
    if (patient) {
      const candidates = [patient.full_name, patient.patient_name, patient.name];
      for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      const combined = [patient.first_name, patient.middle_name, patient.last_name]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' ')
        .trim();
      if (combined) return combined;
    }
    return selectedPayRow.patient || 'Unknown Patient';
  }, [paymentBill, selectedPayRow.patient]);

  function closeAuxiliaryModals() {
    setModal('none');
    setSelectedPayRow(EMPTY_BILL_ROW);
    setPaymentBillDetails(null);
    setIsPaymentDetailsLoading(false);
    setPaymentDetailsError('');
    setSelectedMethod('Cash');
    setPaymentAmount('');
    setPaymentReferenceInput('');
    setPaymentNotes('');
    setPaymentErrors({});
    setCancelReason('');
  }

  function printBillDocument(kind: 'bill' | 'receipt') {
    const activeBill = selectedBill ?? selectedPayRow;
    if (!activeBill) return;
    const meta = billMetaById[activeBill.id] ?? buildDefaultBillMeta(activeBill);
    const resolvedTotal = meta.services.length
      ? meta.services.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      : toAmount(activeBill.total);
    const resolvedDiscount = meta.isSeniorCitizen ? resolvedTotal * SENIOR_DISCOUNT_RATE : 0;
    const resolvedTax = meta.isSeniorCitizen ? 0 : resolvedTotal * VAT_RATE;
    const finalTotal = meta.services.length ? resolvedTotal - resolvedDiscount + resolvedTax : toAmount(activeBill.total);
    const receiptNumber = `RCT-${activeBill.id}`;

    const printWindow = window.open('', '_blank', 'width=760,height=900');
    if (!printWindow) {
      window.alert(`Please allow pop-ups to print the ${kind}.`);
      return;
    }

    const serviceRows = meta.services.length
      ? meta.services.map((service) => `
          <tr>
            <td>${escapeHtml(service.name)}</td>
            <td style="text-align:center;">${service.quantity}</td>
            <td style="text-align:right;">${formatPhp(service.unitPrice)}</td>
            <td style="text-align:right;">${formatPhp(service.quantity * service.unitPrice)}</td>
          </tr>
        `).join('')
      : `
        <tr>
          <td colspan="4" style="text-align:center; color:#6b7280;">No billed items recorded.</td>
        </tr>
      `;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${kind === 'receipt' ? 'Receipt' : 'Bill'} ${escapeHtml(activeBill.id)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
            .header { margin-bottom: 24px; }
            .title { font-size: 24px; font-weight: 700; margin: 0 0 6px; }
            .subtitle { color: #4b5563; margin: 0; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin: 24px 0; }
            .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
            .value { font-size: 14px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin: 24px 0; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; font-size: 14px; }
            th { text-align: left; color: #4b5563; }
            .summary { margin-left: auto; width: 280px; }
            .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
            .summary-row.total { border-top: 2px solid #d1d5db; margin-top: 6px; padding-top: 12px; font-size: 16px; font-weight: 700; }
            .footer { margin-top: 32px; font-size: 12px; color: #6b7280; text-align: center; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <p class="title">CliniKaPlus</p>
            <p class="subtitle">${kind === 'receipt' ? 'OFFICIAL RECEIPT' : 'BILLING STATEMENT'}</p>
          </div>

          <div class="meta">
            <div>
              <div class="label">${kind === 'receipt' ? 'Receipt No.' : 'Bill ID'}</div>
              <div class="value">${escapeHtml(kind === 'receipt' ? receiptNumber : activeBill.id)}</div>
            </div>
            <div>
              <div class="label">${kind === 'receipt' ? 'Date & Time' : 'Date Created'}</div>
              <div class="value">${escapeHtml(kind === 'receipt' ? toDateTimeDisplay(meta.paymentDateTime || meta.createdAt) : toDateTimeDisplay(meta.createdAt))}</div>
            </div>
            <div>
              <div class="label">Patient</div>
              <div class="value">${escapeHtml(activeBill.patient)}</div>
            </div>
            <div>
              <div class="label">Patient ID</div>
              <div class="value">${escapeHtml(meta.patientId)}</div>
            </div>
            <div>
              <div class="label">Doctor</div>
              <div class="value">${escapeHtml(meta.doctor || 'N/A')}</div>
            </div>
            <div>
              <div class="label">${kind === 'receipt' ? 'Payment Method' : 'Status'}</div>
              <div class="value">${escapeHtml(kind === 'receipt' ? (meta.paymentMethod || 'N/A') : activeBill.status)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Unit Price</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${serviceRows}</tbody>
          </table>

          <div class="summary">
            <div class="summary-row"><span>Subtotal</span><strong>${formatPhp(resolvedTotal)}</strong></div>
            <div class="summary-row"><span>Discount</span><strong>${formatPhp(resolvedDiscount)}</strong></div>
            <div class="summary-row"><span>Tax</span><strong>${formatPhp(resolvedTax)}</strong></div>
            <div class="summary-row total"><span>${kind === 'receipt' ? 'Amount Paid' : 'Total Amount'}</span><span>${formatPhp(finalTotal)}</span></div>
          </div>

          <div class="footer">
            ${kind === 'receipt'
              ? `Reference Number: ${escapeHtml(meta.paymentReference || 'N/A')} | Processed by: ${escapeHtml(meta.processedBy)}`
              : `Processed by: ${escapeHtml(meta.processedBy)}${meta.cancelledBy ? ` | Cancelled by: ${escapeHtml(meta.cancelledBy)}` : ''}`}
          </div>
          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  function validatePaymentInput(): boolean {
    const nextErrors: PaymentValidationErrors = {};
    const amountRaw = String(paymentAmount || '').trim();
    const amountPaid = Number(amountRaw);

    if (!selectedMethod || !['Cash', 'GCash', 'Maya'].includes(selectedMethod)) {
      nextErrors.payment_method = 'Please select a payment method.';
    }
    if (!amountRaw || Number.isNaN(amountPaid) || amountPaid <= 0) {
      nextErrors.amount_paid = 'Please enter the amount paid.';
    }
    if ((selectedMethod === 'GCash' || selectedMethod === 'Maya') && !paymentReferenceInput.trim()) {
      nextErrors.reference_number = 'Reference number is required for GCash and Maya payments.';
    }

    setPaymentErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleProceedFromMethod() {
    if (!selectedMethod || !['Cash', 'GCash', 'Maya'].includes(selectedMethod)) {
      setPaymentErrors((prev) => ({ ...prev, payment_method: 'Please select a payment method.' }));
      return;
    }
    setPaymentErrors((prev) => ({ ...prev, payment_method: undefined }));
    setModal(selectedMethod === 'Cash' ? 'payCash' : 'payGcash');
  }

  function handleReviewPayment() {
    if (!validatePaymentInput()) return;
    setModal('payConfirm');
  }

  async function handleConfirmPayment() {
    if (!selectedPayRow.id || isSubmitting) return;
    if (!selectedPayRow.backendBillId) {
      setToast({ type: 'error', message: 'Failed to record payment. Please try again.' });
      return;
    }
    if (!validatePaymentInput()) {
      setModal(selectedMethod === 'Cash' ? 'payCash' : 'payGcash');
      return;
    }
    const amountPaid = Number(paymentAmount || 0);
    try {
      setIsSubmitting(true);
      const paidDate = new Date().toISOString();
      await markPaymentPaid({
        id: selectedPayRow.id,
        method: selectedMethod,
        amountPaid,
        reference: paymentReferenceInput.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
        paidDate,
      });
      const refreshedBill = billingRecords.find((row) => row.id === selectedPayRow.id);
      const updatedBill: BillRow = refreshedBill
        ? { ...refreshedBill, status: 'Paid' }
        : { ...selectedPayRow, status: 'Paid', date: paidDate };
      setBillMetaById((prev) => ({
        ...prev,
        [selectedPayRow.id]: {
          ...(prev[selectedPayRow.id] ?? buildDefaultBillMeta(selectedPayRow)),
          paymentMethod: selectedMethod,
          paymentDateTime: paidDate,
          paymentReference: paymentReferenceInput.trim() || undefined,
          amountPaid,
          processedBy: 'Staff',
        },
      }));
      setSelectedBill(updatedBill);
      setSelectedPayRow(updatedBill);
      await fetchViewBillDetails(updatedBill);
      setModal('paySuccess');
      setToast({ type: 'success', message: 'Payment recorded successfully.' });
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to record payment. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelBill() {
    if (!selectedBill) return;
    if (!cancelReason.trim()) {
      window.alert('Cancellation reason is required.');
      return;
    }
    try {
      await cancelBill(selectedBill.id);
      setBillMetaById((prev) => ({
        ...prev,
        [selectedBill.id]: {
          ...(prev[selectedBill.id] ?? buildDefaultBillMeta(selectedBill)),
          cancelledBy: 'Staff',
          cancelledReason: cancelReason.trim(),
        },
      }));
      const updatedBill: BillRow = { ...selectedBill, status: 'Cancelled' };
      setSelectedBill(updatedBill);
      setBillStatusInput('Cancelled');
      setToast({ type: 'success', message: 'Bill cancelled.' });
      setModal('viewBill');
      setCancelReason('');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to cancel bill.');
    }
  }

  const amountReceived = paymentAmount;
  const setAmountReceived = (value: string) => {
    setPaymentAmount(value);
    if (paymentErrors.amount_paid) {
      setPaymentErrors((prev) => ({ ...prev, amount_paid: undefined }));
    }
  };
  const gcashReference = paymentReferenceInput;
  const setGcashReference = (value: string) => {
    setPaymentReferenceInput(value);
    if (paymentErrors.reference_number) {
      setPaymentErrors((prev) => ({ ...prev, reference_number: undefined }));
    }
  };
  const changeAmount = useMemo(() => {
    if (!selectedPayRow.id) return 0;
    const received = Number(paymentAmount || 0);
    if (Number.isNaN(received)) return 0;
    return Math.max(0, received - safePaymentAmountDue);
  }, [paymentAmount, selectedPayRow.id, safePaymentAmountDue]);
  const overpaymentWarning = useMemo(() => {
    if (!selectedPayRow.id) return '';
    const received = Number(paymentAmount || 0);
    if (Number.isNaN(received) || received <= 0 || safePaymentAmountDue <= 0) return '';
    return received > safePaymentAmountDue * 1.5
      ? 'Amount paid is significantly higher than Amount Due. Please double-check before submitting.'
      : '';
  }, [paymentAmount, selectedPayRow.id, safePaymentAmountDue]);
  const paymentReference = paymentReferenceInput || 'N/A';
  function closePayModals() { closeAuxiliaryModals(); }
  function printBillReceipt() { printBillDocument('receipt'); }

  const isEditingExisting = modal === 'viewBill';

  // Focus handler for search navigation
  const focusBillId = useMemo(() => new URLSearchParams(location.search).get('focusBillId') || '', [location.search]);
  useEffect(() => {
    if (!focusBillId || focusHandledKey === focusBillId) return;
    setTimeout(() => {
      const node = document.querySelector(`[data-search-bill-id="${focusBillId}"]`);
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFocusHandledKey(focusBillId);
      }
    }, 120);
  }, [focusBillId, pagedBills, focusHandledKey]);

  return (
    <div className="flex h-full min-h-0 flex-col pb-4">
      {toast && (
        <div className="fixed right-4 top-4 z-[10000]">
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.message}
          </div>
        </div>
      )}

      <section className="flex flex-1 min-h-0 flex-col rounded-2xl bg-gray-300/80 p-5 space-y-5">
        {/* Billing Table */}
        <div ref={tableCardRef} className="flex min-h-0 flex-1 flex-col rounded-2xl bg-gray-100 p-4 md:p-5">
          <div ref={tableToolbarRef}>
            {shouldShowLoading ? <SkeletonBlock className="mb-3 h-8 w-44" /> : (
              <SectionToolbar
                className="mb-4"
                icon={ReceiptText}
                title="Billing Queue"
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Search Patient or Bill ID"
                searchWidthClass="w-full md:w-[420px]"
                rightControls={(
                  <>
                    <button type="button" onClick={openCreateModal} className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-green-500 px-3.5 text-sm font-semibold text-white hover:bg-green-600">
                      <PlusCircle size={16} /> Create New Bill
                    </button>
                    <div className="relative">
                      <select value={sortBy} onChange={e => setSortBy(e.target.value as BillingSort)} className="h-10 appearance-none rounded-lg border border-gray-300 bg-gray-100 pl-3 pr-9 text-sm font-medium text-gray-600 outline-none focus:ring-2 focus:ring-blue-300">
                        <option value="date">Sort: Date</option>
                        <option value="status">Sort: Status</option>
                        <option value="amount">Sort: Amount</option>
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                    <div className="relative">
                      <select value={billingFilter} onChange={e => setBillingFilter(e.target.value as BillingFilter)} className="h-10 appearance-none rounded-lg border border-gray-300 bg-gray-100 pl-3 pr-9 text-sm font-medium text-gray-600 outline-none focus:ring-2 focus:ring-blue-300">
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                  </>
                )}
              />
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-xl">
            {shouldShowLoading ? (
              <BillingTableSkeleton
                columns={[
                  { headerWidthClass: 'w-10', cellWidthClass: 'w-24' },
                  { headerWidthClass: 'w-28', cellWidthClass: 'w-44' },
                  { headerWidthClass: 'w-14', cellWidthClass: 'w-24' },
                  { headerWidthClass: 'w-14', cellWidthClass: 'w-20' },
                  { headerWidthClass: 'w-16', cellWidthClass: 'w-16' },
                  { headerWidthClass: 'w-16', cellWidthClass: 'w-28' },
                ]}
                rowCount={Math.max(5, Math.min(effectivePageSize, 12))}
              />
            ) : (
            <table className="min-w-full text-sm">
              <thead ref={tableHeadRef} className="bg-gray-200/90 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Patient Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Total</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedBills.map(bill => (
                  <tr key={bill.id} data-search-bill-id={bill.id} data-bill-row="true" className="border-t border-gray-200 text-gray-800 hover:bg-gray-200/40">
                    <td className="px-3 py-2 font-semibold">{bill.id}</td>
                    <td className="px-3 py-2 font-semibold">{bill.patient}</td>
                    <td className="px-3 py-2 font-semibold">{formatDateForTable(bill.date)}</td>
                    <td className="px-3 py-2 font-semibold">{bill.total.replace('P', '₱')}</td>
                    <td className="px-3 py-2 font-semibold"><StatusPill status={bill.status} /></td>
                    <td className="px-3 py-2 flex items-center gap-3">
                      <button type="button" onClick={() => openViewModal(bill)} className="font-semibold text-blue-600 hover:text-blue-700">View</button>
                      {bill.status === 'Pending' && <button type="button" onClick={() => openPaymentModal(bill)} className="font-semibold text-green-600 hover:text-green-700">Pay</button>}
                      {bill.status === 'Pending' && <button type="button" onClick={() => openCancelModal(bill)} className="font-semibold text-red-600 hover:text-red-700">Cancel</button>}
                    </td>
                  </tr>
                ))}
                  {!pagedBills.length && !shouldShowLoading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-gray-500">No billing records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>
          <div ref={tableFooterRef} className="mt-4 flex flex-col gap-2.5 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
            {shouldShowLoading ? (
              <>
                <SkeletonBlock className="h-4 w-52" />
                <BillingPaginationSkeleton />
              </>
            ) : (
              <>
                <p>Showing <span className="rounded-md bg-gray-300 px-2">{pagedBills.length}</span> out of {filteredBills.length}</p>
                {usePagination && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Modals ── */}
      {modal !== 'none' && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-4 ${
            modal === 'receipt'
              ? 'bg-slate-950/45 backdrop-blur-xl'
              : 'bg-black/40 backdrop-blur-md'
          }`}
          onClick={() => {
            if (isCreatingBill && modal === 'createBill') return;
            if (['payBill', 'payMethod', 'payCash', 'payGcash', 'payConfirm', 'paySuccess', 'payCancelConfirm', 'payCancelled', 'cancelBill', 'receipt'].includes(modal)) closeAuxiliaryModals();
            else if (modal === 'viewBillServicesFull') setModal('viewBill');
            else if (modal === 'addService' || modal === 'addMedication') setModal(prevModal);
            else setModal('none');
          }}
        >
          {/* ── Create / View Bill Modal ── */}
          {modal === 'createBill' && (
            <div className="relative flex max-h-[92vh] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800"><ReceiptText size={18} className="text-gray-500" />Create Bill</h3>
                <button type="button" onClick={() => setModal('none')} disabled={isCreatingBill} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"><X size={15} /></button>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[300px_1fr]">
                {/* LEFT PANEL */}
                <div className="border-r border-gray-200 p-5 space-y-5 bg-gray-50">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><User size={15} className="text-gray-400" />Bill and Patient Information</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div ref={patientPickerRef} className="col-span-2">
                        <p className="mb-1 text-xs text-gray-400">Patient Name</p>
                        {isEditingExisting ? (
                          <p className="font-bold text-gray-800">{patientNameInput || 'N/A'}</p>
                        ) : (
                          <div className="relative">
                            <input
                              value={patientSearchInput}
                              onChange={(e) => {
                                setPatientSearchInput(e.target.value);
                                setPatientIdInput('');
                                setPatientNameInput('');
                                setPatientAgeInput('');
                                setPatientGenderInput('');
                                setShowPatientDropdown(true);
                                setShowAddPatientForm(false);
                              }}
                              onFocus={() => setShowPatientDropdown(true)}
                              placeholder="Search patient by name..."
                              className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"
                            />
                            {showPatientDropdown && (
                              <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddPatientForm(true);
                                    setShowPatientDropdown(false);
                                  }}
                                  className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50"
                                >
                                  Add New Patient
                                </button>
                                {isPatientLoading && <p className="px-3 py-2 text-xs text-gray-500">Searching...</p>}
                                {!isPatientLoading && patientOptions.map((patient) => (
                                  <button
                                    key={patient.patient_id}
                                    type="button"
                                    onClick={() => selectPatientOption(patient)}
                                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    <span className="font-medium">{patient.full_name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="pr-3">
                        <p className="mb-1 text-xs text-gray-400">Age / Gender</p>
                        {isEditingExisting ? <p className="font-bold text-gray-800">{[patientAgeInput, patientGenderInput].filter(Boolean).join(' / ') || 'N/A'}</p> : <div className="flex gap-2"><input value={patientAgeInput} onChange={e => setPatientAgeInput(e.target.value)} placeholder="Age" className="h-8 w-16 rounded-lg border border-gray-200 bg-white px-2 text-sm" /><select value={patientGenderInput} onChange={e => setPatientGenderInput(e.target.value)} className="h-8 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-sm"><option value="">Gender</option><option value="Male">Male</option><option value="Female">Female</option></select></div>}
                      </div>
                      <div className="pl-3">
                        <p className="mb-1 text-xs text-gray-400">Doctor-in-Charge</p>
                        {isEditingExisting ? <p className="font-bold text-gray-800">{doctorInput}</p> : <input value={doctorInput} onChange={e => setDoctorInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}
                      </div>
                      <div className="col-span-2">
                        <p className="mb-1 text-xs text-gray-400">Final Diagnosis</p>
                        {isEditingExisting ? <p className="font-bold text-gray-800">{diagnosisInput}</p> : <input value={diagnosisInput} onChange={e => setDiagnosisInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-400">Admission Date &amp; Time</p>
                        {isEditingExisting ? <p className="font-bold text-gray-800">{admissionDateInput || 'N/A'}</p> : <input type="datetime-local" value={admissionDateInput} onChange={e => setAdmissionDateInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-400">Discharge Date &amp; Time</p>
                        {isEditingExisting ? <p className="font-bold text-gray-800">{dischargeDateInput || 'N/A'}</p> : <input type="datetime-local" value={dischargeDateInput} onChange={e => setDischargeDateInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-400">Referred By</p>
                        {isEditingExisting ? <p className="font-bold text-gray-800">{referredByInput || 'N/A'}</p> : <input value={referredByInput} onChange={e => setReferredByInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-400">Discharge Status</p>
                        {isEditingExisting ? <p className="font-bold text-gray-800">{dischargeStatusInput || 'N/A'}</p> : (
                          <select value={dischargeStatusInput} onChange={e => setDischargeStatusInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm">
                            <option value="">Select status</option>
                            <option value="Recovered">Recovered</option>
                            <option value="Improved">Improved</option>
                            <option value="Unimproved">Unimproved</option>
                            <option value="Transferred">Transferred</option>
                            <option value="Against Medical Advice">Against Medical Advice</option>
                            <option value="Expired">Expired</option>
                          </select>
                        )}
                      </div>
                      {!isEditingExisting && (
                        <div className="col-span-2 mt-1 rounded-lg border border-gray-200 bg-white p-3">
                          <p className="mb-2 text-xs font-semibold text-gray-600">Discount Eligibility</p>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSeniorCitizen}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setIsSeniorCitizen(checked);
                                  if (checked) setIsPwd(false);
                                }}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              Senior Citizen
                            </label>
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isPwd}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setIsPwd(checked);
                                  if (checked) setIsSeniorCitizen(false);
                                }}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              PWD
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="p-5 space-y-5">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Stethoscope size={15} className="text-gray-400" />Services and Treatment</h4>
                    <div className="max-h-[140px] overflow-y-auto pr-1">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-200">
                          <th className="pb-2 text-left font-medium">Service</th>
                          <th className="pb-2 text-center font-medium">Quantity</th>
                          <th className="pb-2 text-right font-medium">Price</th>
                          <th className="pb-2 text-right font-medium">Subtotal</th>
                          {!isEditingExisting && <th className="pb-2"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((service, idx) => (
                          <tr key={`${service.name}-${idx}`} className="border-b border-gray-100 text-gray-800">
                            <td className="py-2">{service.name}</td>
                            <td className="py-2 text-center">
                              {isEditingExisting ? service.quantity : (
                                <div className="inline-flex items-center gap-1.5">
                                  <button type="button" onClick={() => changeServiceQuantity(idx, -1)} className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200">-</button>
                                  <input type="number" min={1} value={service.quantity} onChange={e => updateServiceQuantity(idx, e.target.value)} className="h-6 w-12 rounded border border-gray-300 bg-transparent px-1 text-center text-xs" />
                                  <button type="button" onClick={() => changeServiceQuantity(idx, 1)} className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200">+</button>
                                </div>
                              )}
                            </td>
                            <td className="py-2 text-right">₱{service.unitPrice.toLocaleString()}</td>
                            <td className="py-2 text-right font-semibold">₱{(service.quantity * service.unitPrice).toLocaleString()}</td>
                            {!isEditingExisting && (
                              <td className="py-2 text-right pl-2">
                                <button type="button" onClick={() => removeService(idx)} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-500"><X size={10} /></button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {services.length === 0 && (
                          <tr><td colSpan={isEditingExisting ? 4 : 5} className="py-6 text-center text-xs text-gray-400">No services added yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                    </div>

                    {!isEditingExisting && (
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={openAddServiceModal} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
                          <CircleGauge size={14} />Add Service<ChevronDown size={14} />
                        </button>
                        <button type="button" onClick={openAddMedicationModal} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
                          <PlusCircle size={14} />Add Medication<ChevronDown size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Billing Breakdown */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><ReceiptText size={15} className="text-gray-400" />Billing Breakdown</h4>
                    <div className="space-y-1.5 text-sm">
                      {subtotalMedications > 0 && (
                        <div className="flex justify-between text-gray-700"><span className="font-medium">Medications</span><span className="font-semibold">{toPeso(subtotalMedications)}</span></div>
                      )}
                      {subtotalLaboratory > 0 && (
                        <div className="flex justify-between text-gray-700"><span className="font-medium">Laboratory</span><span className="font-semibold">{toPeso(subtotalLaboratory)}</span></div>
                      )}
                      {subtotalMiscellaneous > 0 && (
                        <div className="flex justify-between text-gray-700"><span className="font-medium">Miscellaneous</span><span className="font-semibold">{toPeso(subtotalMiscellaneous)}</span></div>
                      )}
                      {group1Total > 0 && (
                        <>
                          <div className="my-2 border-t border-gray-200" />
                          <div className="flex justify-between text-gray-700"><span className="font-semibold">Subtotal</span><span className="font-semibold">{toPeso(group1Total)}</span></div>
                          <div className="flex justify-between text-gray-800"><span className="font-bold">Total Amount</span><span className="font-bold">{toPeso(group1Total)}</span></div>
                        </>
                      )}

                      {subtotalRoomCharge > 0 && (
                        <div className="flex justify-between text-gray-700"><span className="font-medium">Room Charge</span><span className="font-semibold">{toPeso(subtotalRoomCharge)}</span></div>
                      )}
                      {subtotalProfessionalFee > 0 && (
                        <div className="flex justify-between text-gray-700"><span className="font-medium">Professional Fee</span><span className="font-semibold">{toPeso(subtotalProfessionalFee)}</span></div>
                      )}
                      {group2Total > 0 && (
                        <>
                          <div className="my-2 border-t border-gray-200" />
                          <div className="flex justify-between text-gray-800"><span className="font-bold">Total Amount</span><span className="font-bold">{toPeso(group2Total)}</span></div>
                        </>
                      )}

                      <div className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-2">
                        <div className="flex justify-between text-base font-bold text-gray-900">
                          <span>Final Bill</span>
                          <span>{toPeso(finalBillTotal)}</span>
                        </div>
                        <div className="mt-1 flex justify-between text-sm text-gray-700">
                          <span>Subtotal</span>
                          <span className="font-semibold">{toPeso(totalBeforeDiscount)}</span>
                        </div>
                        {lessAmount > 0 && (
                          <div className="mt-1 flex justify-between text-sm text-gray-700">
                            <span>Less ({discountType})</span>
                            <span className="font-semibold">{toPeso(lessAmount)}</span>
                          </div>
                        )}
                        <div className="mt-1 flex justify-between text-sm text-gray-700">
                          <span>Total Amount</span>
                          <span className="font-semibold">{toPeso(finalBillTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={handleSubmitBill} disabled={isCreatingBill} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
                      {isCreatingBill ? 'Creating New Bill...' : 'Create New Bill'}
                    </button>
                  </div>
                </div>
              </div>

              {!isEditingExisting && showAddPatientForm && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4" onClick={() => setShowAddPatientForm(false)}>
                  <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <p className="mb-3 text-sm font-bold text-gray-700">Add New Patient</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="mb-1 text-xs text-gray-400">First Name</p>
                        <input value={newPatientFirstName} onChange={e => setNewPatientFirstName(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-400">Last Name</p>
                        <input value={newPatientLastName} onChange={e => setNewPatientLastName(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-400">Date of Birth</p>
                        <input type="date" value={newPatientDob} onChange={e => setNewPatientDob(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-400">Gender</p>
                        <select value={newPatientGender} onChange={e => setNewPatientGender(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-400">Contact Number</p>
                        <input value={newPatientContactNumber} onChange={e => setNewPatientContactNumber(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-gray-400">Email Address</p>
                        <input value={newPatientEmailAddress} onChange={e => setNewPatientEmailAddress(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" onClick={() => setShowAddPatientForm(false)} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700">Cancel</button>
                      <button type="button" onClick={handleCreatePatientOption} disabled={isCreatingPatient} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-60">{isCreatingPatient ? 'Saving...' : 'Save Patient'}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Add Service Modal ── */}
          {modal === 'viewBill' && selectedBill && selectedBillMeta && (
            <div className="my-4 flex max-h-[92vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Bill Control Panel</p>
                    <h3 className="mt-1 text-2xl font-bold text-gray-900">{selectedBill.id}</h3>
                    <p className="mt-1 text-sm text-gray-500">Date created: {toDateTimeDisplay((viewBill && typeof viewBill.created_at === 'string' && viewBill.created_at) ? viewBill.created_at : selectedBillMeta.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={selectedBill.status} />
                    <button type="button" onClick={() => setModal('none')} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={16} /></button>
                  </div>
                </div>
              </div>

              <div className="relative min-h-0 flex-1 overflow-y-scroll">
              <div className="grid min-h-full grid-cols-1 gap-5 p-6 lg:grid-cols-[1.25fr_0.95fr]">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700"><User size={15} className="text-gray-400" />Patient Info</h4>
                    <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <div><p className="text-xs text-gray-400">Name</p><p className="font-bold text-gray-800">{viewPatient ? [viewPatient.first_name, viewPatient.last_name].filter((v): v is string => typeof v === 'string' && v.trim().length > 0).join(' ').trim() || selectedBill.patient : selectedBill.patient}</p></div>
                      <div><p className="text-xs text-gray-400">Patient ID</p><p className="font-bold text-gray-800">{viewBill && Number.isFinite(Number(viewBill.patient_id)) ? String(Number(viewBill.patient_id)) : selectedBillMeta.patientId}</p></div>
                      <div><p className="text-xs text-gray-400">Age / Gender</p><p className="font-bold text-gray-800">{`${viewPatient && typeof viewPatient.date_of_birth === 'string' ? (toAgeFromBirthDate(viewPatient.date_of_birth) || 'N/A') : (selectedBillMeta.age || 'N/A')} / ${viewPatient && typeof viewPatient.gender === 'string' && viewPatient.gender.trim() ? viewPatient.gender : (selectedBillMeta.gender || 'N/A')}`}</p></div>
                      <div><p className="text-xs text-gray-400">Doctor</p><p className="font-bold text-gray-800">{viewBill && typeof viewBill.doctor_in_charge === 'string' && viewBill.doctor_in_charge.trim() ? viewBill.doctor_in_charge : selectedBillMeta.doctor}</p></div>
                      <div><p className="text-xs text-gray-400">Diagnosis</p><p className="font-bold text-gray-800">{diagnosisInput || 'N/A'}</p></div>
                      <div><p className="text-xs text-gray-400">Admission Date &amp; Time</p><p className="font-bold text-gray-800">{viewBill && typeof viewBill.admission_datetime === 'string' && viewBill.admission_datetime ? toDateTimeDisplayNoTimezoneShift(viewBill.admission_datetime) : 'N/A'}</p></div>
                      <div><p className="text-xs text-gray-400">Discharge Date &amp; Time</p><p className="font-bold text-gray-800">{viewBill && typeof viewBill.discharge_datetime === 'string' && viewBill.discharge_datetime ? toDateTimeDisplayNoTimezoneShift(viewBill.discharge_datetime) : 'N/A'}</p></div>
                      <div><p className="text-xs text-gray-400">Referred By</p><p className="font-bold text-gray-800">{viewBill && typeof viewBill.referred_by === 'string' && viewBill.referred_by.trim() ? viewBill.referred_by : 'N/A'}</p></div>
                      <div><p className="text-xs text-gray-400">Discharge Status</p><p className="font-bold text-gray-800">{viewBill && typeof viewBill.discharge_status === 'string' && viewBill.discharge_status.trim() ? viewBill.discharge_status : 'N/A'}</p></div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700"><Stethoscope size={15} className="text-gray-400" />Services Table</h4>
                      <button
                        type="button"
                        onClick={() => { setPrevModal(modal); setModal('viewBillServicesFull'); }}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        <Maximize2 size={13} />
                        Full View
                      </button>
                    </div>
                    <div className="max-h-[168px] overflow-y-auto pr-1">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-xs text-gray-500">
                            <th className="pb-2 text-left font-medium">Service</th>
                            <th className="pb-2 text-center font-medium">Quantity</th>
                            <th className="pb-2 text-right font-medium">Price</th>
                            <th className="pb-2 text-right font-medium">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewServicesByType.length > 0 ? viewServicesByType.map((group) => (
                            <Fragment key={group.label}>
                              <tr className="border-b border-gray-100 bg-gray-50 text-gray-700">
                                <td colSpan={4} className="py-2 font-bold">{group.label}</td>
                              </tr>
                              {group.items.map((item, idx) => (
                                <tr key={`${group.label}-${item.bill_item_id ?? idx}`} className="border-b border-gray-100 text-gray-800">
                                  <td className="py-2">{item.description || 'N/A'}</td>
                                  <td className="py-2 text-center">{Number(item.quantity || 0)}</td>
                                  <td className="py-2 text-right">{toPeso(Number(item.unit_price || 0))}</td>
                                  <td className="py-2 text-right font-semibold">{toPeso(Number(item.subtotal || 0))}</td>
                                </tr>
                              ))}
                              <tr className="border-b border-gray-100 text-gray-800">
                                <td colSpan={3} className="py-2 text-right font-semibold">Group Total</td>
                                <td className="py-2 text-right font-bold">{toPeso(group.total)}</td>
                              </tr>
                            </Fragment>
                          )) : (
                            <tr>
                              <td colSpan={4} className="py-3 text-center text-gray-500">{isViewBillDetailsLoading ? 'Loading services...' : 'No billed services found.'}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><ReceiptText size={15} className="text-gray-400" />Bill Summary</h4>
                    <div className="space-y-2 text-sm text-gray-700">
                      {viewSummary.subtotalMedications > 0 && <div className="flex justify-between"><span>Medications</span><span className="font-semibold">{toPeso(viewSummary.subtotalMedications)}</span></div>}
                      {viewSummary.subtotalLaboratory > 0 && <div className="flex justify-between"><span>Laboratory</span><span className="font-semibold">{toPeso(viewSummary.subtotalLaboratory)}</span></div>}
                      {viewSummary.subtotalMiscellaneous > 0 && <div className="flex justify-between"><span>Miscellaneous</span><span className="font-semibold">{toPeso(viewSummary.subtotalMiscellaneous)}</span></div>}
                      {viewSummary.subtotalRoomCharge > 0 && <div className="flex justify-between"><span>Room Charge</span><span className="font-semibold">{toPeso(viewSummary.subtotalRoomCharge)}</span></div>}
                      {viewSummary.subtotalProfessionalFee > 0 && <div className="flex justify-between"><span>Professional Fee</span><span className="font-semibold">{toPeso(viewSummary.subtotalProfessionalFee)}</span></div>}
                      <div className="flex justify-between"><span>Services Total</span><span className="font-semibold">{toPeso(viewSummary.group1Total)}</span></div>
                      <div className="flex justify-between"><span>Room &amp; Professional Fees</span><span className="font-semibold">{toPeso(viewSummary.group2Total)}</span></div>
                      <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{toPeso(viewSummary.subtotal)}</span></div>
                      {viewSummary.lessAmount > 0 && (
                        <div className="flex justify-between"><span>{viewSummary.discountType && viewSummary.discountType !== 'None' ? `Less (${viewSummary.discountType})` : 'Less'}</span><span className="font-semibold">{toPeso(viewSummary.lessAmount)}</span></div>
                      )}
                      <div className="border-t border-gray-300 pt-2 flex justify-between text-base font-bold text-gray-900">
                        <span>Final Bill</span>
                        <span>{toPeso(viewSummary.netAmount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Wallet size={15} className="text-gray-400" />Payment Section</h4>
                    <div className="mb-3 flex justify-between text-sm text-gray-700">
                      <span>Amount Due</span>
                      <span className="font-semibold">{toPeso(viewSummary.netAmount)}</span>
                    </div>
                    <div className="mb-3 flex justify-between text-sm text-gray-700">
                      <span>Received by</span>
                      {latestViewPaymentReceiverName ? (
                        <span className="flex flex-wrap items-center justify-end gap-2 text-right">
                          <span className="font-semibold">{latestViewPaymentReceiverName}</span>
                          {latestViewPaymentReceiverRole && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700">
                              {latestViewPaymentReceiverRole}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="font-semibold">N/A</span>
                      )}
                    </div>
                    {selectedBill.status === 'Paid' ? (
                      <div className="space-y-2 text-sm text-gray-700">
                        <div className="flex justify-between"><span>Payment Method</span><span className="font-semibold">{latestViewPayment?.payment_method || selectedBillMeta.paymentMethod || selectedPaymentRecord?.method || 'N/A'}</span></div>
                        <div className="flex justify-between"><span>Payment Date &amp; Time</span><span className="font-semibold">{toDateTimeDisplay(latestViewPayment?.payment_date || selectedBillMeta.paymentDateTime || selectedBill.date)}</span></div>
                        <div className="flex justify-between"><span>Reference Number</span><span className="font-semibold">{latestViewPaymentWithReference?.reference_number || 'N/A'}</span></div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No payment recorded yet.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Info size={15} className="text-gray-400" />Activity / Verification</h4>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex items-start justify-between gap-4">
                        <span>Created by</span>
                        {creatorFullName ? (
                          <span className="flex flex-wrap items-center justify-end gap-2 text-right">
                            <span className="font-semibold">{creatorFullName}</span>
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700">
                              {creatorRole || 'N/A'}
                            </span>
                          </span>
                        ) : (
                          <span className="font-semibold">N/A</span>
                        )}
                      </div>
                      {selectedBill.status === 'Cancelled' && (
                        <>
                          <div className="flex justify-between"><span>Cancelled by</span><span className="font-semibold">{selectedBillMeta.cancelledBy || 'Staff'}</span></div>
                          <div><p className="text-xs text-gray-400">Reason</p><p className="mt-1 rounded-lg bg-white px-3 py-2 text-sm text-gray-700">{selectedBillMeta.cancelledReason || 'No reason provided.'}</p></div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedBill.status === 'Pending' && (
                      <>
                        <button type="button" onClick={() => openPaymentModal(selectedBill)} className="h-10 flex-1 rounded-xl bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-700">Pay</button>
                        <button type="button" onClick={() => openCancelModal(selectedBill)} className="h-10 flex-1 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700">Cancel</button>
                        <button type="button" onClick={() => { void handlePrintBill(selectedBill); }} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50">Print Bill</button>
                      </>
                    )}
                    {selectedBill.status === 'Paid' && (
                      <>
                        <button type="button" onClick={() => { void handlePrintBill(selectedBill); }} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50">Print Bill</button>
                      </>
                    )}
                    {selectedBill.status === 'Cancelled' && (
                      <button type="button" onClick={() => { void handlePrintBill(selectedBill); }} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50">Print Bill</button>
                    )}
                  </div>
                </div>
              </div>
              {isViewBillDetailsLoading && (
                <div className="absolute inset-0 z-10 bg-white/90 p-6">
                  <div className="grid h-full grid-cols-1 gap-5 lg:grid-cols-[1.25fr_0.95fr]">
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-3 h-4 w-28 animate-pulse rounded bg-gray-200" />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="h-10 animate-pulse rounded bg-gray-200" />
                          <div className="h-10 animate-pulse rounded bg-gray-200" />
                          <div className="h-10 animate-pulse rounded bg-gray-200" />
                          <div className="h-10 animate-pulse rounded bg-gray-200" />
                          <div className="h-10 animate-pulse rounded bg-gray-200" />
                          <div className="h-10 animate-pulse rounded bg-gray-200" />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-gray-200" />
                        <div className="space-y-2">
                          <div className="h-8 animate-pulse rounded bg-gray-200" />
                          <div className="h-8 animate-pulse rounded bg-gray-200" />
                          <div className="h-8 animate-pulse rounded bg-gray-200" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-gray-200" />
                        <div className="space-y-2">
                          <div className="h-6 animate-pulse rounded bg-gray-200" />
                          <div className="h-6 animate-pulse rounded bg-gray-200" />
                          <div className="h-6 animate-pulse rounded bg-gray-200" />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-3 h-4 w-28 animate-pulse rounded bg-gray-200" />
                        <div className="space-y-2">
                          <div className="h-6 animate-pulse rounded bg-gray-200" />
                          <div className="h-6 animate-pulse rounded bg-gray-200" />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-3 h-4 w-36 animate-pulse rounded bg-gray-200" />
                        <div className="space-y-2">
                          <div className="h-6 animate-pulse rounded bg-gray-200" />
                          <div className="h-6 animate-pulse rounded bg-gray-200" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {modal === 'addService' && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-gray-100"><Stethoscope size={20} className="text-gray-500" /></div>
                <h3 className="text-xl font-bold text-gray-800">Add Service</h3>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Service Type</label>
                <div className="relative">
                  <button type="button" className="w-full h-10 flex items-center justify-between px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:bg-gray-100" onClick={() => { setShowServiceTypeDropdown(v => !v); setShowServiceDropdown(false); }}>
                    <span className={selectedServiceType ? 'text-gray-800 font-medium' : 'text-gray-400'}>{selectedServiceType?.name || 'Select service type...'}</span>
                    <ChevronDown size={16} className="text-gray-400" />
                  </button>
                  {showServiceTypeDropdown && (
                    <div className="absolute left-0 top-11 z-20 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input value={serviceTypeSearch} onChange={e => setServiceTypeSearch(e.target.value)} placeholder="Search Service Type" className="h-8 w-full pl-8 pr-3 rounded-lg border border-gray-200 bg-gray-50 text-sm" />
                        </div>
                      </div>
                      <div className="max-h-44 overflow-auto">
                        {filteredServiceTypes.map(type => (
                          <button key={type.id} type="button" className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-600 hover:text-white transition-colors ${selectedServiceType?.id === type.id ? 'bg-blue-600 text-white' : 'text-gray-700'}`} onClick={() => { setSelectedServiceType(type); setSelectedService(null); setServiceSearch(''); setShowServiceTypeDropdown(false); }}>
                            {type.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Service Name</label>
                <div className="relative">
                  <button type="button" className="w-full h-10 flex items-center justify-between px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50" onClick={() => { if (selectedServiceType) setShowServiceDropdown(v => !v); }} disabled={!selectedServiceType}>
                    <span className={selectedService ? 'text-gray-800 font-medium' : 'text-gray-400'}>{selectedService?.name || 'Select service...'}</span>
                    <ChevronDown size={16} className="text-gray-400" />
                  </button>
                  {showServiceDropdown && selectedServiceType && (
                    <div className="absolute left-0 top-11 z-20 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} placeholder="Search Service" className="h-8 w-full pl-8 pr-3 rounded-lg border border-gray-200 bg-gray-50 text-sm" />
                        </div>
                      </div>
                      <div className="max-h-44 overflow-auto">
                        {filteredServiceOptions.map(svc => (
                          <button key={svc.id} type="button" className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-600 hover:text-white transition-colors ${selectedService?.id === svc.id ? 'bg-blue-600 text-white' : 'text-gray-700'}`} onClick={() => { setSelectedService(svc); setServiceUnitPrice(svc.unitPrice); setShowServiceDropdown(false); }}>
                            {svc.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quantity</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} value={serviceQty} onChange={e => setServiceQty(Math.max(1, Number(e.target.value)))} className="h-10 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-center" />
                    <button type="button" onClick={() => setServiceQty(q => q + 1)} className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-200 bg-gray-100 hover:bg-gray-200"><Plus size={14} /></button>
                    <button type="button" onClick={() => setServiceQty(q => Math.max(1, q - 1))} className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-200 bg-gray-100 hover:bg-gray-200"><Minus size={14} /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unit Price</label>
                  <input type="number" min={0} value={serviceUnitPrice} onChange={e => setServiceUnitPrice(Number(e.target.value))} className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                {addItemFeedback && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{addItemFeedback}</p>
                )}
                <button type="button" onClick={confirmAddService} disabled={!selectedService} className="h-10 w-full rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">Add Item</button>
                <button type="button" onClick={() => setModal(prevModal)} className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* ── Add Medication Modal ── */}
          {modal === 'addMedication' && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-gray-100"><PlusCircle size={20} className="text-gray-500" /></div>
                <h3 className="text-xl font-bold text-gray-800">Add Medication</h3>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Medication Name</label>
                <div className="relative">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={medicationSearch} onChange={e => { setMedicationSearch(e.target.value); setShowMedicationDropdown(true); setSelectedMedication(null); }} onFocus={() => setShowMedicationDropdown(true)} placeholder="Search Medication" className="h-10 w-full pl-9 pr-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  {showMedicationDropdown && filteredMedicationOptions.length > 0 && (
                    <div className="absolute left-0 top-11 z-20 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                      <div className="max-h-44 overflow-auto">
                        {filteredMedicationOptions.map(med => (
                          <button key={med.medication_id} type="button" className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-blue-600 hover:text-white transition-colors ${selectedMedication?.medication_id === med.medication_id ? 'bg-blue-600 text-white' : ''}`} onClick={() => { setSelectedMedication(med); setMedicationSearch(med.medication_name); setMedicationUnitPrice(resolveMedicationUnitPrice(med.medication_name)); setMedicationQty(1); setShowMedicationDropdown(false); }}>
                            <p className="font-semibold">{med.medication_name}</p>
                            <p className={`text-xs ${selectedMedication?.medication_id === med.medication_id ? 'text-blue-100' : 'text-gray-400'}`}>Stock: {med.total_stock} {med.unit || 'pcs'} &nbsp;·&nbsp; Batch: {med.batch_number || 'N/A'}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {selectedMedication && (
                <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-xs text-gray-400">Batch</p><p className="font-bold text-gray-800">{selectedMedication.batch_number || 'N/A'}</p></div>
                    <div><p className="text-xs text-gray-400">Available</p><p className="font-bold text-gray-800">{selectedMedication.total_stock} {selectedMedication.unit || 'pcs'}</p></div>
                  </div>
                  <div><p className="text-xs text-gray-400">Expiry</p><p className="font-bold text-gray-800">{selectedMedication.expiry_date ? formatDateMed(selectedMedication.expiry_date) : 'N/A'}</p></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quantity</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} value={medicationQty} onChange={e => setMedicationQty(Math.max(1, Number(e.target.value)))} className="h-10 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-center" />
                    <button type="button" onClick={() => setMedicationQty(q => q + 1)} className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-200 bg-gray-100 hover:bg-gray-200"><Plus size={14} /></button>
                    <button type="button" onClick={() => setMedicationQty(q => Math.max(1, q - 1))} className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-200 bg-gray-100 hover:bg-gray-200"><Minus size={14} /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unit Price</label>
                  <input type="number" min={0} value={medicationUnitPrice} onChange={e => setMedicationUnitPrice(Number(e.target.value))} className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" />
                </div>
              </div>
              <div className="flex justify-between items-center mb-5 px-1 text-sm font-semibold text-gray-700">
                <span>Subtotal</span>
                <span className="text-base font-bold text-gray-900">₱{medicationSubtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="space-y-2">
                {addItemFeedback && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{addItemFeedback}</p>
                )}
                <button type="button" onClick={confirmAddMedication} disabled={!selectedMedication} className="h-10 w-full rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">Add Item</button>
                <button type="button" onClick={() => setModal(prevModal)} className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* ── Bill Success ── */}
          {modal === 'billSuccess' && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" strokeWidth={2} />
              <h3 className="mt-3 text-4xl font-bold text-gray-800">Added Successfully!</h3>
              <p className="mt-2 text-sm text-gray-600">Medical bill record has been successfully added.</p>
              <button type="button" onClick={() => setModal('none')} className="mt-6 h-9 w-32 rounded-lg bg-blue-600 text-sm font-semibold text-white">Done</button>
            </div>
          )}

          {modal === 'payBill' && selectedPayRow && (
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-gray-900">Record Payment</h3>
              <p className="mt-1 text-sm text-gray-500">Complete the payment details for {selectedPayRow.id}.</p>
              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Amount</label>
                  <input value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3" />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Payment Method</label>
                  <select value={selectedMethod} onChange={e => setSelectedMethod(e.target.value as PaymentMethod)} className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3">
                    <option value="Cash">Cash</option>
                    <option value="GCash">GCash</option>
                    <option value="Maya">Maya</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Reference Number</label>
                  <input value={paymentReferenceInput} onChange={e => setPaymentReferenceInput(e.target.value)} placeholder="Optional" className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3" />
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={closeAuxiliaryModals} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">Back</button>
                <button type="button" onClick={handleConfirmPayment} disabled={isSubmitting} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{isSubmitting ? 'Processing...' : 'Confirm Payment'}</button>
              </div>
            </div>
          )}

          {modal === 'cancelBill' && selectedBill && (
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-100 p-2 text-red-600"><AlertTriangle size={18} /></div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Cancel Bill</h3>
                  <p className="text-sm text-gray-500">Are you sure you want to cancel this bill?</p>
                </div>
              </div>
              <div className="mt-5">
                <label className="mb-1 block text-sm font-semibold text-gray-700">Reason</label>
                <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={4} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" placeholder="Enter cancellation reason" />
              </div>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={closeAuxiliaryModals} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">Back</button>
                <button type="button" onClick={handleCancelBill} className="h-10 flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700">Confirm Cancel</button>
              </div>
            </div>
          )}

          {modal === 'receipt' && selectedBill && selectedBillMeta && (
            <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-5">
                <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">CliniKaPlus</p>
                <h3 className="mt-1 text-3xl font-bold text-gray-900">OFFICIAL RECEIPT</h3>
              </div>
              <div className="space-y-5 p-6">
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                  <div><p className="text-xs text-gray-400">Receipt No.</p><p className="font-bold text-gray-800">{`RCT-${selectedBill.id}`}</p></div>
                  <div><p className="text-xs text-gray-400">Date &amp; Time</p><p className="font-bold text-gray-800">{toDateTimeDisplay(selectedBillMeta.paymentDateTime || selectedBill.date)}</p></div>
                  <div><p className="text-xs text-gray-400">Patient Info</p><p className="font-bold text-gray-800">{selectedBill.patient} ({selectedBillMeta.patientId})</p></div>
                  <div><p className="text-xs text-gray-400">Processed by</p><p className="font-bold text-gray-800">{selectedBillMeta.processedBy}</p></div>
                </div>

                <div className="rounded-2xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-xs text-gray-500">
                        <th className="px-4 py-3 text-left font-medium">Service</th>
                        <th className="px-4 py-3 text-center font-medium">Quantity</th>
                        <th className="px-4 py-3 text-right font-medium">Price</th>
                        <th className="px-4 py-3 text-right font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBillMeta.services.map((service, idx) => (
                        <tr key={`${service.name}-${idx}`} className="border-t border-gray-100 text-gray-800">
                          <td className="px-4 py-3">{service.name}</td>
                          <td className="px-4 py-3 text-center">{service.quantity}</td>
                          <td className="px-4 py-3 text-right">{toPeso(service.unitPrice)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{toPeso(service.quantity * service.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Footer</p>
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between"><span>Payment Method</span><span className="font-semibold">{selectedBillMeta.paymentMethod || 'N/A'}</span></div>
                      <div className="flex justify-between"><span>Reference Number</span><span className="font-semibold">{selectedBillMeta.paymentReference || 'N/A'}</span></div>
                      <div className="flex justify-between"><span>Processed by</span><span className="font-semibold">{selectedBillMeta.processedBy}</span></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Payment Summary</p>
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between"><span>Total</span><span className="font-semibold">{toPeso(total)}</span></div>
                      <div className="flex justify-between"><span>Amount Paid</span><span className="font-semibold">{toPeso(selectedBillMeta.amountPaid ?? total)}</span></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 px-6 py-4">
                <div className="flex gap-2">
                  <button type="button" onClick={() => printBillDocument('receipt')} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    <Printer size={16} />
                    Print Receipt
                  </button>
                  <button type="button" onClick={closeAuxiliaryModals} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">Done</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Pay: Select Method ── */}
          {modal === 'payMethod' && selectedPayRow && (
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-20 bg-white">
                <div className="border-b border-gray-200 px-6 py-5">
                  <h3 className="text-2xl font-bold text-gray-900">Collect Payment</h3>
                  <p className="mt-1 text-sm text-gray-600">Review bill information and select a payment channel.</p>
                </div>
                <PaymentProgressTracker currentStep={1} />
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-[1.15fr_1fr]">
                <div className="space-y-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700"><Info size={16} />Bill Snapshot</div>
                    {isPaymentDetailsLoading ? (
                      <p className="text-sm text-gray-500">Loading bill details...</p>
                    ) : (
                      <>
                        {paymentDetailsError && <p className="mb-3 text-sm text-amber-700">{paymentDetailsError}</p>}
                        <div className="grid grid-cols-1 gap-3 text-sm text-gray-800 md:grid-cols-2">
                          <div><p className="text-xs text-gray-500">Bill Code</p><p className="font-semibold">{paymentBillCode}</p></div>
                          <div><p className="text-xs text-gray-500">Status</p><p className="font-semibold">{paymentBillStatus}</p></div>
                          <div><p className="text-xs text-gray-500">Patient Name</p><p className="font-semibold">{paymentPatientName}</p></div>
                          <div><p className="text-xs text-gray-500">Patient ID</p><p className="font-semibold">{paymentPatientId ?? 'N/A'}</p></div>
                          <div><p className="text-xs text-gray-500">Net Amount</p><p className="font-semibold">{toPeso(Number(paymentBill?.net_amount ?? safePaymentAmountDue))}</p></div>
                          <div><p className="text-xs text-gray-500">Outstanding</p><p className="font-semibold text-blue-700">{toPeso(safePaymentAmountDue)}</p></div>
                          <div><p className="text-xs text-gray-500">Total Paid</p><p className="font-semibold">{toPeso(paymentTotalPaid)}</p></div>
                          <div><p className="text-xs text-gray-500">Created Date</p><p className="font-semibold">{formatDateMed(paymentBillCreatedAt)}</p></div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Amount To Collect</p>
                    <p className="mt-2 text-3xl font-bold text-blue-800">{toPeso(safePaymentAmountDue)}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-700"><Wallet size={16} />Payment Method</div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Cash Payment</p>
                    <button type="button" onClick={() => { setSelectedMethod('Cash'); setPaymentErrors((prev) => ({ ...prev, payment_method: undefined, reference_number: undefined })); }} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${selectedMethod === 'Cash' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <span className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><CircleDollarSign size={20} /></span>
                        <span><p className="text-sm font-semibold text-gray-900">Cash</p><p className="text-xs text-gray-500">Front desk cash payment</p></span>
                      </span>
                      <span className={`h-4 w-4 rounded-full border ${selectedMethod === 'Cash' ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`} />
                    </button>
                  </div>

                  <div className="my-2 border-t border-gray-200" />

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">E-Wallets</p>
                    <div className="space-y-3">
                      <button type="button" onClick={() => { setSelectedMethod('GCash'); setPaymentErrors((prev) => ({ ...prev, payment_method: undefined })); }} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${selectedMethod === 'GCash' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <span className="flex items-center gap-4">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 p-1"><img src={G_CASH_LOGO_URL} alt="GCash logo" className="h-8 w-8 object-contain" /></span>
                          <span><p className="text-sm font-semibold text-gray-900">GCash</p><p className="text-xs text-gray-500">Mobile wallet</p></span>
                        </span>
                        <span className={`h-4 w-4 rounded-full border ${selectedMethod === 'GCash' ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`} />
                      </button>
                      <button type="button" onClick={() => { setSelectedMethod('Maya'); setPaymentErrors((prev) => ({ ...prev, payment_method: undefined })); }} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${selectedMethod === 'Maya' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <span className="flex items-center gap-4">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 p-1"><img src={MAYA_LOGO_URL} alt="Maya logo" className="h-8 w-8 object-contain" /></span>
                          <span><p className="text-sm font-semibold text-gray-900">Maya</p><p className="text-xs text-gray-500">Mobile wallet</p></span>
                        </span>
                        <span className={`h-4 w-4 rounded-full border ${selectedMethod === 'Maya' ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`} />
                      </button>
                    </div>
                  </div>
                  {paymentErrors.payment_method && (
                    <p className="text-xs font-semibold text-red-600">{paymentErrors.payment_method}</p>
                  )}

                  <div className="flex gap-2 pt-3">
                    <button type="button" onClick={handleProceedFromMethod} className="h-10 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Continue</button>
                    <button type="button" onClick={closePayModals} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {false && modal === 'payMethod' && selectedPayRow && (
            <div className="w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3 border-r border-gray-300 pr-4">
                  <h3 className="flex items-center gap-2 text-2xl font-bold text-gray-800"><Info size={20} />Patient Information</h3>
                  <div className="space-y-4 text-sm text-gray-800">
                    <div><p className="font-bold">{selectedPayRow.patient}</p><p className="text-gray-600">Patient Name</p></div>
                    <div><p className="font-bold">{selectedPayRow.id}</p><p className="text-gray-600">Bill ID</p></div>
                    <div><p className="font-bold">{selectedPayRow.total.replace('P', '₱')}</p><p className="text-gray-600">Total Amount</p></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-2xl font-bold text-gray-800"><Wallet size={20} />Payment Method</h3>
                  <p className="text-sm font-semibold text-gray-500">Select Payment Method:</p>
                  <div className="space-y-2 text-sm font-semibold text-gray-800">
                    {(['Cash', 'GCash', 'Maya'] as PaymentMethod[]).map(method => (
                      <button key={method} type="button" className="flex items-center gap-2" onClick={() => setSelectedMethod(method)}>
                        <span className={`h-4 w-4 rounded-full ${selectedMethod === method ? 'bg-blue-600' : 'bg-gray-300'}`} />{method}
                      </button>
                    ))}
                  </div>
                  <div className="pt-4 flex gap-2">
                    <button type="button" onClick={handleProceedFromMethod} className="h-9 flex-1 rounded-lg bg-blue-600 text-sm font-semibold text-white">Proceed</button>
                    <button type="button" onClick={closePayModals} className="h-9 flex-1 rounded-lg bg-gray-300 text-sm font-semibold text-gray-600">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Pay: Cash ── */}
          {modal === 'payCash' && selectedPayRow && (
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-20 bg-white">
                <div className="border-b border-gray-200 px-6 py-5">
                  <h3 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><CircleDollarSign className="text-emerald-600" size={22} />Cash Payment</h3>
                  <p className="mt-1 text-sm text-gray-600">Collect and confirm the exact cash amount for this bill.</p>
                </div>
                <PaymentProgressTracker currentStep={2} />
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                  <div className="flex justify-between"><span>Bill Code</span><span className="font-semibold">{paymentBillCode}</span></div>
                  <div className="mt-2 flex justify-between"><span>Patient</span><span className="font-semibold">{paymentPatientName}</span></div>
                  <div className="mt-2 flex justify-between border-t border-gray-200 pt-2"><span>Amount Due</span><span className="font-semibold text-blue-700">{toPeso(safePaymentAmountDue)}</span></div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Amount Paid</label>
                  <div className="flex items-center rounded-xl border border-gray-300 bg-white px-3">
                    <span className="text-sm font-bold text-gray-700">₱</span>
                    <input type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder="Enter amount paid" className="h-11 w-full bg-transparent px-2 text-sm outline-none" />
                  </div>
                  {paymentErrors.amount_paid && (
                    <p className="mt-1 text-xs font-semibold text-red-600">{paymentErrors.amount_paid}</p>
                  )}
                  {overpaymentWarning && (
                    <p className="mt-1 text-xs font-semibold text-amber-700">{overpaymentWarning}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Change</label>
                  <div className="flex h-11 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-800">{toPeso(changeAmount)}</div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Notes</label>
                  <textarea
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    rows={3}
                    placeholder="Add optional notes for this payment"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-300"
                  />
                </div>
              </div>
              <div className="flex gap-2 border-t border-gray-200 px-6 py-4">
                <button type="button" onClick={() => setModal('payMethod')} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">Back</button>
                <button type="button" onClick={handleReviewPayment} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">Review Payment</button>
              </div>
            </div>
          )}

          {modal === 'viewBillServicesFull' && selectedBill && selectedBillMeta && (
            <div className="my-4 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900"><Stethoscope size={18} className="text-gray-500" />Services Table</h3>
                <button type="button" onClick={() => setModal('viewBill')} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={16} /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500">
                      <th className="pb-2 text-left font-medium">Service</th>
                      <th className="pb-2 text-center font-medium">Quantity</th>
                      <th className="pb-2 text-right font-medium">Price</th>
                      <th className="pb-2 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewServicesByType.length > 0 ? viewServicesByType.map((group) => (
                      <Fragment key={group.label}>
                        <tr className="border-b border-gray-100 bg-gray-50 text-gray-700">
                          <td colSpan={4} className="py-2 font-bold">{group.label}</td>
                        </tr>
                        {group.items.map((item, idx) => (
                          <tr key={`${group.label}-${item.bill_item_id ?? idx}`} className="border-b border-gray-100 text-gray-800">
                            <td className="py-2">{item.description || 'N/A'}</td>
                            <td className="py-2 text-center">{Number(item.quantity || 0)}</td>
                            <td className="py-2 text-right">{toPeso(Number(item.unit_price || 0))}</td>
                            <td className="py-2 text-right font-semibold">{toPeso(Number(item.subtotal || 0))}</td>
                          </tr>
                        ))}
                        <tr className="border-b border-gray-100 text-gray-800">
                          <td colSpan={3} className="py-2 text-right font-semibold">Group Total</td>
                          <td className="py-2 text-right font-bold">{toPeso(group.total)}</td>
                        </tr>
                      </Fragment>
                    )) : (
                      <tr>
                        <td colSpan={4} className="py-3 text-center text-gray-500">{isViewBillDetailsLoading ? 'Loading services...' : 'No billed services found.'}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {false && modal === 'payCash' && selectedPayRow && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="flex items-center gap-2 text-2xl font-bold text-gray-800"><CircleDollarSign className="text-green-500" size={22} />Cash Payment</h3>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-start gap-3"><Coins size={18} className="mt-0.5 text-gray-800" /><div><p className="font-bold text-gray-800">{selectedPayRow.total.replace('P', '₱')}</p><p className="text-gray-600">Total Amount</p></div></div>
                <div><p className="mb-1 font-bold text-gray-800">Amount Received</p><div className="flex items-center gap-2"><span className="font-bold">₱</span><input type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="h-8 flex-1 rounded-md border border-gray-400 bg-transparent px-2" /></div></div>
                <div><p className="mb-1 font-bold text-gray-800">Change</p><div className="flex items-center gap-2"><span className="font-bold">₱</span><input value={changeAmount} readOnly className="h-8 flex-1 rounded-md border border-gray-400 bg-transparent px-2" /></div></div>
              </div>
              <div className="mt-5 space-y-2">
                <button type="button" onClick={() => setModal('payConfirm')} className="h-9 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white">Confirm Payment</button>
                <button type="button" onClick={() => setModal('payCancelConfirm')} className="h-9 w-full rounded-lg bg-gray-300 text-sm font-semibold text-gray-600">Cancel</button>
              </div>
            </div>
          )}

          {/* ── Pay: Cancel Confirm ── */}
          {modal === 'payCancelConfirm' && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
              <MinusCircle className="mx-auto h-12 w-12 text-red-500" />
              <h3 className="mt-4 text-2xl font-bold text-gray-800">Cancel your payment?</h3>
              <p className="mt-2 text-sm text-gray-600">Once canceled, the payment will not be sent.</p>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => setModal('payCash')} className="h-9 flex-1 rounded-lg bg-gray-300 text-sm font-semibold text-gray-600">Not Now</button>
                <button type="button" onClick={() => setModal('payCancelled')} className="h-9 flex-1 rounded-lg bg-red-500 text-sm font-semibold text-white">Cancel Payment</button>
              </div>
            </div>
          )}

          {/* ── Pay: Cancelled ── */}
          {modal === 'payCancelled' && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
              <XCircle className="mx-auto h-14 w-14 text-red-500" strokeWidth={2} />
              <h3 className="mt-3 text-2xl font-bold text-gray-800">Payment Cancelled</h3>
              <p className="mt-2 text-sm text-gray-600">Your payment has been cancelled.</p>
              <button type="button" onClick={closePayModals} className="mt-6 h-9 w-32 rounded-lg bg-blue-600 text-sm font-semibold text-white">Done</button>
            </div>
          )}

          {/* ── Pay: GCash / Maya ── */}
          {modal === 'payGcash' && selectedPayRow && (
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-20 bg-white">
                <div className="border-b border-gray-200 px-6 py-5">
                  <h3 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><CreditCard size={22} className="text-blue-700" />{selectedMethod} Payment</h3>
                  <p className="mt-1 text-sm text-gray-600">Complete the e-wallet transfer and encode the reference number.</p>
                </div>
                <PaymentProgressTracker currentStep={2} />
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-[320px_1fr]">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-4 flex items-center gap-4">
                    {selectedMethod === 'GCash' ? (
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 p-1">
                        <img src={G_CASH_LOGO_URL} alt="GCash logo" className="h-8 w-8 object-contain" />
                      </span>
                    ) : (
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 p-1">
                        <img src={MAYA_LOGO_URL} alt="Maya logo" className="h-8 w-8 object-contain" />
                      </span>
                    )}
                    <p className="text-sm font-semibold text-gray-800">{selectedMethod}</p>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Scan To Pay</p>
                  <div className="mt-2 flex h-[250px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-center text-sm text-gray-400">QR placeholder</div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 text-sm text-gray-800 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><p className="text-xs text-gray-500">Bill Code</p><p className="font-semibold">{paymentBillCode}</p></div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><p className="text-xs text-gray-500">Amount Due</p><p className="font-semibold text-blue-700">{toPeso(safePaymentAmountDue)}</p></div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 md:col-span-2"><p className="text-xs text-gray-500">Patient</p><p className="font-semibold">{paymentPatientName}</p></div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">{selectedMethod} Reference Number</label>
                    <div className="flex items-center rounded-xl border border-gray-300 bg-white px-3"><Hash size={16} className="text-gray-500" /><input value={gcashReference} onChange={e => setGcashReference(e.target.value)} className="h-11 w-full bg-transparent px-2 text-sm outline-none" placeholder="Enter transaction reference" /></div>
                    {paymentErrors.reference_number && (
                      <p className="mt-1 text-xs font-semibold text-red-600">{paymentErrors.reference_number}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Amount Paid</label>
                    <div className="flex items-center rounded-xl border border-gray-300 bg-white px-3">
                      <span className="text-sm font-bold text-gray-700">₱</span>
                      <input type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder="Enter amount paid" className="h-11 w-full bg-transparent px-2 text-sm outline-none" />
                    </div>
                    {paymentErrors.amount_paid && (
                      <p className="mt-1 text-xs font-semibold text-red-600">{paymentErrors.amount_paid}</p>
                    )}
                    {overpaymentWarning && (
                      <p className="mt-1 text-xs font-semibold text-amber-700">{overpaymentWarning}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Change</label>
                    <div className="flex h-11 items-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-800">{toPeso(changeAmount)}</div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Notes</label>
                    <textarea
                      value={paymentNotes}
                      onChange={e => setPaymentNotes(e.target.value)}
                      rows={3}
                      placeholder="Add optional notes for this payment"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-300"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 border-t border-gray-200 px-6 py-4">
                <button type="button" onClick={() => setModal('payMethod')} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">Back</button>
                <button type="button" onClick={handleReviewPayment} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">Review Payment</button>
              </div>
            </div>
          )}

          {false && modal === 'payGcash' && selectedPayRow && (
            <div className="w-full max-w-4xl rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-xl md:p-6" onClick={e => e.stopPropagation()}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[330px_1fr]">
                <div>
                  <h3 className="mb-1 text-sm font-bold text-blue-700">{selectedMethod}</h3>
                  <p className="text-sm text-gray-600">Kindly scan this QR using your {selectedMethod} app:</p>
                  <div className="mt-4 rounded-xl bg-blue-600 p-4">
                    <div className="h-[270px] rounded-lg bg-white flex items-center justify-center text-center text-gray-400 text-sm">QR Code</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 text-2xl font-bold text-gray-800"><CreditCard size={20} />Payment Details</h3>
                  <div className="grid grid-cols-2 gap-6 text-sm text-gray-800">
                    <div className="flex items-start gap-2"><Coins size={18} /><div><p className="font-bold">{selectedPayRow.total.replace('P', '₱')}</p><p className="text-gray-600">Amount Due</p></div></div>
                    <div className="flex items-start gap-2"><ReceiptText size={18} /><div><p className="font-bold">{selectedPayRow.id}</p><p className="text-gray-600">Reference Code</p></div></div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">After payment, enter:</p>
                    <div className="mt-1 flex items-center gap-2"><Hash size={18} className="text-gray-700" /><p className="font-medium text-gray-700">{selectedMethod} Reference Number</p></div>
                    <input value={gcashReference} onChange={e => setGcashReference(e.target.value)} className="mt-2 h-8 w-full max-w-sm rounded-md border border-gray-400 bg-transparent px-2" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setModal('payConfirm')} className="h-9 w-44 rounded-lg bg-blue-600 text-sm font-semibold text-white">Confirm Payment</button>
                    <button type="button" onClick={() => setModal('payMethod')} className="h-9 w-40 rounded-lg bg-gray-300 text-sm font-semibold text-gray-600">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Pay: Confirm ── */}
          {modal === 'payConfirm' && selectedPayRow && (
            <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-20 bg-white">
                <div className="border-b border-gray-200 px-6 py-5">
                  <h3 className="text-2xl font-bold text-gray-900">Confirm Payment</h3>
                  <p className="mt-1 text-sm text-gray-600">Please verify details before posting this payment.</p>
                </div>
                <PaymentProgressTracker currentStep={3} />
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5 text-sm text-gray-800">
                <div className="flex justify-between"><span>Bill Code</span><span className="font-semibold">{paymentBillCode}</span></div>
                <div className="flex justify-between"><span>Patient Name</span><span className="font-semibold">{paymentPatientName}</span></div>
                <div className="flex justify-between"><span>Patient ID</span><span className="font-semibold">{paymentPatientId ?? 'N/A'}</span></div>
                <div className="flex justify-between"><span>Payment Method</span><span className="font-semibold">{paymentMethodLabel}</span></div>
                {selectedMethod !== 'Cash' && (
                  <div className="flex justify-between"><span>Reference Number</span><span className="font-semibold">{paymentReference}</span></div>
                )}
                <div className="flex justify-between"><span>Notes</span><span className="max-w-[65%] text-right font-semibold">{paymentNotes.trim() || 'N/A'}</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold"><span>Amount Paid</span><span className="text-blue-700">{toPeso(Number(paymentAmount || safePaymentAmountDue || 0))}</span></div>
              </div>
              <div className="flex gap-2 border-t border-gray-200 px-6 py-4">
                <button type="button" onClick={closePayModals} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="button" onClick={handleConfirmPayment} disabled={isSubmitting} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{isSubmitting ? 'Processing...' : 'Confirm Payment'}</button>
              </div>
            </div>
          )}

          {false && modal === 'payConfirm' && selectedPayRow && (
            <div className="w-full max-w-md rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-2xl font-bold text-gray-800">Confirm your payment</h3>
              <p className="mt-1 text-sm text-gray-600">Please confirm to securely process your payment.</p>
              <div className="mt-4 rounded-xl bg-gray-300 p-4 text-sm">
                <div className="space-y-2 text-gray-800">
                  <div className="flex justify-between"><span>Date</span><span>{selectedPayRow.date}</span></div>
                  <div className="flex justify-between"><span>Patient Name</span><span>{selectedPayRow.patient}</span></div>
                  <div className="flex justify-between"><span>Payment Method</span><span>{paymentMethodLabel}</span></div>
                  <div className="flex justify-between"><span>Reference Number</span><span>{paymentReference}</span></div>
                  <div className="mt-3 flex justify-between border-t border-gray-400 pt-3 font-bold"><span>Total Amount</span><span>{selectedPayRow.total.replace('P', '₱')}</span></div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={closePayModals} className="h-9 flex-1 rounded-lg bg-gray-300 text-sm font-semibold text-gray-600">Cancel</button>
                <button type="button" onClick={handleConfirmPayment} disabled={isSubmitting} className="h-9 flex-1 rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? 'Processing...' : 'Confirm Payment'}</button>
              </div>
            </div>
          )}

          {/* ── Pay: Success ── */}
          {modal === 'paySuccess' && selectedPayRow && (
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-6 pb-5 pt-6 text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" strokeWidth={2} />
                <h3 className="mt-3 text-2xl font-bold text-gray-900">Payment Successful</h3>
                <p className="mt-1 text-sm text-gray-600">The payment has been recorded successfully.</p>
              </div>
              <div className="mx-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                <div className="flex justify-between"><span>Bill Code</span><span className="font-semibold">{paymentBillCode}</span></div>
                <div className="mt-2 flex justify-between"><span>Amount Paid</span><span className="font-semibold">{toPeso(Number(paymentAmount || safePaymentAmountDue || 0))}</span></div>
                <div className="mt-2 flex justify-between"><span>Payment Method</span><span className="font-semibold">{paymentMethodLabel}</span></div>
                <div className="mt-2 flex justify-between"><span>Date</span><span className="font-semibold">{formatDateMed(new Date().toISOString())}</span></div>
              </div>
              <div className="px-6 py-4">
                <button type="button" onClick={closePayModals} className="h-10 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">Done</button>
              </div>
            </div>
          )}

          {false && modal === 'paySuccess' && selectedPayRow && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" strokeWidth={2} />
              <h3 className="mt-3 text-2xl font-bold text-gray-800">Payment Successful!</h3>
              <p className="mt-2 text-sm text-gray-600">Your payment has been completed successfully.</p>
              <div className="mt-4 border-t border-gray-300 pt-3 text-sm text-gray-700 space-y-1">
                <div className="flex justify-between"><span>Amount Paid</span><span className="font-semibold">{selectedPayRow.total.replace('P', '₱')}</span></div>
                <div className="flex justify-between"><span>Payment Method</span><span className="font-semibold">{paymentMethodLabel}</span></div>
                <div className="flex justify-between"><span>Date</span><span className="font-semibold">{selectedPayRow.date}</span></div>
              </div>
              <button type="button" onClick={closePayModals} className="mt-6 h-9 w-32 rounded-lg bg-blue-600 text-sm font-semibold text-white">Done</button>
            </div>
          )}

          {/* ── Receipt ── */}
          {false && modal === 'receipt' && selectedPayRow && (
            <div className="w-full max-w-md rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 text-2xl font-bold text-gray-800"><ReceiptText size={20} />Payment Receipt</div>
              <p className="mt-1 text-sm text-gray-600">Official payment summary for this transaction.</p>
              <div className="mt-4 rounded-xl bg-gray-300 p-4 text-sm text-gray-800">
                <div className="space-y-2">
                  <div className="flex justify-between"><span>Receipt No.</span><span className="font-semibold">{`RCT-${selectedPayRow.id}`}</span></div>
                  <div className="flex justify-between"><span>Bill ID</span><span className="font-semibold">{selectedPayRow.id}</span></div>
                  <div className="flex justify-between"><span>Patient</span><span className="font-semibold">{selectedPayRow.patient}</span></div>
                  <div className="flex justify-between"><span>Date</span><span className="font-semibold">{formatDateForTable(selectedPayRow.date)}</span></div>
                  <div className="mt-3 flex justify-between border-t border-gray-400 pt-3 font-bold"><span>Total Paid</span><span>{selectedPayRow.total.replace('P', '₱')}</span></div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={printBillReceipt} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  <Printer size={16} />
                  Print Receipt
                </button>
                <button type="button" onClick={closePayModals} className="h-9 flex-1 rounded-lg bg-blue-600 text-sm font-semibold text-white">Done</button>
              </div>
            </div>
          )}

        </div>,
        document.body,
      )}
    </div>
  );
}


