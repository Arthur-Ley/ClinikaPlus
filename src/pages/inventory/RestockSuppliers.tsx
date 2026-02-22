import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Boxes,
  ChevronDown,
  Clock3,
  PlusCircle,
  ShieldCheck,
  Syringe,
  Truck,
  X,
  Building2,
  BadgeCheck,
  Phone,
  Mail,
  MapPin,
  ImagePlus,
  CheckCircle2,
} from 'lucide-react';
import Button from '../../components/ui/Button.tsx';

type RequestSeverity = 'Critical' | 'Warning';
type RequestStatus = 'Pending' | 'Completed' | 'Cancelled';

type RestockRequest = {
  id: string;
  medication: string;
  category: string;
  severity: RequestSeverity;
  quantity: number;
  unit: string;
  currentStock: number;
  threshold: number;
  requestedOn: string;
  supplier: string;
  status: RequestStatus;
};

type SupplierStatus = 'Preferred' | 'Active' | 'Review';

type Supplier = {
  id: string;
  name: string;
  totalRequests: number;
  completed: number;
  cancelled: number;
  status: SupplierStatus;
  contact?: string;
  email?: string;
  address?: string;
};

type InventoryStatus = 'Adequate' | 'Low' | 'Critical';
type MedicationStockItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  status: InventoryStatus;
  reorder: number;
  supplier: string;
  lastUpdated: string;
};
type MedicationStockApiItem = {
  medication_id: number;
  medication_name: string;
  category_name: string;
  unit: string;
  reorder_threshold: number;
  total_stock: number;
  status: InventoryStatus;
  supplier_name: string | null;
  last_updated: string | null;
};
type SupplierApiRow = {
  supplier_id: number;
  supplier_name: string;
  status: string;
  is_preferred: boolean;
};
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getSupplierForCategory(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes('anti') || normalized.includes('antibiotic') || normalized.includes('antimicrobial')) return 'MedSupply Co.';
  if (normalized.includes('hypertensive') || normalized.includes('dyslipidemia') || normalized.includes('thrombotic')) return 'PharmaPlus';
  if (normalized.includes('asthma') || normalized.includes('broncho') || normalized.includes('fluid')) return 'HealthSource';
  return 'MediHealth Depot';
}

function cardIconStyle(tone: 'blue' | 'amber') {
  return tone === 'blue'
    ? 'bg-blue-600/90 text-white'
    : 'bg-amber-500/90 text-white';
}

