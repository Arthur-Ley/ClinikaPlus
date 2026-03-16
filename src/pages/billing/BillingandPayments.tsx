import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, ChevronDown, PlusCircle, Clock3, FileText, Wallet,
  CheckCircle2, X, ReceiptText, Stethoscope, CircleGauge,
  CalendarDays, Info, CircleDollarSign, Coins, XCircle,
  CreditCard, Hash, MinusCircle, User, Plus, Minus,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Pagination from '../../components/ui/Pagination';
import { type BillStatus } from '../../context/BillingPaymentsContext';
import { useBillingPayments } from '../../context/useBillingPayments';

// ─── Types ───────────────────────────────────────────────────────────────────

type BillRow = { id: string; patient: string; date: string; total: string; status: BillStatus; };
type ServiceItem = { type: 'service' | 'medication'; name: string; quantity: number; unitPrice: number; serviceId?: number | null; logId?: number | null; };
type MedicationCatalogItem = { medication_id: number; medication_name: string; total_stock: number; batch_number?: string; expiry_date?: string; unit?: string; };
type MedicationStockApiItem = { medication_id: number; medication_name: string; total_stock: number; batch_number?: string; expiry_date?: string; unit?: string; };
type PaymentMethod = 'Cash' | 'GCash' | 'Maya';
type BillingFilter = 'all' | 'pending' | 'paid' | 'cancelled';
type ActiveModal =
  | 'none' | 'createBill' | 'viewBill' | 'billSuccess'
  | 'payMethod' | 'payCash' | 'payGcash' | 'payConfirm'
  | 'paySuccess' | 'payCancelConfirm' | 'payCancelled' | 'receipt'
  | 'addService' | 'addMedication';

// ─── Constants ───────────────────────────────────────────────────────────────

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

const PAGE_SIZE = 5;
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const VAT_RATE = 0.12;
const SENIOR_DISCOUNT_RATE = 0.2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toAmount(total: string) { const p = Number(total.replace(/[^\d.-]/g, '')); return Number.isFinite(p) ? p : 0; }
function formatPhp(value: number) { return `PHP ${Math.round(value).toLocaleString()}`; }
function formatDateForTable(value: string) { const p = new Date(value); if (Number.isNaN(p.getTime())) return value; return p.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }); }
function formatDateLong(value: string) { const p = new Date(value); if (Number.isNaN(p.getTime())) return value; return p.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
function formatDateMed(value: string) { const p = new Date(value); if (Number.isNaN(p.getTime())) return value; return p.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }); }
function parsePositiveInt(value: string) { const n = value.trim(); if (!/^\d+$/.test(n)) return null; const p = Number(n); if (!Number.isInteger(p) || p <= 0) return null; return p; }
function resolveMedicationUnitPrice(name: string) { return medicationPriceByName[name] ?? 20; }
function toSafeQuantity(value: string) { const p = Number(value); if (!Number.isInteger(p) || p <= 0) return 1; return p; }
function normalizeBillStatus(value: string): BillStatus { const n = value.trim().toLowerCase(); if (n === 'paid') return 'Paid'; if (n === 'cancelled' || n === 'canceled') return 'Cancelled'; return 'Pending'; }
function statusCode(status: BillStatus) { if (status === 'Paid') return 'PD'; if (status === 'Cancelled') return 'CN'; return 'PN'; }
function toAutoIds(status: BillStatus, records: BillRow[]) { const code = statusCode(status); const next = records.filter(r => r.status === status).length + 1; return { billId: `B-${code}-${String(next).padStart(4, '0')}` }; }

function StatusPill({ status }: { status: string }) {
  const styles = status === 'Paid' ? 'bg-green-100 text-green-700' : status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return <span className={`inline-flex min-w-[74px] justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${styles}`}>{status}</span>;
}

