import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  ChevronDown,
  PlusCircle,
  Clock3,
  FileText,
  Wallet,
  CheckCircle2,
  X,
  ReceiptText,
  Stethoscope,
  CircleGauge,
  CalendarDays,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination.tsx';
import { type BillStatus } from '../../context/BillingPaymentsContext.tsx';
import { useBillingPayments } from '../../context/useBillingPayments.ts';

type BillRow = {
  id: string;
  patient: string;
  date: string;
  total: string;
  status: BillStatus;
};

type ServiceItem = {
  type: 'service' | 'medication';
  name: string;
  quantity: number;
  unitPrice: number;
  serviceId?: number | null;
  logId?: number | null;
};

type MedicationCatalogItem = {
  medication_id: number;
  medication_name: string;
  total_stock: number;
};

type MedicationStockApiItem = {
  medication_id: number;
  medication_name: string;
  total_stock: number;
};

type BillModal = 'none' | 'create' | 'view' | 'success';
type BillingFilter = 'all' | 'pending' | 'paid' | 'cancelled';

const serviceCatalog = [
  { service_id: 1, name: 'Consultation', unitPrice: 500 },
  { service_id: 2, name: 'Laboratory', unitPrice: 450 },
  { service_id: 3, name: 'X-Ray', unitPrice: 1200 },
  { service_id: 4, name: 'Dentistry', unitPrice: 700 },
  { service_id: 5, name: 'Blood Tests', unitPrice: 350 },
  { service_id: 6, name: 'Physical Therapy', unitPrice: 850 },
  { service_id: 7, name: 'Oral Examination', unitPrice: 300 },
  { service_id: 8, name: 'Urinalysis', unitPrice: 200 },
];

