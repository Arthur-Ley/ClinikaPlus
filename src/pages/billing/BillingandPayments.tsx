import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, ChevronDown, PlusCircle,
  CheckCircle2, X, ReceiptText, Stethoscope, CircleGauge,
  CalendarDays, Info, CircleDollarSign, Coins, XCircle,
  CreditCard, Hash, MinusCircle, User, Plus, Minus, Wallet, Printer, AlertTriangle, Check,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Pagination from '../../components/ui/Pagination';
import SectionToolbar from '../../components/ui/SectionToolbar';
import {
  BillingPaginationSkeleton,
  BillingTableSkeleton,
  BillingToolbarSkeleton,
  SkeletonBlock,
} from './BillingSkeletonParts';
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
type ServiceItem = { type: 'service' | 'medication'; name: string; quantity: number; unitPrice: number; serviceId?: number | null; logId?: number | null; };
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
type PaymentMethod = 'Cash' | 'GCash' | 'Maya';
type BillingFilter = 'all' | 'pending' | 'paid' | 'cancelled';
type BillingSort = 'date' | 'status' | 'amount';
type ActiveModal =
  | 'none' | 'createBill' | 'viewBill' | 'billSuccess'
  | 'payBill' | 'cancelBill' | 'receipt'
  | 'payMethod' | 'payCash' | 'payGcash' | 'payConfirm' | 'paySuccess' | 'payCancelConfirm' | 'payCancelled'
  | 'addService' | 'addMedication';
type ToastState = { type: 'success' | 'error'; message: string } | null;
type BillUiMeta = {
  createdAt: string;
  patientId: string;
  age: string;
  gender: string;
  doctor: string;
  diagnosis: string;
  dueDate: string;
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

const serviceTypeOptions = [
  { id: 1, name: 'Consultation', services: [{ id: 1, name: 'Consultation Fee', unitPrice: 500 }, { id: 2, name: 'Follow-up Consultation', unitPrice: 300 }, { id: 3, name: 'Emergency Consultation', unitPrice: 800 }] },
  { id: 2, name: 'Laboratory / X-Ray', services: [{ id: 4, name: 'X-Ray', unitPrice: 1200 }, { id: 5, name: 'Blood Tests', unitPrice: 350 }, { id: 6, name: 'Laboratory', unitPrice: 450 }] },
  { id: 3, name: 'Urinalysis', services: [{ id: 7, name: 'Urinalysis', unitPrice: 200 }, { id: 8, name: 'Complete Urinalysis', unitPrice: 300 }] },
  { id: 4, name: 'Therapy', services: [{ id: 9, name: 'Physical Therapy', unitPrice: 850 }, { id: 10, name: 'Oral Examination', unitPrice: 300 }, { id: 11, name: 'Dentistry', unitPrice: 700 }] },
];

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
  { type: 'service', name: 'Consultation', quantity: 1, unitPrice: 500, serviceId: null, logId: null },
  { type: 'medication', name: 'Amoxicillin 250mg', quantity: 10, unitPrice: 20, serviceId: null, logId: 1 },
  { type: 'service', name: 'X-Ray', quantity: 1, unitPrice: 1200, serviceId: null, logId: null },
];

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const G_CASH_LOGO_URL = '/payment-logos/gcash.svg';
const MAYA_LOGO_URL = '/payment-logos/maya.svg';
const VAT_RATE = 0.12;
const SENIOR_DISCOUNT_RATE = 0.2;
const MIN_TABLE_ROWS = 1;
const MAX_TABLE_ROWS = 100;