function BillingSkeleton() {
  return (
    <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5 animate-pulse">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map((item) => (
          <article key={item} className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <div className="h-5 w-28 rounded bg-gray-300" />
              <div className="h-8 w-8 rounded-xl bg-gray-300" />
            </div>
            <div className="mt-4 h-10 w-40 rounded bg-gray-300" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-44 rounded bg-gray-300" />
              <div className="h-3 w-36 rounded bg-gray-300" />
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
        <div className="mb-3 h-7 w-48 rounded bg-gray-300" />
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="h-10 w-full rounded-xl bg-gray-300 lg:max-w-xl" />
          <div className="flex gap-2">
            <div className="h-10 w-36 rounded-xl bg-gray-300" />
            <div className="h-10 w-28 rounded-xl bg-gray-300" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl">
          <div className="min-w-full">
            <div className="grid grid-cols-6 gap-2 bg-gray-200/90 px-3 py-2">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-3 w-full rounded bg-gray-300" />
              ))}
            </div>
            <div className="divide-y divide-gray-200">
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="grid grid-cols-6 gap-2 px-3 py-3">
                  {[1, 2, 3, 4, 5, 6].map((col) => (
                    <div key={col} className="h-3 w-full rounded bg-gray-300" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2.5 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
          <div className="h-4 w-44 rounded bg-gray-300" />
          <div className="h-9 w-48 rounded bg-gray-300" />
        </div>
      </div>
    </section>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BillingAndPayments() {
  const { billingRecords, addBill, paymentQueue, markPaymentPaid, setPaymentProcessing, isLoading } = useBillingPayments();
  const location = useLocation();

  const [modal, setModal] = useState<ActiveModal>('none');
  const [prevModal, setPrevModal] = useState<ActiveModal>('none');
  const [searchTerm, setSearchTerm] = useState('');
  const [billingFilter, setBillingFilter] = useState<BillingFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Bill form
  const [selectedBill, setSelectedBill] = useState<BillRow | null>(null);
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

  // Add Service picker state
  const [serviceTypeSearch, setServiceTypeSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState<typeof serviceTypeOptions[0] | null>(null);
  const [selectedService, setSelectedService] = useState<{ id: number; name: string; unitPrice: number } | null>(null);
  const [serviceQty, setServiceQty] = useState(1);
  const [serviceUnitPrice, setServiceUnitPrice] = useState(0);
  const [showServiceTypeDropdown, setShowServiceTypeDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  // Add Medication picker state
  const [medicationSearch, setMedicationSearch] = useState('');
  const [selectedMedication, setSelectedMedication] = useState<MedicationCatalogItem | null>(null);
  const [medicationQty, setMedicationQty] = useState(1);
  const [medicationUnitPrice, setMedicationUnitPrice] = useState(0);
  const [showMedicationDropdown, setShowMedicationDropdown] = useState(false);

  // Payment
  const [selectedPayRow, setSelectedPayRow] = useState<BillRow | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('Cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [gcashReference, setGcashReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [focusHandledKey, setFocusHandledKey] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/medications`);
        if (!response.ok) return;
        const payload = (await response.json()) as { items?: MedicationStockApiItem[] };
        if (!active || !Array.isArray(payload.items) || !payload.items.length) return;
        setMedicationCatalog(payload.items.map(item => ({
          medication_id: item.medication_id,
          medication_name: item.medication_name,
          total_stock: item.total_stock ?? 0,
          batch_number: item.batch_number,
          expiry_date: item.expiry_date,
          unit: item.unit,
        })));
      } catch { /* keep fallback */ }
    })();
    return () => { active = false; };
  }, []);

  const filteredBills = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return billingRecords.filter(bill => {
      const matchesSearch = !normalized || bill.patient.toLowerCase().includes(normalized) || bill.id.toLowerCase().includes(normalized);
      const matchesFilter = billingFilter === 'all' || (billingFilter === 'pending' && bill.status === 'Pending') || (billingFilter === 'paid' && bill.status === 'Paid') || (billingFilter === 'cancelled' && bill.status === 'Cancelled');
      return matchesSearch && matchesFilter;
    });
  }, [billingRecords, searchTerm, billingFilter]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, billingFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredBills.length / PAGE_SIZE));
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedBills = filteredBills.slice(startIndex, startIndex + PAGE_SIZE);
  const focusBillId = useMemo(() => new URLSearchParams(location.search).get('focusBillId') || '', [location.search]);

  useEffect(() => {
    if (!focusBillId) return;
    if (focusHandledKey === `bill:${focusBillId}`) return;
    setSearchTerm('');
    setBillingFilter('all');
    const index = billingRecords.findIndex((row) => row.id === focusBillId);
    if (index >= 0) {
      setCurrentPage(Math.floor(index / PAGE_SIZE) + 1);
    }
    setTimeout(() => {
      const node = document.querySelector(`[data-search-bill-id="${focusBillId}"]`);
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFocusHandledKey(`bill:${focusBillId}`);
      }
    }, 140);
  }, [focusBillId, focusHandledKey, billingRecords]);

  const summaryCards = useMemo(() => {
    const pendingBills = filteredBills.filter(b => b.status === 'Pending');
    const paidBills = filteredBills.filter(b => b.status === 'Paid');
    const pendingTotal = pendingBills.reduce((s, b) => s + toAmount(b.total), 0);
    const allTotal = filteredBills.reduce((s, b) => s + toAmount(b.total), 0);
    const highestBill = filteredBills.reduce((m, b) => Math.max(m, toAmount(b.total)), 0);
    const averagePending = pendingBills.length > 0 ? pendingTotal / pendingBills.length : 0;
    const averageAll = filteredBills.length > 0 ? allTotal / filteredBills.length : 0;
    const oldestPendingDate = pendingBills.length ? pendingBills.map(b => b.date).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] : 'N/A';
    return [
      { title: 'Pending Bills', value: `${pendingBills.length} bills`, lines: [`Average Bill: ${formatPhp(averagePending)}`, `Oldest Bill: ${oldestPendingDate}`], accent: 'text-amber-500', chip: 'bg-amber-500', icon: Clock3 },
      { title: 'Generated', value: `${filteredBills.length} bills`, lines: [`Average per Bill: ${formatPhp(averageAll)}`, `Paid Bills: ${paidBills.length}`], accent: 'text-blue-600', chip: 'bg-blue-600', icon: FileText },
      { title: 'Awaiting Payment', value: formatPhp(pendingTotal), lines: [`Pending: ${pendingBills.length} bills`, `Highest Bill: ${formatPhp(highestBill)}`], accent: 'text-green-500', chip: 'bg-green-500', icon: Wallet },
    ];
  }, [filteredBills]);

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

  // Filtered service type / service dropdowns
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

  function openViewModal(bill: BillRow) {
    setSelectedBill(bill);
    setBillIdInput(bill.id); setBillStatusInput(bill.status);
    setPatientIdInput('P-1021'); setPatientNameInput(bill.patient);
    setPatientAgeInput('45'); setPatientGenderInput('Male');
    setDoctorInput('Dr. Henry G. Malibiran'); setDiagnosisInput('Community Acquired Pneumonia');
    setVisitDateInput(bill.date);
    setDueDateInput(new Date(new Date(bill.date).getTime() + 7 * 86400000).toISOString().slice(0, 10));
    setAdmissionDateInput(bill.date); setDischargeDateInput(bill.date);
    setServices(existingBillServices);
    setModal('viewBill');
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

  const changeAmount = useMemo(() => {
    if (!selectedPayRow) return 0;
    const received = Number(amountReceived || 0);
    if (Number.isNaN(received)) return 0;
    return Math.max(0, received - toAmount(selectedPayRow.total));
  }, [amountReceived, selectedPayRow]);

  const isWalletMethod = selectedMethod === 'GCash' || selectedMethod === 'Maya';
  const paymentMethodLabel = selectedMethod === 'Cash' ? 'Cash' : selectedMethod === 'Maya' ? 'E-Wallet (Maya)' : 'E-Wallet (GCash)';
  const paymentReference = isWalletMethod ? gcashReference || selectedPayRow?.id || 'N/A' : 'N/A';

  function openPayModal(bill: BillRow) { setSelectedPayRow(bill); setSelectedMethod('Cash'); setAmountReceived(''); setGcashReference(''); setModal('payMethod'); }
  function openReceiptModal(bill: BillRow) { setSelectedPayRow(bill); setModal('receipt'); }
  function closePayModals() { setModal('none'); setSelectedPayRow(null); setAmountReceived(''); setGcashReference(''); setSelectedMethod('Cash'); }

  function handleProceedFromMethod() {
    if (selectedPayRow) void setPaymentProcessing({ id: selectedPayRow.id, method: selectedMethod });
    setModal(selectedMethod === 'Cash' ? 'payCash' : 'payGcash');
  }

  async function handleConfirmPayment() {
    if (!selectedPayRow || isSubmitting) return;
    if (selectedMethod === 'Cash') { const received = Number(amountReceived || 0); if (Number.isNaN(received) || received < toAmount(selectedPayRow.total)) { window.alert('Amount received is not enough.'); return; } }
    if (isWalletMethod && !gcashReference.trim()) { window.alert('Reference number is required for GCash/Maya payments.'); return; }
    try {
      setIsSubmitting(true);
      await markPaymentPaid({ id: selectedPayRow.id, method: selectedMethod, reference: isWalletMethod ? gcashReference.trim() : undefined, paidDate: new Date().toISOString() });
      setModal('paySuccess');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to record payment.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isEditingExisting = modal === 'viewBill';
  const isBillModal = modal === 'createBill' || modal === 'viewBill';
  const showSkeleton = isLoading || pageLoading;

  useEffect(() => {
    if (isLoading) {
      setPageLoading(true);
      return;
    }
    const timeout = window.setTimeout(() => setPageLoading(false), 350);
    return () => window.clearTimeout(timeout);
  }, [isLoading]);

  return (
    <div className="space-y-5">
      {showSkeleton ? (
        <BillingSkeleton />
      ) : (
      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {summaryCards.map(card => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <p className="text-xl font-semibold text-gray-500">{card.title}</p>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-white ${card.chip}`}><Icon className="h-4 w-4" /></span>
                </div>
                <p className={`mt-3 text-5xl font-bold ${card.accent}`}>{card.value}</p>
                <div className="mt-2 space-y-1.5 text-gray-800">
                  {card.lines.map(line => <p key={line} className="text-xs font-semibold">{line}</p>)}
                </div>
              </article>
            );
          })}
        </div>

        {/* Billing Table */}
        <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
          <h2 className="mb-3 text-2xl font-bold text-gray-800">Billing Queue</h2>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input placeholder="Search Patient or Bill ID" className="h-10 w-full rounded-xl border border-gray-300 bg-gray-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-300" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={openCreateModal} className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-green-500 px-3.5 text-sm font-semibold text-white hover:bg-green-600">
                <PlusCircle size={16} /> Create New Bill
              </button>
              <div className="relative">
                <select value={billingFilter} onChange={e => setBillingFilter(e.target.value as BillingFilter)} className="h-10 appearance-none rounded-xl border border-gray-300 bg-gray-100 pl-3 pr-9 text-sm font-medium text-gray-600 outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-200/90 text-gray-700">
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
                  <tr key={bill.id} data-search-bill-id={bill.id} className="border-t border-gray-200 text-gray-800 hover:bg-gray-200/40">
                    <td className="px-3 py-2 font-semibold">{bill.id}</td>
                    <td className="px-3 py-2 font-semibold">{bill.patient}</td>
                    <td className="px-3 py-2 font-semibold">{formatDateForTable(bill.date)}</td>
                    <td className="px-3 py-2 font-semibold">{bill.total.replace('P', '₱')}</td>
                    <td className="px-3 py-2 font-semibold">{bill.status}</td>
                    <td className="px-3 py-2 flex items-center gap-3">
                      <button type="button" onClick={() => openViewModal(bill)} className="font-semibold text-blue-600 hover:text-blue-700">View</button>
                      {bill.status === 'Pending' && <button type="button" onClick={() => openPayModal(bill)} className="font-semibold text-green-600 hover:text-green-700">Pay</button>}
                      {bill.status === 'Paid' && <button type="button" onClick={() => openReceiptModal(bill)} className="font-semibold text-gray-600 hover:text-gray-700">Receipt</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col gap-2.5 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
            <p>Showing <span className="rounded-md bg-gray-300 px-2">{pagedBills.length}</span> out of {filteredBills.length}</p>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>
      </section>
      )}

      {/* ── Modals ── */}
      {modal !== 'none' && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md"
          onClick={() => {
            if (['payMethod','payCash','payGcash','payConfirm','payCancelConfirm','payCancelled','paySuccess','receipt'].includes(modal)) closePayModals();
            else if (modal === 'addService' || modal === 'addMedication') setModal(prevModal);
            else setModal('none');
          }}
        >

          {/* ── Create / View Bill Modal ── */}
          {(modal === 'createBill' || modal === 'viewBill') && (
            <div className="w-full max-w-[960px] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800"><ReceiptText size={18} className="text-gray-500" />Bill Details</h3>
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
                          <th className="pb-2 text-left font-medium">Service Name</th>
                          <th className="pb-2 text-center font-medium">Quantity</th>
                          <th className="pb-2 text-right font-medium">Unit Price</th>
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
                        <span>Final Bill</span>
                        <span>₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  <button type="button" onClick={handleSubmitBill} className="h-10 w-full rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 transition-colors">
                    {isEditingExisting ? 'Save Changes' : 'Create New Bill'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Add Service Modal ── */}
          {modal === 'addService' && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-gray-100"><Stethoscope size={20} className="text-gray-500" /></div>
                <h3 className="text-xl font-bold text-gray-800">Add Service</h3>
              </div>

              {/* Service Type */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Service Type</label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-full h-10 flex items-center justify-between px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => { setShowServiceTypeDropdown(v => !v); setShowServiceDropdown(false); }}
                  >
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
                          <button
                            key={type.id}
                            type="button"
                            className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-600 hover:text-white transition-colors ${selectedServiceType?.id === type.id ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
                            onClick={() => { setSelectedServiceType(type); setSelectedService(null); setServiceSearch(''); setShowServiceTypeDropdown(false); }}
                          >
                            {type.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Name */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Service Name</label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-full h-10 flex items-center justify-between px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => { if (selectedServiceType) setShowServiceDropdown(v => !v); }}
                    disabled={!selectedServiceType}
                  >
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
                          <button
                            key={svc.id}
                            type="button"
                            className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-600 hover:text-white transition-colors ${selectedService?.id === svc.id ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
                            onClick={() => { setSelectedService(svc); setServiceUnitPrice(svc.unitPrice); setShowServiceDropdown(false); }}
                          >
                            {svc.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity + Unit Price */}
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

              {/* Medication Search */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Medication Name</label>
                <div className="relative">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={medicationSearch}
                      onChange={e => { setMedicationSearch(e.target.value); setShowMedicationDropdown(true); setSelectedMedication(null); }}
                      onFocus={() => setShowMedicationDropdown(true)}
                      placeholder="Search Medication"
                      className="h-10 w-full pl-9 pr-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  {showMedicationDropdown && filteredMedicationOptions.length > 0 && (
                    <div className="absolute left-0 top-11 z-20 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                      <div className="max-h-44 overflow-auto">
                        {filteredMedicationOptions.map(med => (
                          <button
                            key={med.medication_id}
                            type="button"
                            className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-blue-600 hover:text-white transition-colors ${selectedMedication?.medication_id === med.medication_id ? 'bg-blue-600 text-white' : ''}`}
                            onClick={() => {
                              setSelectedMedication(med);
                              setMedicationSearch(med.medication_name);
                              setMedicationUnitPrice(resolveMedicationUnitPrice(med.medication_name));
                              setMedicationQty(1);
                              setShowMedicationDropdown(false);
                            }}
                          >
                            <p className="font-semibold">{med.medication_name}</p>
                            <p className={`text-xs ${selectedMedication?.medication_id === med.medication_id ? 'text-blue-100' : 'text-gray-400'}`}>
                              Stock: {med.total_stock} {med.unit || 'pcs'} &nbsp;·&nbsp; Batch: {med.batch_number || 'N/A'}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Medication Details */}
              {selectedMedication && (
                <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-xs text-gray-400">Batch</p><p className="font-bold text-gray-800">{selectedMedication.batch_number || 'N/A'}</p></div>
                    <div><p className="text-xs text-gray-400">Available</p><p className="font-bold text-gray-800">{selectedMedication.total_stock} {selectedMedication.unit || 'pcs'}</p></div>
                  </div>
                  <div><p className="text-xs text-gray-400">Expiry</p><p className="font-bold text-gray-800">{selectedMedication.expiry_date ? formatDateMed(selectedMedication.expiry_date) : 'N/A'}</p></div>
                </div>
              )}

              {/* Quantity + Unit Price */}
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

              {/* Subtotal */}
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

          {/* ── Pay: Select Method ── */}
          {modal === 'payMethod' && selectedPayRow && (
            <div className="w-full max-w-2xl rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-xl" onClick={e => e.stopPropagation()}>
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
          {modal === 'receipt' && selectedPayRow && (
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
              <div className="mt-4">
                <button type="button" onClick={closePayModals} className="h-9 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white">Done</button>
              </div>
            </div>
          )}

        </div>,
        document.body,
      )}
    </div>
  );
}