const fallbackMedicationCatalog: MedicationCatalogItem[] = [
  { medication_id: 1, medication_name: 'Amoxicillin 250mg', total_stock: 999 },
  { medication_id: 2, medication_name: 'Penicillin', total_stock: 999 },
  { medication_id: 3, medication_name: 'Insulin (Rapid)', total_stock: 999 },
  { medication_id: 4, medication_name: 'Vitamin C', total_stock: 999 },
  { medication_id: 5, medication_name: 'Cetirizin', total_stock: 999 },
  { medication_id: 6, medication_name: 'Paracetamol 500mg', total_stock: 999 },
  { medication_id: 7, medication_name: 'Metformin', total_stock: 999 },
  { medication_id: 8, medication_name: 'Bioflu', total_stock: 999 },
];
const medicationPriceByName: Record<string, number> = {
  'Amoxicillin 250mg': 20,
  Penicillin: 15,
  'Insulin (Rapid)': 180,
  'Vitamin C': 8,
  Cetirizin: 10,
  'Paracetamol 500mg': 12,
  Metformin: 18,
  Bioflu: 22,
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

function money(value: number) {
  return `PHP ${value.toLocaleString()}`;
}

function toAmount(total: string) {
  const parsed = Number(total.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPhp(value: number) {
  return `PHP ${Math.round(value).toLocaleString()}`;
}

function formatDateForTable(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

function parsePositiveInt(value: string) {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function resolveMedicationUnitPrice(name: string) {
  return medicationPriceByName[name] ?? 20;
}

function toSafeQuantity(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 1;
  return parsed;
}

function StatusPill({ status }: { status: string }) {
  if (status !== 'Pending') return null;
  return (
    <span className="inline-flex min-w-[74px] justify-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-600">
      {status}
    </span>
  );
}

function normalizeBillStatus(value: string): BillStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'paid') return 'Paid';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
  return 'Pending';
}

function statusCode(status: BillStatus) {
  if (status === 'Paid') return 'PD';
  if (status === 'Cancelled') return 'CN';
  return 'PN';
}

function toAutoIds(status: BillStatus, records: BillRow[]) {
  const code = statusCode(status);
  const next = records.filter((record) => record.status === status).length + 1;
  const sequence = String(next).padStart(4, '0');
  return {
    billId: `B-${code}-${sequence}`,
  };
}

export default function BillingRecords() {
  const [searchTerm, setSearchTerm] = useState('');
  const [billingFilter, setBillingFilter] = useState<BillingFilter>('all');
  const { billingRecords, addBill } = useBillingPayments();
  const [modal, setModal] = useState<BillModal>('none');
  const [selectedBill, setSelectedBill] = useState<BillRow | null>(null);
  const [billIdInput, setBillIdInput] = useState('');
  const [billStatusInput, setBillStatusInput] = useState('');
  const [patientIdInput, setPatientIdInput] = useState('');
  const [patientNameInput, setPatientNameInput] = useState('');
  const [visitDateInput, setVisitDateInput] = useState('');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [medicationSearch, setMedicationSearch] = useState('');
  const [medicationCatalog, setMedicationCatalog] = useState<MedicationCatalogItem[]>(fallbackMedicationCatalog);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showMedicationPicker, setShowMedicationPicker] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSeniorCitizen, setIsSeniorCitizen] = useState(false);
  const visitDateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/medications`);
        if (!response.ok) return;
        const payload = (await response.json()) as { items?: MedicationStockApiItem[] };
        if (!active || !Array.isArray(payload.items) || !payload.items.length) return;
        setMedicationCatalog(
          payload.items.map((item) => ({
            medication_id: item.medication_id,
            medication_name: item.medication_name,
            total_stock: item.total_stock ?? 0,
          })),
        );
      } catch {
        // Keep fallback medication catalog if API is unavailable.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const filteredBills = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return billingRecords.filter((bill) => {
      const matchesSearch =
        !normalized || bill.patient.toLowerCase().includes(normalized) || bill.id.toLowerCase().includes(normalized);
      const matchesFilter =
        billingFilter === 'all' ||
        (billingFilter === 'pending' && bill.status === 'Pending') ||
        (billingFilter === 'paid' && bill.status === 'Paid') ||
        (billingFilter === 'cancelled' && bill.status === 'Cancelled');
      return matchesSearch && matchesFilter;
    });
  }, [billingRecords, searchTerm, billingFilter]);

  const summaryCards = useMemo(() => {
    const pendingBills = filteredBills.filter((bill) => bill.status === 'Pending');
    const paidBills = filteredBills.filter((bill) => bill.status === 'Paid');
    const pendingTotal = pendingBills.reduce((sum, bill) => sum + toAmount(bill.total), 0);
    const allTotal = filteredBills.reduce((sum, bill) => sum + toAmount(bill.total), 0);
    const highestBill = filteredBills.reduce((max, bill) => Math.max(max, toAmount(bill.total)), 0);
    const averagePending = pendingBills.length > 0 ? pendingTotal / pendingBills.length : 0;
    const averageAll = filteredBills.length > 0 ? allTotal / filteredBills.length : 0;
    const oldestPendingDate = pendingBills.length
      ? pendingBills
          .map((bill) => bill.date)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
      : 'N/A';

    return [
      {
        title: 'Pending Bills',
        value: `${pendingBills.length} bills`,
        lines: [`Average Bill: ${formatPhp(averagePending)}`, `Oldest Bill: ${oldestPendingDate}`],
        accent: 'text-amber-500',
        chip: 'bg-amber-500',
        icon: Clock3,
      },
      {
        title: 'Generated',
        value: `${filteredBills.length} bills`,
        lines: [`Average per Bill: ${formatPhp(averageAll)}`, `Paid Bills: ${paidBills.length}`],
        accent: 'text-blue-600',
        chip: 'bg-blue-600',
        icon: FileText,
      },
      {
        title: 'Awaiting Payment',
        value: formatPhp(pendingTotal),
        lines: [`Pending: ${pendingBills.length} bills`, `Highest Bill: ${formatPhp(highestBill)}`],
        accent: 'text-green-500',
        chip: 'bg-green-500',
        icon: Wallet,
      },
    ];
  }, [filteredBills]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, billingFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedBills = filteredBills.slice(startIndex, startIndex + PAGE_SIZE);

  const subtotal = useMemo(() => {
    return services.reduce((acc, service) => acc + service.quantity * service.unitPrice, 0);
  }, [services]);

  const discount = isSeniorCitizen ? subtotal * SENIOR_DISCOUNT_RATE : 0;
  const tax = isSeniorCitizen ? 0 : subtotal * VAT_RATE;
  const total = subtotal - discount + tax;

  const filteredServiceCatalog = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    if (!query) return serviceCatalog;
    return serviceCatalog.filter((item) => item.name.toLowerCase().includes(query));
  }, [serviceSearch]);

  const filteredMedicationCatalog = useMemo(() => {
    const query = medicationSearch.trim().toLowerCase();
    if (!query) return medicationCatalog;
    return medicationCatalog.filter((item) => item.medication_name.toLowerCase().includes(query));
  }, [medicationSearch, medicationCatalog]);

  function resetCreateForm() {
    const defaultStatus: BillStatus = 'Pending';
    const ids = toAutoIds(defaultStatus, billingRecords);
    setBillIdInput(ids.billId);
    setBillStatusInput(defaultStatus);
    setPatientIdInput('');
    setPatientNameInput('');
    setVisitDateInput('');
    setServices([]);
    setShowServicePicker(false);
    setShowMedicationPicker(false);
    setServiceSearch('');
    setMedicationSearch('');
    setIsSeniorCitizen(false);
  }

  function openCreateModal() {
    resetCreateForm();
    setSelectedBill(null);
    setModal('create');
  }

  function openViewModal(bill: BillRow) {
    setSelectedBill(bill);
    setBillIdInput(bill.id);
    setBillStatusInput(bill.status);
    setPatientIdInput('Philippine Medical Supply Trading');
    setPatientNameInput(bill.patient);
    setVisitDateInput(bill.date);
    setServices(existingBillServices);
    setShowServicePicker(false);
    setShowMedicationPicker(false);
    setServiceSearch('');
    setMedicationSearch('');
    setModal('view');
  }

  function addService(serviceId: number, name: string, unitPrice: number, quantity = 1) {
    setServices((prev) => [...prev, { type: 'service', name, quantity, unitPrice, serviceId, logId: null }]);
    setShowServicePicker(false);
  }

  function addMedication(item: MedicationCatalogItem, unitPrice: number, quantity = 1) {
    if (item.total_stock < quantity) {
      window.alert(`Insufficient stock for ${item.medication_name}. Available: ${item.total_stock}`);
      return;
    }

    setServices((prev) => [
      ...prev,
      {
        type: 'medication',
        name: item.medication_name,
        quantity,
        unitPrice,
        serviceId: null,
        logId: item.medication_id,
      },
    ]);
    setShowMedicationPicker(false);
  }

  function updateServiceQuantity(index: number, rawValue: string) {
    setServices((prev) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;

      const requestedQuantity = toSafeQuantity(rawValue);
      if (target.type !== 'medication') {
        next[index] = { ...target, quantity: requestedQuantity };
        return next;
      }

      const medicationId = target.logId ?? null;
      const catalogItem = medicationCatalog.find((item) => item.medication_id === medicationId);
      const availableStock = catalogItem?.total_stock ?? 0;

      if (availableStock <= 0) {
        window.alert(`Insufficient stock for ${target.name}.`);
        next[index] = { ...target, quantity: 1 };
        return next;
      }

      if (requestedQuantity > availableStock) {
        window.alert(`Insufficient stock for ${target.name}. Available: ${availableStock}`);
        next[index] = { ...target, quantity: availableStock };
        return next;
      }

      next[index] = { ...target, quantity: requestedQuantity };
      return next;
    });
  }

  function changeServiceQuantity(index: number, delta: number) {
    setServices((prev) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;

      const requestedQuantity = Math.max(1, target.quantity + delta);
      if (target.type !== 'medication') {
        next[index] = { ...target, quantity: requestedQuantity };
        return next;
      }

      const medicationId = target.logId ?? null;
      const catalogItem = medicationCatalog.find((item) => item.medication_id === medicationId);
      const availableStock = catalogItem?.total_stock ?? 0;

      if (availableStock <= 0) {
        window.alert(`Insufficient stock for ${target.name}.`);
        next[index] = { ...target, quantity: 1 };
        return next;
      }

      if (requestedQuantity > availableStock) {
        window.alert(`Insufficient stock for ${target.name}. Available: ${availableStock}`);
        next[index] = { ...target, quantity: availableStock };
        return next;
      }

      next[index] = { ...target, quantity: requestedQuantity };
      return next;
    });
  }

  function removeService(index: number) {
    setServices((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSubmitBill() {
    try {
      if (!isEditingExisting) {
        const patientId = parsePositiveInt(patientIdInput) ?? undefined;
        if (!patientId) {
          throw new Error('Valid numeric Patient ID is required.');
        }
        if (!services.length) {
          throw new Error('Add at least one service or medication before creating a bill.');
        }

        const status = normalizeBillStatus(billStatusInput);
        const generatedIds = toAutoIds(status, billingRecords);
        const id = billIdInput.trim() || generatedIds.billId;
        const patient = patientNameInput.trim() || 'Unknown Patient';
        const date = visitDateInput.trim() || new Date().toISOString().slice(0, 10);
        const totalAmount = `P${Math.round(total).toLocaleString()}`;
        const normalizedItems = services.map((service) => ({
          name: service.name,
          quantity: service.quantity,
          unitPrice: service.unitPrice,
          serviceId: service.serviceId ?? null,
          logId: service.logId ?? null,
        }));

        await addBill({
          id,
          patient,
          date,
          total: totalAmount,
          status,
          patientId,
          discountAmount: Number(discount.toFixed(2)),
          taxAmount: Number(tax.toFixed(2)),
          items: normalizedItems,
        });
      }

      setModal('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create bill.';
      window.alert(message);
    }
  }

  const isEditingExisting = modal === 'view';

  function handleCreateStatusChange(value: BillStatus) {
    setBillStatusInput(value);
    const ids = toAutoIds(value, billingRecords);
    setBillIdInput(ids.billId);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Billing & Payments | Billing Records</h1>

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <p className="text-xl font-semibold text-gray-500">{card.title}</p>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-white ${card.chip}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className={`mt-3 text-5xl font-bold ${card.accent}`}>{card.value}</p>
                <div className="mt-2 space-y-1.5 text-gray-800">
                  {card.lines.map((line) => (
                    <p key={line} className="text-3.5 font-semibold">{line}</p>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
          <h2 className="mb-3 text-3xl font-bold text-gray-800 md:text-4xl">Billing Queue</h2>

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                placeholder="Search Patient"
                className="h-10 w-full rounded-xl border border-gray-300 bg-gray-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openCreateModal}
                className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-green-500 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
              >
                <PlusCircle size={16} />
                Create New Bill
              </button>
              <div className="relative">
                <select
                  value={billingFilter}
                  onChange={(e) => setBillingFilter(e.target.value as BillingFilter)}
                  className="h-10 appearance-none rounded-xl border border-gray-300 bg-gray-100 pl-3 pr-9 text-sm font-medium text-gray-600 outline-none focus:ring-2 focus:ring-blue-300"
                >
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
                {pagedBills.map((bill) => (
                  <tr key={bill.id} className="border-t border-gray-200 text-gray-800 hover:bg-gray-200/40">
                    <td className="px-3 py-2 font-semibold">{bill.id}</td>
                    <td className="px-3 py-2 font-semibold">{bill.patient}</td>
                    <td className="px-3 py-2 font-semibold">{formatDateForTable(bill.date)}</td>
                    <td className="px-3 py-2 font-semibold">{bill.total.replace('P', '₱')}</td>
                    <td className="px-3 py-2 font-semibold">{bill.status}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="font-semibold text-blue-600 hover:text-blue-700" onClick={() => openViewModal(bill)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-2.5 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
            <p>
              Showing <span className="rounded-md bg-gray-300 px-2">{pagedBills.length}</span> out of {filteredBills.length}
            </p>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>
      </section>

      {(modal === 'create' || modal === 'view' || modal === 'success') &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]">
          {(modal === 'create' || modal === 'view') && (
            <div className="w-full max-w-[920px] rounded-2xl border border-gray-300 bg-gray-100 p-4 shadow-xl md:p-5">
              <div className="flex items-center justify-between border-b border-gray-300 pb-3">
                <h3 className="flex items-center gap-2 text-xl font-medium text-gray-600">
                  <ReceiptText size={18} />
                  Bill Details
                </h3>
                <button
                  type="button"
                  onClick={() => setModal('none')}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[250px_1fr]">
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <ReceiptText size={16} />
                      Bill Information
                    </h4>
                    <div className="space-y-1.5 text-sm">
                      <label className="block text-xs text-gray-600">Bill ID</label>
                      {isEditingExisting ? (
                        <p className="font-medium text-gray-800">{billIdInput || selectedBill?.id}</p>
                      ) : (
                        <input value={billIdInput} readOnly className="h-8 w-full rounded border border-gray-300 bg-gray-200 px-2 text-gray-700" />
                      )}

                      <label className="block pt-1 text-xs text-gray-600">Bill Status</label>
                      {isEditingExisting ? (
                        <StatusPill status={billStatusInput || selectedBill?.status || 'Pending'} />
                      ) : (
                        <select
                          value={normalizeBillStatus(billStatusInput)}
                          onChange={(e) => handleCreateStatusChange(e.target.value as BillStatus)}
                          className="h-8 w-full rounded border border-gray-300 bg-transparent px-2"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Paid">Paid</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <CircleGauge size={16} />
                      Patient Information
                    </h4>
                    <div className="space-y-1.5 text-sm">
                      <label className="block text-xs text-gray-600">Patient ID</label>
                      {isEditingExisting ? (
                        <p className="font-medium text-gray-800">{patientIdInput}</p>
                      ) : (
                        <input
                          value={patientIdInput}
                          onChange={(e) => setPatientIdInput(e.target.value)}
                          className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-gray-700"
                          placeholder="Enter ID"
                        />
                      )}

                      <label className="block pt-1 text-xs text-gray-600">Patient Name</label>
                      {isEditingExisting ? (
                        <p className="font-medium text-gray-800">{patientNameInput}</p>
                      ) : (
                        <input value={patientNameInput} onChange={(e) => setPatientNameInput(e.target.value)} className="h-8 w-full rounded border border-gray-300 bg-transparent px-2" />
                      )}

                      <label className="block pt-1 text-xs text-gray-600">Visit Date</label>
                      {isEditingExisting ? (
                        <p className="font-medium text-gray-800">{visitDateInput}</p>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={visitDateInputRef}
                            type="date"
                            value={visitDateInput}
                            onChange={(e) => setVisitDateInput(e.target.value)}
                            className="h-8 flex-1 rounded border border-gray-300 bg-transparent px-2"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const picker = visitDateInputRef.current as HTMLInputElement & { showPicker?: () => void };
                              picker.showPicker?.();
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-200"
                            aria-label="Open calendar"
                            title="Open calendar"
                          >
                            <CalendarDays size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Stethoscope size={16} />
                    Services and Treatment
                  </h4>
                  <table className="w-full text-sm">
                    <thead className="text-gray-600">
                      <tr>
                        <th className="py-1 text-left font-medium">Service Name</th>
                        <th className="py-1 text-left font-medium">Quantity</th>
                        <th className="py-1 text-left font-medium">Unit Price</th>
                        <th className="py-1 text-left font-medium">Subtotal</th>
                        {!isEditingExisting && <th className="py-1 text-right font-medium">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((service, idx) => (
                        <tr key={`${service.name}-${idx}`} className="border-b border-gray-300 text-gray-800">
                          <td className="py-1.5">{service.name}</td>
                          <td className="py-1.5">
                            {isEditingExisting ? (
                              service.quantity
                            ) : (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => changeServiceQuantity(idx, -1)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-gray-200 text-gray-700 hover:bg-gray-300"
                                  aria-label={`Decrease quantity for ${service.name}`}
                                  title="Decrease quantity"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={service.quantity}
                                  onChange={(e) => updateServiceQuantity(idx, e.target.value)}
                                  className="h-7 w-16 rounded border border-gray-300 bg-transparent px-2 text-center"
                                />
                                <button
                                  type="button"
                                  onClick={() => changeServiceQuantity(idx, 1)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-gray-200 text-gray-700 hover:bg-gray-300"
                                  aria-label={`Increase quantity for ${service.name}`}
                                  title="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-1.5">{money(service.unitPrice)}</td>
                          <td className="py-1.5">{money(service.quantity * service.unitPrice)}</td>
                          {!isEditingExisting && (
                            <td className="py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => removeService(idx)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-gray-700 hover:bg-red-100 hover:text-red-600"
                                aria-label={`Remove ${service.name}`}
                                title={`Remove ${service.name}`}
                              >
                                <X size={12} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {services.length === 0 && (
                        <tr className="border-b border-gray-300 text-gray-600">
                          <td className="py-4"> </td>
                          <td />
                          <td />
                          <td />
                          {!isEditingExisting && <td />}
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <div className="relative mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setShowServicePicker((v) => !v)}
                      className="flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white"
                    >
                      <CircleGauge size={14} />
                      Add Service
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMedicationPicker((v) => !v)}
                      className="flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white"
                    >
                      <PlusCircle size={14} />
                      Add Medication
                      <ChevronDown size={14} />
                    </button>

                    {showServicePicker && (
                      <div className="absolute left-0 top-11 z-10 w-full max-w-[330px] rounded-lg border border-gray-300 bg-gray-100 p-2 shadow-md">
                        <input
                          value={serviceSearch}
                          onChange={(e) => setServiceSearch(e.target.value)}
                          placeholder="Search Service"
                          className="h-7 w-full rounded-full border border-gray-400 bg-transparent px-3 text-sm"
                        />
                        <div className="mt-2 max-h-40 overflow-auto text-sm">
                          {filteredServiceCatalog.map((item) => (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => addService(item.service_id, item.name, item.unitPrice, 1)}
                              className="block w-full px-2 py-0.5 text-left hover:bg-blue-600 hover:text-white"
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showMedicationPicker && (
                      <div className="absolute right-0 top-11 z-10 w-full max-w-[330px] rounded-lg border border-gray-300 bg-gray-100 p-2 shadow-md">
                        <input
                          value={medicationSearch}
                          onChange={(e) => setMedicationSearch(e.target.value)}
                          placeholder="Search Medication"
                          className="h-7 w-full rounded-full border border-gray-400 bg-transparent px-3 text-sm"
                        />
                        <div className="mt-2 max-h-40 overflow-auto text-sm">
                          {filteredMedicationCatalog.map((item) => (
                            <button
                              key={item.medication_id}
                              type="button"
                              onClick={() => addMedication(item, resolveMedicationUnitPrice(item.medication_name), 1)}
                              className="block w-full px-2 py-0.5 text-left hover:bg-blue-600 hover:text-white"
                            >
                              {item.medication_name} ({item.total_stock} in stock)
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 rounded-xl bg-gray-300 p-4 text-sm">
                    {!isEditingExisting && (
                      <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={isSeniorCitizen}
                          onChange={(e) => setIsSeniorCitizen(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-400"
                        />
                        Senior Citizen (20% discount, VAT exempt)
                      </label>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Subtotal</span>
                        <span>{money(subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between font-semibold">
                        <span>Discount</span>
                        <span>{money(discount)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-gray-400 pb-2 font-semibold">
                        <span>Tax</span>
                        <span>{money(tax)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 font-bold">
                        <span>Total</span>
                        <span>{money(total)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmitBill}
                    className="mt-4 h-9 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white"
                  >
                    {isEditingExisting ? 'Save Changes' : 'Create New Bill'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {modal === 'success' && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl">
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" strokeWidth={2} />
              <h3 className="mt-3 text-4xl font-bold text-gray-800">Added Successfully!</h3>
              <p className="mt-2 text-sm text-gray-600">Medical bill record has been successfully added.</p>
              <button
                type="button"
                onClick={() => setModal('none')}
                className="mt-6 h-9 w-32 rounded-lg bg-blue-600 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          )}
          </div>,
          document.body,
        )}
    </div>
  );
}