export default function RestockSuppliers() {
  const [requestSeverityFilter, setRequestSeverityFilter] = useState('All Severity');
  const [requestCategoryFilter, setRequestCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [supplierRows, setSupplierRows] = useState<Supplier[]>([]);
  const [stockRows, setStockRows] = useState<MedicationStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState<'none' | 'add' | 'confirm' | 'success' | 'view'>('none');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    status: '' as SupplierStatus | '',
    contact: '',
    email: '',
    address: '',
  });
  const [formErrors, setFormErrors] = useState({
    name: '',
    status: '',
    contact: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError('');

    async function loadData() {
      try {
        const [medicationsRes, suppliersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/medications`),
          fetch(`${API_BASE_URL}/medications/suppliers`),
        ]);

        if (!medicationsRes.ok || !suppliersRes.ok) {
          throw new Error('Failed to load medication or supplier records.');
        }

        const medicationsJson = (await medicationsRes.json()) as { items: MedicationStockApiItem[] };
        const suppliersJson = (await suppliersRes.json()) as { suppliers: SupplierApiRow[] };
        if (!isMounted) return;

        const mappedStocks: MedicationStockItem[] = (medicationsJson.items || []).map((entry) => ({
          id: `I-${String(entry.medication_id).padStart(3, '0')}`,
          name: entry.medication_name,
          category: entry.category_name,
          stock: entry.total_stock ?? 0,
          unit: entry.unit,
          status: entry.status,
          reorder: entry.reorder_threshold,
          supplier: entry.supplier_name || getSupplierForCategory(entry.category_name),
          lastUpdated: entry.last_updated || new Date().toISOString(),
        }));

        const mappedSuppliers: Supplier[] = (suppliersJson.suppliers || []).map((supplier) => {
          const resolvedStatus: SupplierStatus =
            supplier.is_preferred ? 'Preferred' : supplier.status === 'Active' ? 'Active' : 'Review';

          return {
            id: `SUP-${String(supplier.supplier_id).padStart(3, '0')}`,
            name: supplier.supplier_name,
            totalRequests: 0,
            completed: 0,
            cancelled: 0,
            status: resolvedStatus,
          };
        });

        setStockRows(mappedStocks);
        setSupplierRows(mappedSuppliers);
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load data.');
        setStockRows([]);
        setSupplierRows([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const generatedRestockRequests: RestockRequest[] = useMemo(() => {
    return stockRows
      .filter((item) => item.stock < item.reorder || item.status === 'Critical')
      .map((item, idx) => {
        const severity: RequestSeverity = item.stock <= 0 || item.status === 'Critical' ? 'Critical' : 'Warning';
        const quantity = Math.max(item.reorder - item.stock, item.reorder);
        const status: RequestStatus =
          severity === 'Critical' ? 'Pending' : idx % 4 === 0 ? 'Completed' : idx % 5 === 0 ? 'Cancelled' : 'Pending';
        const requestedOn = item.lastUpdated && item.lastUpdated !== 'N/A'
          ? new Date(item.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
          : new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

        return {
          id: `RR-${String(1101 + idx).padStart(4, '0')}`,
          medication: item.name,
          category: item.category,
          severity,
          quantity,
          unit: item.unit,
          currentStock: item.stock,
          threshold: item.reorder,
          requestedOn,
          supplier: item.supplier || getSupplierForCategory(item.category),
          status,
        };
      });
  }, [stockRows]);

  const requestCategories = useMemo(() => {
    const categories = Array.from(new Set(generatedRestockRequests.map((request) => request.category)));
    categories.sort((a, b) => a.localeCompare(b));
    return categories;
  }, [generatedRestockRequests]);

  const filteredRestockRequests = useMemo(() => {
    return generatedRestockRequests.filter((request) => {
      const matchesSeverity = requestSeverityFilter === 'All Severity' || request.severity === requestSeverityFilter;
      const matchesCategory = requestCategoryFilter === 'All Categories' || request.category === requestCategoryFilter;
      return matchesSeverity && matchesCategory;
    });
  }, [generatedRestockRequests, requestSeverityFilter, requestCategoryFilter]);

  const requestsByStatus = useMemo(() => {
    return {
      Completed: filteredRestockRequests.filter((request) => request.status === 'Completed'),
      Pending: filteredRestockRequests.filter((request) => request.status === 'Pending'),
      Cancelled: filteredRestockRequests.filter((request) => request.status === 'Cancelled'),
    } as const;
  }, [filteredRestockRequests]);

  const criticalNeedsCount = useMemo(
    () => generatedRestockRequests.filter((request) => request.severity === 'Critical').length,
    [generatedRestockRequests],
  );
  const pendingRequestsCount = useMemo(
    () => generatedRestockRequests.filter((request) => request.status === 'Pending').length,
    [generatedRestockRequests],
  );
  const oldestPendingDate = useMemo(() => {
    const pending = generatedRestockRequests.filter((request) => request.status === 'Pending');
    if (pending.length === 0) return 'N/A';
    return pending
      .map((request) => request.requestedOn)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
  }, [generatedRestockRequests]);
  const mostUrgentMedication = useMemo(() => {
    if (generatedRestockRequests.length === 0) return 'N/A';
    return generatedRestockRequests
      .slice()
      .sort((a, b) => a.currentStock - b.currentStock)[0].medication;
  }, [generatedRestockRequests]);
  const activeSuppliersCount = useMemo(
    () => supplierRows.filter((supplier) => supplier.status === 'Active' || supplier.status === 'Preferred').length,
    [supplierRows],
  );
  const preferredSupplier = useMemo(
    () => supplierRows.find((supplier) => supplier.status === 'Preferred')?.name || 'N/A',
    [supplierRows],
  );

  const supplierRequestStats = useMemo(() => {
    return generatedRestockRequests.reduce<Record<string, { total: number; completed: number; cancelled: number }>>((acc, request) => {
      if (!acc[request.supplier]) {
        acc[request.supplier] = { total: 0, completed: 0, cancelled: 0 };
      }
      acc[request.supplier].total += 1;
      if (request.status === 'Completed') acc[request.supplier].completed += 1;
      if (request.status === 'Cancelled') acc[request.supplier].cancelled += 1;
      return acc;
    }, {});
  }, [generatedRestockRequests]);

  const alignedSuppliers = useMemo(() => {
    return supplierRows.map((supplier) => {
      const stats = supplierRequestStats[supplier.name] || { total: 0, completed: 0, cancelled: 0 };
      return {
        ...supplier,
        totalRequests: stats.total,
        completed: stats.completed,
        cancelled: stats.cancelled,
      };
    });
  }, [supplierRows, supplierRequestStats]);

  const displayedSuppliers = useMemo(() => {
    return alignedSuppliers.filter((supplier) => {
      const matchesStatus = statusFilter === 'All Status' || supplier.status === statusFilter;
      return matchesStatus;
    });
  }, [alignedSuppliers, statusFilter]);

  function handleAddSupplierSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const nextErrors = {
      name: newSupplier.name.trim() ? '' : 'This is a required field.',
      status: newSupplier.status ? '' : 'Please select a status.',
      contact: /^\+?\d{10,15}$/.test(newSupplier.contact.trim()) ? '' : 'The format is not correct.',
      email: /\S+@\S+\.\S+/.test(newSupplier.email.trim()) ? '' : 'Email address should contain @ symbol.',
      address: newSupplier.address.trim() ? '' : 'This is a required field.',
    };

    setFormErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setConfirmChecked(false);
    setModal('confirm');
  }

  function handleConfirmSupplier() {
    if (!confirmChecked || !newSupplier.status) return;

    const nextId = `SUP-${String(supplierRows.length + 1).padStart(3, '0')}`;
    const supplier: Supplier = {
      id: nextId,
      name: newSupplier.name || 'New Supplier',
      totalRequests: 0,
      completed: 0,
      cancelled: 0,
      status: newSupplier.status,
      contact: newSupplier.contact,
      email: newSupplier.email,
      address: newSupplier.address,
    };

    setSupplierRows((prev) => [supplier, ...prev]);
    setModal('success');
    setNewSupplier({
      name: '',
      status: '',
      contact: '',
      email: '',
      address: '',
    });
    setFormErrors({
      name: '',
      status: '',
      contact: '',
      email: '',
      address: '',
    });
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Inventory | Restock and Suppliers</h1>

      <section className="flex flex-col gap-5 rounded-2xl bg-gray-300/80 p-5">
        {isLoading && (
          <article className="rounded-xl border border-gray-300 bg-gray-100 p-4 text-sm text-gray-600">
            Loading medication and supplier data...
          </article>
        )}
        {!isLoading && loadError && (
          <article className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </article>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Critical Needs</p>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${cardIconStyle('blue')}`}>
                <Syringe className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-blue-600">{criticalNeedsCount} medications</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Require immediate restocking</p>
            <p className="mt-2 text-sm text-gray-700">Most Urgent: {mostUrgentMedication}</p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Pending Requests</p>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${cardIconStyle('amber')}`}>
                <Clock3 className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-amber-500">{pendingRequestsCount} stock requests</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Awaiting action</p>
            <p className="mt-2 text-sm text-gray-700">Oldest: {oldestPendingDate}</p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Supplier Coverage</p>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${cardIconStyle('blue')}`}>
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-blue-600">{activeSuppliersCount} Active</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Suppliers supplying key medicines</p>
            <p className="mt-2 text-sm text-gray-700">Preferred: {preferredSupplier}</p>
          </article>
        </div>

        <div className="order-2 rounded-2xl bg-gray-100 p-4">
          <div className="space-y-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Boxes className="h-6 w-6 text-gray-500" />
                <h2 className="text-xl font-semibold text-gray-700">Restock Requests</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <select
                    value={requestSeverityFilter}
                    onChange={(e) => setRequestSeverityFilter(e.target.value)}
                    className="h-10 appearance-none rounded-lg border border-gray-300 bg-gray-100 pl-3 pr-8 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option>All Severity</option>
                    <option>Critical</option>
                    <option>Warning</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                </div>
                <div className="relative">
                  <select
                    value={requestCategoryFilter}
                    onChange={(e) => setRequestCategoryFilter(e.target.value)}
                    className="h-10 appearance-none rounded-lg border border-gray-300 bg-gray-100 pl-3 pr-8 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option>All Categories</option>
                    {requestCategories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              {(['Completed', 'Pending', 'Cancelled'] as RequestStatus[]).map((status) => (
                <section key={status} className="rounded-xl border border-gray-300 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between border-b border-gray-300 pb-2">
                    <h3 className="text-sm font-semibold text-gray-700">{status}</h3>
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                      {requestsByStatus[status].length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {requestsByStatus[status].map((request) => (
                      <article key={request.id} className="rounded-lg border border-blue-300 bg-blue-100/70 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 text-blue-700">
                              <Truck className="h-3.5 w-3.5" />
                              <span className="font-semibold">Request ID: {request.id}</span>
                            </div>
                            <p className="truncate font-semibold text-gray-800">{request.medication}</p>
                            <p className="text-xs text-gray-700">
                              {request.currentStock} {request.unit} / {request.threshold} {request.unit} threshold
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedRequestId((prev) => (prev === request.id ? null : request.id))}
                            className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            {expandedRequestId === request.id ? 'Hide' : 'Details'}
                          </button>
                        </div>

                        {expandedRequestId === request.id && (
                          <>
                            <div className="mt-3 space-y-1 text-gray-800">
                              <p>Category: {request.category}</p>
                              <p>Quantity: {request.quantity} {request.unit}</p>
                              <p>Requested On: {request.requestedOn}</p>
                              <p>Supplier: {request.supplier}</p>
                              <p className={request.status === 'Pending' ? 'text-amber-600' : request.status === 'Completed' ? 'text-blue-600' : 'text-red-600'}>
                                Status: {request.status}
                              </p>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-blue-600">
                              <button className="hover:text-blue-700">View Stock Request</button>
                              {request.status === 'Pending' && <button className="hover:text-blue-700">Adjust Restock</button>}
                              {request.status === 'Pending' && <button className="hover:text-blue-700">Cancel</button>}
                            </div>
                          </>
                        )}
                      </article>
                    ))}
                    {requestsByStatus[status].length === 0 && (
                      <article className="rounded-lg border border-gray-300 bg-white p-3 text-xs text-gray-600">
                        No {status.toLowerCase()} requests.
                      </article>
                    )}
                  </div>
                </section>
              ))}
            </div>

            {filteredRestockRequests.length === 0 && (
              <article className="rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                No restock requests match this filter.
              </article>
            )}
          </div>
        </div>

        <div className="order-1 rounded-2xl bg-gray-100 p-4 md:p-5">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-2 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-500" />
                <h2 className="text-xl font-semibold text-gray-700">Supplier Table</h2>
              </div>
              <Button
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap bg-green-500 pl-3 pr-4 py-1.5 text-sm hover:bg-green-600"
                onClick={() => setModal('add')}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                Add Supplier
              </Button>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 appearance-none rounded-lg border border-gray-300 bg-gray-100 pl-3 pr-8 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option>All Status</option>
                  <option>Preferred</option>
                  <option>Active</option>
                  <option>Review</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full table-fixed text-sm">
              <thead className="bg-gray-200/90 text-gray-700">
                <tr>
                  <th className="w-[14%] px-3 py-2 text-left font-semibold">ID</th>
                  <th className="w-[24%] px-3 py-2 text-left font-semibold">Supplier Name</th>
                  <th className="w-[14%] px-3 py-2 text-left font-semibold">Total Requests</th>
                  <th className="w-[12%] px-3 py-2 text-left font-semibold">Completed</th>
                  <th className="w-[12%] px-3 py-2 text-left font-semibold">Cancelled</th>
                  <th className="w-[14%] px-3 py-2 text-left font-semibold">Status</th>
                  <th className="w-[10%] px-3 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-t border-gray-200 hover:bg-gray-200/40">
                    <td className="px-3 py-2 font-semibold text-gray-800">{supplier.id}</td>
                    <td className="px-3 py-2 text-gray-800">{supplier.name}</td>
                    <td className="px-3 py-2 text-gray-700">{supplier.totalRequests}</td>
                    <td className="px-3 py-2 text-gray-700">{supplier.completed}</td>
                    <td className="px-3 py-2 text-gray-700">{supplier.cancelled}</td>
                    <td className="px-3 py-2 text-gray-800">{supplier.status}</td>
                    <td className="px-3 py-2">
                      <button
                        className="font-semibold text-blue-600 hover:text-blue-700"
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          setModal('view');
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {displayedSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-5 text-center text-sm text-gray-500">
                      No suppliers match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {modal === 'add' && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setModal('none')}>
          <form
            className="w-full max-w-[460px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddSupplierSubmit}
          >
            <div className="mb-3 flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700">
                <Building2 size={16} />
                Add Supplier
              </h2>
              <button type="button" onClick={() => setModal('none')} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600">
                <X size={14} />
              </button>
            </div>

            <div className="mb-4 flex justify-center">
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gray-300 text-blue-600">
                <ImagePlus size={32} />
              </div>
            </div>

            <div className="mb-3 border-b border-gray-300" />

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <label className="text-sm text-gray-700">
                <span className="mb-1 inline-flex items-center gap-1"><Building2 size={14} /> Supplier Name</span>
                Supplier Name
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier((prev) => ({ ...prev, name: e.target.value }))}
                />
                {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 inline-flex items-center gap-1"><BadgeCheck size={14} /> Status</span>
                <select
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newSupplier.status}
                  onChange={(e) => setNewSupplier((prev) => ({ ...prev, status: e.target.value as SupplierStatus | '' }))}
                >
                  <option value="">Select status</option>
                  <option value="Preferred">Preferred</option>
                  <option value="Active">Active</option>
                  <option value="Review">Review</option>
                </select>
                {formErrors.status && <p className="mt-1 text-xs text-red-500">{formErrors.status}</p>}
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 inline-flex items-center gap-1"><Phone size={14} /> Contact Number</span>
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newSupplier.contact}
                  onChange={(e) => setNewSupplier((prev) => ({ ...prev, contact: e.target.value }))}
                />
                {formErrors.contact && <p className="mt-1 text-xs text-red-500">{formErrors.contact}</p>}
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 inline-flex items-center gap-1"><Mail size={14} /> Email Address</span>
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newSupplier.email}
                  onChange={(e) => setNewSupplier((prev) => ({ ...prev, email: e.target.value }))}
                />
                {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>}
              </label>
              <label className="text-sm text-gray-700 md:col-span-2">
                <span className="mb-1 inline-flex items-center gap-1"><MapPin size={14} /> Address</span>
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier((prev) => ({ ...prev, address: e.target.value }))}
                />
                {formErrors.address && <p className="mt-1 text-xs text-red-500">{formErrors.address}</p>}
              </label>
            </div>

            <div className="mt-4">
              <button type="submit" className="h-9 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white">
                Save Supplier
              </button>
            </div>
          </form>
        </div>
      )}

      {modal === 'confirm' && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setModal('none')}>
          <div className="w-full max-w-[460px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700">
                <Building2 size={16} />
                Confirm Supplier Information
              </h2>
              <button type="button" onClick={() => setModal('none')} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600">
                <X size={14} />
              </button>
            </div>

            <div className="mb-3 flex justify-center">
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gray-200 text-blue-600">
                <Building2 size={40} />
              </div>
            </div>

            <div className="rounded-xl bg-gray-200/70 p-4 text-sm">
              <p><span className="text-gray-500">Supplier Name</span><br /><span className="font-semibold text-gray-800">{newSupplier.name}</span></p>
              <p className="mt-2"><span className="text-gray-500">Status</span><br /><span className="font-semibold text-gray-800">{newSupplier.status}</span></p>
              <p className="mt-2"><span className="text-gray-500">Contact Number</span><br /><span className="font-semibold text-gray-800">{newSupplier.contact}</span></p>
              <p className="mt-2"><span className="text-gray-500">Email Address</span><br /><span className="font-semibold text-gray-800">{newSupplier.email}</span></p>
              <p className="mt-2"><span className="text-gray-500">Address</span><br /><span className="font-semibold text-gray-800">{newSupplier.address}</span></p>

              <label className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
                Yes, I confirm that the details here are correct.
              </label>
            </div>

            <button
              type="button"
              onClick={handleConfirmSupplier}
              className="mt-4 h-9 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!confirmChecked}
            >
              Confirm and Save Supplier
            </button>
          </div>
        </div>
      )}

      {modal === 'success' && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setModal('none')}>
          <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" strokeWidth={2} />
            <h3 className="mt-2 text-4xl font-bold text-gray-800">Added Successfully!</h3>
            <p className="mt-2 text-sm text-gray-600">Supplier record has been successfully added.</p>
            <button type="button" onClick={() => setModal('none')} className="mt-5 h-9 w-28 rounded-lg bg-blue-600 text-sm font-semibold text-white">
              Done
            </button>
          </div>
        </div>
      )}

      {modal === 'view' && selectedSupplier && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setModal('none')}>
          <div className="w-full max-w-[760px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between border-b border-gray-300 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-gray-200" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{selectedSupplier.name}</h3>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-600">{selectedSupplier.status}</span>
                </div>
              </div>
              <button type="button" onClick={() => setModal('none')} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600">
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 text-sm">
              <div><p className="text-gray-500">Total Requests</p><p className="font-semibold text-gray-800">{selectedSupplier.totalRequests}</p></div>
              <div><p className="text-gray-500">Completed</p><p className="font-semibold text-gray-800">{selectedSupplier.completed}</p></div>
              <div><p className="text-gray-500">Cancelled</p><p className="font-semibold text-gray-800">{selectedSupplier.cancelled}</p></div>
              <div><p className="text-gray-500">Pending</p><p className="font-semibold text-gray-800">{Math.max(0, selectedSupplier.totalRequests - selectedSupplier.completed - selectedSupplier.cancelled)}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