function toAmount(total: string) { const p = Number(total.replace(/[^\d.-]/g, '')); return Number.isFinite(p) ? p : 0; }
function formatPhp(value: number) { return `PHP ${Math.round(value).toLocaleString()}`; }
function formatDateForTable(value: string) { const p = new Date(value); if (Number.isNaN(p.getTime())) return value; return p.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }); }
function formatDateLong(value: string) { const p = new Date(value); if (Number.isNaN(p.getTime())) return value; return p.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
function formatDateMed(value: string) { const p = new Date(value); if (Number.isNaN(p.getTime())) return value; return p.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }); }
function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function parsePositiveInt(value: string) { const n = value.trim(); if (!/^\d+$/.test(n)) return null; const p = Number(n); if (!Number.isInteger(p) || p <= 0) return null; return p; }
function resolveMedicationUnitPrice(name: string) { return medicationPriceByName[name] ?? 20; }
function toSafeQuantity(value: string) { const p = Number(value); if (!Number.isInteger(p) || p <= 0) return 1; return p; }
function normalizeBillStatus(value: string): BillStatus { const n = value.trim().toLowerCase(); if (n === 'paid') return 'Paid'; if (n === 'cancelled' || n === 'canceled') return 'Cancelled'; return 'Pending'; }
function statusCode(status: BillStatus) { if (status === 'Paid') return 'PD'; if (status === 'Cancelled') return 'CN'; return 'PN'; }
function toAutoIds(status: BillStatus, records: BillRow[]) { const code = statusCode(status); const next = records.filter(r => r.status === status).length + 1; return { billId: `B-${code}-${String(next).padStart(4, '0')}` }; }
function toPeso(value: number) { return `\u20b1${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function toDateTimeDisplay(value: string) { const p = new Date(value); if (Number.isNaN(p.getTime())) return value; return p.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function toSortRank(status: BillStatus) { if (status === 'Pending') return 0; if (status === 'Paid') return 1; return 2; }
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
    dueDate: new Date(new Date(bill.date).getTime() + 7 * 86400000).toISOString().slice(0, 10),
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
  const [patientAgeInput, setPatientAgeInput] = useState('');
  const [patientGenderInput, setPatientGenderInput] = useState('');
  const [doctorInput, setDoctorInput] = useState('');
  const [diagnosisInput, setDiagnosisInput] = useState('');
  const [visitDateInput, setVisitDateInput] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [admissionDateInput, setAdmissionDateInput] = useState('');
  const [dischargeDateInput, setDischargeDateInput] = useState('');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [medicationCatalog, setMedicationCatalog] = useState<MedicationCatalogItem[]>(fallbackMedicationCatalog);
  const [isSeniorCitizen, setIsSeniorCitizen] = useState(false);
  const visitDateInputRef = useRef<HTMLInputElement | null>(null);

  const [serviceTypeSearch, setServiceTypeSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState<typeof serviceTypeOptions[0] | null>(null);
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

  const [selectedPayRow, setSelectedPayRow] = useState<BillRow>(EMPTY_BILL_ROW);
  const [paymentBillDetails, setPaymentBillDetails] = useState<PaymentBillDetailsResponse | null>(null);
  const [isPaymentDetailsLoading, setIsPaymentDetailsLoading] = useState(false);
  const [paymentDetailsError, setPaymentDetailsError] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReferenceInput, setPaymentReferenceInput] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusHandledKey, setFocusHandledKey] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(8);
  const tableCardRef = useRef<HTMLDivElement | null>(null);
  const tableToolbarRef = useRef<HTMLDivElement | null>(null);
  const tableFooterRef = useRef<HTMLDivElement | null>(null);
  const tableHeadRef = useRef<HTMLTableSectionElement | null>(null);

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
    return [...visible].sort((a, b) => {
      if (sortBy === 'amount') return toAmount(b.total) - toAmount(a.total);
      if (sortBy === 'status') return toSortRank(a.status) - toSortRank(b.status) || new Date(b.date).getTime() - new Date(a.date).getTime();
      return new Date(b.date).getTime() - new Date(a.date).getTime();
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

  const effectivePageSize = Math.max(MIN_TABLE_ROWS, tablePageSize);
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

  const subtotal = useMemo(() => services.reduce((acc, s) => acc + s.quantity * s.unitPrice, 0), [services]);
  const discount = isSeniorCitizen ? subtotal * SENIOR_DISCOUNT_RATE : 0;
  const tax = isSeniorCitizen ? 0 : subtotal * VAT_RATE;
  const total = subtotal - discount + tax;

  const billSummaryLines = useMemo(() => {
    const medicationTotal = services.filter(s => s.type === 'medication').reduce((acc, s) => acc + s.quantity * s.unitPrice, 0);
    const labXray = services.filter(s => ['Laboratory', 'X-Ray', 'Blood Tests', 'Laboratory / X-Ray'].includes(s.name)).reduce((acc, s) => acc + s.quantity * s.unitPrice, 0);
    const urinalysis = services.filter(s => s.name.toLowerCase().includes('urinalysis')).reduce((acc, s) => acc + s.quantity * s.unitPrice, 0);
    const misc = services.filter(s => ['Physical Therapy', 'Dentistry', 'Oral Examination'].includes(s.name)).reduce((acc, s) => acc + s.quantity * s.unitPrice, 0);
    const consultation = services.filter(s => s.name.toLowerCase().includes('consultation')).reduce((acc, s) => acc + s.quantity * s.unitPrice, 0);
    const lines = [];
    if (medicationTotal > 0) lines.push({ label: 'Medications', value: medicationTotal });
    if (labXray > 0) lines.push({ label: 'Laboratory / X-Ray', value: labXray });
    if (urinalysis > 0) lines.push({ label: 'Urinalysis', value: urinalysis });
    if (misc > 0) lines.push({ label: 'Miscellaneous', value: misc });
    if (consultation > 0) lines.push({ label: 'Professional Fee', value: consultation });
    return lines;
  }, [services]);

  const filteredServiceTypes = useMemo(() => {
    const q = serviceTypeSearch.trim().toLowerCase();
    return q ? serviceTypeOptions.filter(t => t.name.toLowerCase().includes(q)) : serviceTypeOptions;
  }, [serviceTypeSearch]);

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
    setShowServiceTypeDropdown(false); setShowServiceDropdown(false);
    setPrevModal(modal);
    setModal('addService');
  }

  function openAddMedicationModal() {
    setSelectedMedication(null); setMedicationSearch('');
    setMedicationQty(1); setMedicationUnitPrice(0);
    setShowMedicationDropdown(false);
    setPrevModal(modal);
    setModal('addMedication');
  }

  function confirmAddService() {
    if (!selectedService) return;
    setServices(prev => [...prev, { type: 'service', name: selectedService.name, quantity: serviceQty, unitPrice: serviceUnitPrice || selectedService.unitPrice, serviceId: selectedService.id, logId: null }]);
    setModal(prevModal);
  }

  function confirmAddMedication() {
    if (!selectedMedication) return;
    if (selectedMedication.total_stock < medicationQty) { window.alert(`Insufficient stock. Available: ${selectedMedication.total_stock}`); return; }
    setServices(prev => [...prev, { type: 'medication', name: selectedMedication.medication_name, quantity: medicationQty, unitPrice: medicationUnitPrice || resolveMedicationUnitPrice(selectedMedication.medication_name), serviceId: null, logId: selectedMedication.medication_id }]);
    setModal(prevModal);
  }

  function resetCreateForm() {
    const defaultStatus: BillStatus = 'Pending';
    const ids = toAutoIds(defaultStatus, billingRecords);
    setBillIdInput(ids.billId); setBillStatusInput(defaultStatus);
    setPatientIdInput(''); setPatientNameInput(''); setPatientAgeInput('');
    setPatientGenderInput(''); setDoctorInput(''); setDiagnosisInput('');
    setVisitDateInput(''); setDueDateInput(''); setAdmissionDateInput(''); setDischargeDateInput('');
    setServices([]); setIsSeniorCitizen(false);
  }

  function openCreateModal() { resetCreateForm(); setSelectedBill(null); setModal('createBill'); }

  function loadBillDetails(bill: BillRow) {
    const meta = billMetaById[bill.id] ?? buildDefaultBillMeta(bill);
    setSelectedBill(bill);
    setBillIdInput(bill.id);
    setBillStatusInput(bill.status);
    setPatientIdInput(meta.patientId);
    setPatientNameInput(bill.patient);
    setPatientAgeInput(meta.age);
    setPatientGenderInput(meta.gender);
    setDoctorInput(meta.doctor);
    setDiagnosisInput(meta.diagnosis);
    setVisitDateInput(bill.date);
    setDueDateInput(meta.dueDate);
    setAdmissionDateInput(meta.admissionDate);
    setDischargeDateInput(meta.dischargeDate);
    setServices(meta.services);
    setIsSeniorCitizen(meta.isSeniorCitizen);
  }

  function openViewModal(bill: BillRow) {
    loadBillDetails(bill);
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
    loadBillDetails(bill);
    setSelectedPayRow(bill);
    setSelectedMethod('Cash');
    setPaymentAmount(String(toAmount(bill.total)));
    setPaymentReferenceInput('');
    setPaymentNotes('');
    setPaymentDetailsError('');
    setPaymentBillDetails(null);
    setModal('payMethod');
    void fetchPaymentBillDetails(bill);
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
    try {
      const isEditingExisting = modal === 'viewBill';
      if (!isEditingExisting) {
        const patientId = parsePositiveInt(patientIdInput) ?? undefined;
        if (!patientId) throw new Error('Valid numeric Patient ID is required.');
        if (!services.length) throw new Error('Add at least one service or medication before creating a bill.');
        const status = normalizeBillStatus(billStatusInput);
        const id = billIdInput.trim() || toAutoIds(status, billingRecords).billId;
        await addBill({
          id, patient: patientNameInput.trim() || 'Unknown Patient',
          date: visitDateInput.trim() || new Date().toISOString().slice(0, 10),
          total: `P${Math.round(total).toLocaleString()}`, status, patientId,
          discountAmount: Number(discount.toFixed(2)), taxAmount: Number(tax.toFixed(2)),
          items: services.map(s => ({ name: s.name, quantity: s.quantity, unitPrice: s.unitPrice, serviceId: s.serviceId ?? null, logId: s.logId ?? null })),
        });
      }
      setModal('billSuccess');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to create bill.');
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

  async function handleConfirmPayment() {
    if (!selectedPayRow.id || isSubmitting) return;
    const amountPaid = Number(paymentAmount || 0);
    if (Number.isNaN(amountPaid) || amountPaid <= 0) { window.alert('Enter a valid payment amount.'); return; }
    try {
      setIsSubmitting(true);
      const paidDate = new Date().toISOString();
      await markPaymentPaid({ id: selectedPayRow.id, method: selectedMethod, reference: paymentReferenceInput.trim() || undefined, paidDate });
      const updatedBill: BillRow = { ...selectedPayRow, status: 'Paid', date: paidDate };
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
      setToast({ type: 'success', message: 'Payment successful.' });
      setModal('paySuccess');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to record payment.');
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
  const setAmountReceived = setPaymentAmount;
  const gcashReference = paymentReferenceInput;
  const setGcashReference = setPaymentReferenceInput;
  const changeAmount = useMemo(() => {
    if (!selectedPayRow.id) return 0;
    const received = Number(paymentAmount || 0);
    if (Number.isNaN(received)) return 0;
    return Math.max(0, received - safePaymentAmountDue);
  }, [paymentAmount, selectedPayRow.id, safePaymentAmountDue]);
  const paymentReference = paymentReferenceInput || 'N/A';
  function handleProceedFromMethod() { setModal(selectedMethod === 'Cash' ? 'payCash' : 'payGcash'); }
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
                      {bill.status === 'Paid' && <button type="button" onClick={() => openReceiptModal(bill)} className="font-semibold text-gray-600 hover:text-gray-700">Receipt</button>}
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
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md"
          onClick={() => {
            if (['payBill', 'payMethod', 'payCash', 'payGcash', 'payConfirm', 'paySuccess', 'payCancelConfirm', 'payCancelled', 'cancelBill', 'receipt'].includes(modal)) closeAuxiliaryModals();
            else if (modal === 'addService' || modal === 'addMedication') setModal(prevModal);
            else setModal('none');
          }}
        >
          {/* ── Create / View Bill Modal ── */}
          {modal === 'createBill' && (
            <div className="w-full max-w-[960px] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800"><ReceiptText size={18} className="text-gray-500" />Create Bill</h3>
                <button type="button" onClick={() => setModal('none')} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={15} /></button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">
                {/* LEFT PANEL */}
                <div className="border-r border-gray-200 p-5 space-y-5 bg-gray-50">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><ReceiptText size={15} className="text-gray-400" />Bill Information</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Bill ID</p>
                        {isEditingExisting ? <p className="font-bold text-gray-800">{billIdInput}</p> : <input value={billIdInput} readOnly className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700" />}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Bill Date</p>
                        {isEditingExisting ? <p className="font-bold text-gray-800">{formatDateLong(visitDateInput)}</p> : (
                          <div className="flex items-center gap-1">
                            <input ref={visitDateInputRef} type="date" value={visitDateInput} onChange={e => setVisitDateInput(e.target.value)} className="h-8 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-sm" />
                            <button type="button" onClick={() => { const p = visitDateInputRef.current as HTMLInputElement & { showPicker?: () => void }; p.showPicker?.(); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"><CalendarDays size={13} /></button>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Bill Status</p>
                        {isEditingExisting ? <StatusPill status={billStatusInput || 'Pending'} /> : (
                          <select value={normalizeBillStatus(billStatusInput)} onChange={e => handleCreateStatusChange(e.target.value as BillStatus)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm">
                            <option value="Pending">Pending</option>
                            <option value="Paid">Paid</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Due Date</p>
                        {isEditingExisting ? <p className="font-bold text-gray-800">{formatDateLong(dueDateInput)}</p> : <input type="date" value={dueDateInput} onChange={e => setDueDateInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-gray-200" />
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><User size={15} className="text-gray-400" />Patient Information</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                      <div><p className="text-xs text-gray-400 mb-0.5">Patient ID</p>{isEditingExisting ? <p className="font-bold text-gray-800">{patientIdInput}</p> : <input value={patientIdInput} onChange={e => setPatientIdInput(e.target.value)} placeholder="e.g. 1021" className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}</div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Patient Name</p>{isEditingExisting ? <p className="font-bold text-gray-800">{patientNameInput}</p> : <input value={patientNameInput} onChange={e => setPatientNameInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}</div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Age</p>{isEditingExisting ? <p className="font-bold text-gray-800">{patientAgeInput} yrs old</p> : <input value={patientAgeInput} onChange={e => setPatientAgeInput(e.target.value)} placeholder="e.g. 45" className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}</div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Gender</p>{isEditingExisting ? <p className="font-bold text-gray-800">{patientGenderInput}</p> : (<select value={patientGenderInput} onChange={e => setPatientGenderInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select>)}</div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Doctor in Charge</p>{isEditingExisting ? <p className="font-bold text-gray-800">{doctorInput}</p> : <input value={doctorInput} onChange={e => setDoctorInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}</div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Final Diagnosis</p>{isEditingExisting ? <p className="font-bold text-gray-800">{diagnosisInput}</p> : <input value={diagnosisInput} onChange={e => setDiagnosisInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}</div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Admission Date</p>{isEditingExisting ? <p className="font-bold text-gray-800">{formatDateLong(admissionDateInput)}</p> : <input type="date" value={admissionDateInput} onChange={e => setAdmissionDateInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}</div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Discharge Date</p>{isEditingExisting ? <p className="font-bold text-gray-800">{formatDateLong(dischargeDateInput)}</p> : <input type="date" value={dischargeDateInput} onChange={e => setDischargeDateInput(e.target.value)} className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm" />}</div>
                    </div>
                  </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="p-5 space-y-5">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Stethoscope size={15} className="text-gray-400" />Services and Treatment</h4>
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

                  {/* Bill Summary */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><ReceiptText size={15} className="text-gray-400" />Bill Summary</h4>
                    <div className="space-y-1.5 text-sm">
                      {billSummaryLines.map(line => (
                        <div key={line.label} className="flex justify-between text-gray-700">
                          <span className="font-medium">{line.label}</span>
                          <span className="font-semibold">₱{line.value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-200 my-2" />
                      <div className="flex justify-between text-gray-700"><span className="font-medium">Subtotal</span><span className="font-semibold">₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                      {!isEditingExisting && (
                        <label className="flex items-center gap-2 text-xs text-gray-600 pt-1">
                          <input type="checkbox" checked={isSeniorCitizen} onChange={e => setIsSeniorCitizen(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-400" />
                          Senior Citizen (20% discount, VAT exempt)
                        </label>
                      )}
                      <div className="flex justify-between text-gray-700"><span className="font-medium">Discount</span><span className="font-semibold">₱{discount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between text-gray-700"><span className="font-medium">Tax</span><span className="font-semibold">₱{tax.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                      <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-gray-900 text-base">
                        <span>Total Amount</span>
                        <span>₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={handleSubmitBill} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 transition-colors">
                      Create New Bill
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Add Service Modal ── */}
          {modal === 'viewBill' && selectedBill && selectedBillMeta && (
            <div className="w-full max-w-[1080px] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="border-b border-gray-200 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Bill Control Panel</p>
                    <h3 className="mt-1 text-2xl font-bold text-gray-900">{selectedBill.id}</h3>
                    <p className="mt-1 text-sm text-gray-500">Date created: {toDateTimeDisplay(selectedBillMeta.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={selectedBill.status} />
                    <button type="button" onClick={() => setModal('none')} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={16} /></button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-[1.25fr_0.95fr]">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700"><User size={15} className="text-gray-400" />Patient Info</h4>
                    <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <div><p className="text-xs text-gray-400">Name</p><p className="font-bold text-gray-800">{selectedBill.patient}</p></div>
                      <div><p className="text-xs text-gray-400">Patient ID</p><p className="font-bold text-gray-800">{selectedBillMeta.patientId}</p></div>
                      <div><p className="text-xs text-gray-400">Doctor</p><p className="font-bold text-gray-800">{selectedBillMeta.doctor}</p></div>
                      <div><p className="text-xs text-gray-400">Diagnosis</p><p className="font-bold text-gray-800">{selectedBillMeta.diagnosis}</p></div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Stethoscope size={15} className="text-gray-400" />Services Table</h4>
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
                        {selectedBillMeta.services.map((service, idx) => (
                          <tr key={`${service.name}-${idx}`} className="border-b border-gray-100 text-gray-800 last:border-b-0">
                            <td className="py-2">{service.name}</td>
                            <td className="py-2 text-center">{service.quantity}</td>
                            <td className="py-2 text-right">{toPeso(service.unitPrice)}</td>
                            <td className="py-2 text-right font-semibold">{toPeso(service.quantity * service.unitPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><ReceiptText size={15} className="text-gray-400" />Bill Summary</h4>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{toPeso(subtotal)}</span></div>
                      <div className="flex justify-between"><span>Discount</span><span className="font-semibold">{toPeso(discount)}</span></div>
                      <div className="flex justify-between"><span>Tax</span><span className="font-semibold">{toPeso(tax)}</span></div>
                      <div className="border-t border-gray-300 pt-2 flex justify-between text-base font-bold text-gray-900">
                        <span>Total Amount</span>
                        <span>{toPeso(total)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Wallet size={15} className="text-gray-400" />Payment Section</h4>
                    {selectedBill.status === 'Paid' ? (
                      <div className="space-y-2 text-sm text-gray-700">
                        <div className="flex justify-between"><span>Payment Method</span><span className="font-semibold">{selectedBillMeta.paymentMethod || selectedPaymentRecord?.method || 'N/A'}</span></div>
                        <div className="flex justify-between"><span>Payment Date &amp; Time</span><span className="font-semibold">{toDateTimeDisplay(selectedBillMeta.paymentDateTime || selectedBill.date)}</span></div>
                        <div className="flex justify-between"><span>Reference Number</span><span className="font-semibold">{selectedBillMeta.paymentReference || 'N/A'}</span></div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No payment recorded yet.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3"><Info size={15} className="text-gray-400" />Activity / Verification</h4>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex justify-between"><span>Processed by</span><span className="font-semibold">{selectedBillMeta.processedBy}</span></div>
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
                        <button type="button" onClick={() => printBillDocument('bill')} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50">Print Bill</button>
                      </>
                    )}
                    {selectedBill.status === 'Paid' && (
                      <>
                        <button type="button" onClick={() => openReceiptModal(selectedBill)} className="h-10 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">View Receipt</button>
                        <button type="button" onClick={() => printBillDocument('bill')} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50">Print Bill</button>
                      </>
                    )}
                    {selectedBill.status === 'Cancelled' && (
                      <button type="button" onClick={() => printBillDocument('bill')} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50">Print Bill</button>
                    )}
                  </div>
                </div>
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
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="border-b border-gray-200 px-6 py-5">
                <h3 className="text-2xl font-bold text-gray-900">Collect Payment</h3>
                <p className="mt-1 text-sm text-gray-600">Review bill information and select a payment channel.</p>
              </div>
              <PaymentProgressTracker currentStep={1} />
              <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[1.15fr_1fr]">
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
                    <button type="button" onClick={() => setSelectedMethod('Cash')} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${selectedMethod === 'Cash' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
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
                      <button type="button" onClick={() => setSelectedMethod('GCash')} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${selectedMethod === 'GCash' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <span className="flex items-center gap-4">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 p-1"><img src={G_CASH_LOGO_URL} alt="GCash logo" className="h-8 w-8 object-contain" /></span>
                          <span><p className="text-sm font-semibold text-gray-900">GCash</p><p className="text-xs text-gray-500">Mobile wallet</p></span>
                        </span>
                        <span className={`h-4 w-4 rounded-full border ${selectedMethod === 'GCash' ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`} />
                      </button>
                      <button type="button" onClick={() => setSelectedMethod('Maya')} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${selectedMethod === 'Maya' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <span className="flex items-center gap-4">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 p-1"><img src={MAYA_LOGO_URL} alt="Maya logo" className="h-8 w-8 object-contain" /></span>
                          <span><p className="text-sm font-semibold text-gray-900">Maya</p><p className="text-xs text-gray-500">Mobile wallet</p></span>
                        </span>
                        <span className={`h-4 w-4 rounded-full border ${selectedMethod === 'Maya' ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`} />
                      </button>
                    </div>
                  </div>

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
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="border-b border-gray-200 px-6 py-5">
                <h3 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><CircleDollarSign className="text-emerald-600" size={22} />Cash Payment</h3>
                <p className="mt-1 text-sm text-gray-600">Collect and confirm the exact cash amount for this bill.</p>
              </div>
              <PaymentProgressTracker currentStep={2} />
              <div className="space-y-4 px-6 py-5">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                  <div className="flex justify-between"><span>Bill Code</span><span className="font-semibold">{paymentBillCode}</span></div>
                  <div className="mt-2 flex justify-between"><span>Patient</span><span className="font-semibold">{paymentPatientName}</span></div>
                  <div className="mt-2 flex justify-between border-t border-gray-200 pt-2"><span>Amount Due</span><span className="font-semibold text-blue-700">{toPeso(safePaymentAmountDue)}</span></div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Amount Received</label>
                  <div className="flex items-center rounded-xl border border-gray-300 bg-white px-3">
                    <span className="text-sm font-bold text-gray-700">₱</span>
                    <input type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="h-11 w-full bg-transparent px-2 text-sm outline-none" />
                  </div>
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
                <button type="button" onClick={() => setModal('payCancelConfirm')} className="h-10 flex-1 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="button" onClick={() => setModal('payConfirm')} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">Review Payment</button>
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
            <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="border-b border-gray-200 px-6 py-5">
                <h3 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><CreditCard size={22} className="text-blue-700" />{selectedMethod} Payment</h3>
                <p className="mt-1 text-sm text-gray-600">Complete the e-wallet transfer and encode the reference number.</p>
              </div>
              <PaymentProgressTracker currentStep={2} />
              <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[320px_1fr]">
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
                <button type="button" onClick={() => setModal('payConfirm')} className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">Review Payment</button>
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
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="border-b border-gray-200 px-6 py-5">
                <h3 className="text-2xl font-bold text-gray-900">Confirm Payment</h3>
                <p className="mt-1 text-sm text-gray-600">Please verify details before posting this payment.</p>
              </div>
              <PaymentProgressTracker currentStep={3} />
              <div className="space-y-3 px-6 py-5 text-sm text-gray-800">
                <div className="flex justify-between"><span>Bill Code</span><span className="font-semibold">{paymentBillCode}</span></div>
                <div className="flex justify-between"><span>Patient Name</span><span className="font-semibold">{paymentPatientName}</span></div>
                <div className="flex justify-between"><span>Patient ID</span><span className="font-semibold">{paymentPatientId ?? 'N/A'}</span></div>
                <div className="flex justify-between"><span>Payment Method</span><span className="font-semibold">{paymentMethodLabel}</span></div>
                <div className="flex justify-between"><span>Reference Number</span><span className="font-semibold">{paymentReference}</span></div>
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
