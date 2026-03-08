import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, X, Pencil, Pill, Search } from 'lucide-react';
import Pagination from '../../components/ui/Pagination.tsx';
import { createRestockRequest, loadRestockRequests } from './restockRequestsStore.ts';

type Severity = 'critical' | 'warning';
type InventoryStatus = 'Adequate' | 'Low' | 'Critical';

type InventoryAlert = {
  id: string;
  name: string;
  category: string;
  lowStock: number;
  expiry: string;
  suggestedRestock: number;
  unit: string;
  severity: Severity;
};

const ALERTS_PAGE_SIZE = 6;
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type InventoryRow = {
  id: string;
  name: string;
  category: string;
  batch: string;
  stock: number;
  unit: string;
  status: InventoryStatus;
  expiry: string;
  reorder: number;
  supplierId: number | null;
  supplier: string;
  form: string;
  strength: string;
  lastUpdated: string;
};

type MedicationStockApiItem = {
  medication_id: number;
  medication_name: string;
  category_name: string;
  form: string;
  strength: string | null;
  unit: string;
  reorder_threshold: number;
  total_stock: number;
  status: InventoryStatus;
  last_updated: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
};

const severityColors = {
  critical: 'border-red-300 bg-red-50',
  warning: 'border-amber-300 bg-amber-50',
};

export default function InventoryAlerts() {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null);
  const [restockTarget, setRestockTarget] = useState<InventoryAlert | null>(null);
  const [restockDetails, setRestockDetails] = useState({
    supplier: '',
    quantity: '',
    neededBy: '',
    notes: '',
  });
  const [restockErrors, setRestockErrors] = useState({
    supplier: '',
    quantity: '',
    neededBy: '',
  });
  const [createdRequestIds, setCreatedRequestIds] = useState<Record<string, true>>({});
  const [isRestockSuccessOpen, setIsRestockSuccessOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError('');

    async function loadMedicationStocks() {
      try {
        const response = await fetch(`${API_BASE_URL}/medications`);
        if (!response.ok) {
          throw new Error('Failed to load medications.');
        }
        const data = (await response.json()) as { items: MedicationStockApiItem[] };
        if (!isMounted) return;

        const normalized: InventoryRow[] = (data.items || []).map((entry) => ({
          id: `I-${String(entry.medication_id).padStart(3, '0')}`,
          name: entry.medication_name,
          category: entry.category_name,
          batch: entry.batch_number || 'N/A',
          stock: entry.total_stock ?? 0,
          unit: entry.unit,
          status: entry.status,
          expiry: entry.expiry_date || 'N/A',
          reorder: entry.reorder_threshold,
          supplierId: entry.supplier_id ?? null,
          supplier: entry.supplier_name || 'N/A',
          form: entry.form || '',
          strength: entry.strength || '',
          lastUpdated: entry.last_updated || 'N/A',
        }));
        setItems(normalized);
      } catch (error) {
        if (!isMounted) return;
        setItems([]);
        setLoadError(error instanceof Error ? error.message : 'Failed to load medications.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadMedicationStocks();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadExistingRequestFlags() {
      try {
        const existingPendingByMedication = (await loadRestockRequests()).reduce<Record<string, true>>((acc, request) => {
          if (request.status === 'Pending') {
            acc[request.medicationId] = true;
          }
          return acc;
        }, {});
        if (isMounted) setCreatedRequestIds(existingPendingByMedication);
      } catch {
        if (isMounted) setCreatedRequestIds({});
      }
    }

    loadExistingRequestFlags();
    return () => {
      isMounted = false;
    };
  }, []);

  const alerts = useMemo<InventoryAlert[]>(() => {
    return items
      .filter((item) => item.stock < item.reorder || item.status === 'Critical')
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        lowStock: item.stock,
        expiry: item.expiry,
        suggestedRestock: Math.max(item.reorder - item.stock, item.reorder),
        unit: item.unit,
        severity: item.stock <= 0 || item.status === 'Critical' ? 'critical' : 'warning',
      }));
  }, [items]);

  const filteredAlerts = useMemo(() => {
    const severityRank: Record<Severity, number> = {
      critical: 0,
      warning: 1,
    };

    return alerts
      .filter((alert) => {
        return (
          alert.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          (severityFilter === '' || alert.severity === severityFilter) &&
          (categoryFilter === '' || alert.category.toLowerCase().includes(categoryFilter.toLowerCase()))
        );
      })
      .sort((a, b) => {
        const severityDiff = severityRank[a.severity] - severityRank[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return a.lowStock - b.lowStock;
      });
  }, [searchTerm, severityFilter, categoryFilter, alerts]);

  const criticalAlerts = useMemo(() => alerts.filter((alert) => alert.severity === 'critical'), [alerts]);
  const warningAlerts = useMemo(() => alerts.filter((alert) => alert.severity === 'warning'), [alerts]);

  const alertCategoryOptions = useMemo(() => {
    const categories = Array.from(new Set(alerts.map((alert) => alert.category)));
    categories.sort((a, b) => a.localeCompare(b));
    return categories;
  }, [alerts]);

  const topCriticalCategories = useMemo(() => {
    const counts = criticalAlerts.reduce<Record<string, number>>((acc, alert) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([category]) => category);
  }, [criticalAlerts]);

  const topWarningCategories = useMemo(() => {
    const counts = warningAlerts.reduce<Record<string, number>>((acc, alert) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);
  }, [warningAlerts]);

  const mostAffectedCategory = useMemo(() => {
    if (alerts.length === 0) return 'None';
    const counts = alerts.reduce<Record<string, number>>((acc, alert) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }, [alerts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, severityFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / ALERTS_PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedAlerts = filteredAlerts.slice((currentPage - 1) * ALERTS_PAGE_SIZE, currentPage * ALERTS_PAGE_SIZE);

  function openCreateRestockRequest(alert: InventoryAlert) {
    setRestockTarget(alert);
    setRestockDetails({
      supplier: getMedicationMetaFromAlert(alert).supplier,
      quantity: String(alert.suggestedRestock),
      neededBy: '2026-03-01',
      notes: '',
    });
    setRestockErrors({
      supplier: '',
      quantity: '',
      neededBy: '',
    });
  }

  function closeCreateRestockRequest() {
    setRestockTarget(null);
    setRestockErrors({
      supplier: '',
      quantity: '',
      neededBy: '',
    });
  }

  function getMedicationMetaFromAlert(alert: InventoryAlert) {
    const matchedItem = items.find((item) => item.id === alert.id);
    if (!matchedItem) {
      return {
        batch: 'N/A',
        category: alert.category,
        supplier: 'N/A',
        suggestedRestock: `${alert.suggestedRestock} ${alert.unit}`,
      };
    }
    return {
      batch: matchedItem.batch,
      category: matchedItem.category,
      supplier: matchedItem.supplier,
      suggestedRestock: `${alert.suggestedRestock} ${alert.unit}`,
    };
  }

  async function confirmRestockRequest() {
    if (!restockTarget) return;

    const nextErrors = {
      supplier: restockDetails.supplier.trim() ? '' : 'Supplier is required.',
      quantity: Number(restockDetails.quantity) > 0 ? '' : 'Quantity must be greater than 0.',
      neededBy: restockDetails.neededBy ? '' : 'Needed-by date is required.',
    };
    setRestockErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const matchedItem = items.find((item) => item.id === restockTarget.id);
    if (!matchedItem?.supplierId) {
      setRestockErrors((prev) => ({ ...prev, supplier: 'No linked supplier found for this medication.' }));
      return;
    }
    const threshold = matchedItem ? matchedItem.reorder : restockTarget.suggestedRestock;

    try {
      await createRestockRequest({
      medicationId: Number(restockTarget.id.replace('I-', '')),
      supplierId: matchedItem.supplierId,
      medication: restockTarget.name,
      category: restockTarget.category,
      severity: restockTarget.severity === 'critical' ? 'Critical' : 'Warning',
      suggestedQuantity: restockTarget.suggestedRestock,
      quantity: Number(restockDetails.quantity),
      unit: restockTarget.unit,
      currentStock: restockTarget.lowStock,
      threshold,
      neededBy: restockDetails.neededBy,
      notes: restockDetails.notes,
    });

      setCreatedRequestIds((prev) => ({ ...prev, [restockTarget.id]: true }));
      setRestockTarget(null);
      setIsRestockSuccessOpen(true);
    } catch (error) {
      setRestockErrors((prev) => ({
        ...prev,
        supplier: error instanceof Error ? error.message : 'Failed to create restock request.',
      }));
    }
  }

  function getMedicationMeta(item: InventoryRow) {
    return {
      batch: item.batch,
      category: item.category,
      supplier: item.supplier,
      suggestedRestock: `${item.reorder} ${item.unit}`,
      lastUpdated: item.lastUpdated,
    };
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Inventory | Inventory Alerts</h1>

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg text-gray-500 font-semibold">Critical Medications</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-red-500">{criticalAlerts.length} Medications</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Needs Immediate Restock</p>
            <p className="mt-3 text-sm text-gray-600">
              Categories: {topCriticalCategories.length > 0 ? topCriticalCategories.join(', ') : 'None'}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg text-gray-500 font-semibold">High-Risk Medications</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-amber-500">{warningAlerts.length} Medications</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Expiring Soon / Low Stock</p>
            <p className="mt-3 text-sm text-gray-600">
              Categories: {topWarningCategories.length > 0 ? topWarningCategories.join(', ') : 'None'}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg text-gray-500 font-semibold">Most Affected Category</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-blue-600">{mostAffectedCategory}</p>
            <p className="mt-2 text-base font-semibold text-gray-800">Critical &amp; High Risks: {alerts.length}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="w-full md:w-72 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search Medication"
                className="w-full h-10 pl-9 pr-4 border border-gray-300 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <select
                className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="">Severity</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">Category</option>
                {alertCategoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {isLoading && (
              <article className="rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 md:col-span-2 xl:col-span-3">
                Loading medication alerts...
              </article>
            )}
            {!isLoading && loadError && (
              <article className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 md:col-span-2 xl:col-span-3">
                {loadError}
              </article>
            )}
            {pagedAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl border p-4 ${severityColors[alert.severity as keyof typeof severityColors] || 'border-gray-300 bg-gray-50'}`}
              >
                <p className={`text-sm font-semibold ${alert.severity === 'critical' ? 'text-red-500' : 'text-amber-600'}`}>
                  {alert.name} - {alert.category}
                </p>
                <div className="mt-2 text-sm text-gray-800 leading-6">
                  <p>Stock: {alert.lowStock} {alert.unit}</p>
                  <p>Expiry: {alert.expiry}</p>
                  <p>Suggested Restock: {alert.suggestedRestock} {alert.unit}</p>
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <button
                    className="text-blue-600 hover:text-blue-700"
                    onClick={() => {
                      const matchedItem = items.find((item) => item.id === alert.id);
                      if (matchedItem) setSelectedItem(matchedItem);
                    }}
                  >
                    View
                  </button>
                  <button
                    className={`${
                      createdRequestIds[alert.id]
                        ? 'cursor-not-allowed text-gray-400'
                        : 'text-blue-600 hover:text-blue-700'
                    }`}
                    onClick={() => openCreateRestockRequest(alert)}
                    disabled={Boolean(createdRequestIds[alert.id])}
                  >
                    {createdRequestIds[alert.id] ? 'Request Created' : 'Create Restock Request'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <p className="text-sm text-gray-600">Showing {pagedAlerts.length} out of {filteredAlerts.length}</p>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>
      </section>

      {selectedItem && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setSelectedItem(null)}>
          <div className="w-full max-w-[460px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-blue-600">
                <Pill size={18} />
                Medication Details
              </h2>
              <div className="flex items-center gap-1.5">
                <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600 hover:text-gray-700">
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => setSelectedItem(null)} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600 hover:text-gray-700">
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5 text-2.5 font-semibold text-gray-700">
              <p>Medication Name: <span className="font-bold text-gray-800">{selectedItem.name}</span></p>
              <p>Batch: <span className="font-bold text-gray-800">{getMedicationMeta(selectedItem).batch}</span></p>
              <div className="my-2 border-b border-gray-300" />
              <p>Category: <span className="font-bold text-gray-800">{getMedicationMeta(selectedItem).category}</span></p>
              <p>Stock: <span className="font-bold text-gray-800">{selectedItem.stock} {selectedItem.unit}</span></p>
              <p>Threshold: <span className="font-bold text-gray-800">{selectedItem.reorder} {selectedItem.unit}</span></p>
              <p>Expiry: <span className="font-bold text-gray-800">{selectedItem.expiry}</span></p>
              <p className="flex items-center gap-2">
                Status:
                <span
                  className={`inline-flex min-w-[64px] justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                    selectedItem.status === 'Critical'
                      ? 'bg-red-100 text-red-500'
                      : selectedItem.status === 'Low'
                        ? 'bg-amber-100 text-amber-500'
                        : 'bg-green-100 text-green-500'
                  }`}
                >
                  {selectedItem.status === 'Adequate' ? 'OK' : selectedItem.status}
                </span>
              </p>
              <p>Supplier: <span className="font-bold text-gray-800">{getMedicationMeta(selectedItem).supplier}</span></p>
              <p>Suggested Restock: <span className="font-bold text-gray-800">{getMedicationMeta(selectedItem).suggestedRestock}</span></p>
              <p>Last Updated: <span className="font-bold text-gray-800">{getMedicationMeta(selectedItem).lastUpdated}</span></p>
            </div>
          </div>
        </div>
      )}

      {restockTarget && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={closeCreateRestockRequest}>
          <div className="w-full max-w-[520px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="text-xl font-semibold text-gray-800">Create Restock Request</h2>
              <button type="button" onClick={closeCreateRestockRequest} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600 hover:text-gray-700">
                <X size={14} />
              </button>
            </div>

            <div className="rounded-xl bg-gray-200/60 p-3 text-sm text-gray-700">
              <p><span className="font-semibold text-gray-800">Medication:</span> {restockTarget.name}</p>
              <p><span className="font-semibold text-gray-800">Category:</span> {restockTarget.category}</p>
              <p><span className="font-semibold text-gray-800">Current Stock:</span> {restockTarget.lowStock} {restockTarget.unit}</p>
              <p><span className="font-semibold text-gray-800">Suggested Restock:</span> {restockTarget.suggestedRestock} {restockTarget.unit}</p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-700">
                Supplier
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={restockDetails.supplier}
                  onChange={(e) => setRestockDetails((prev) => ({ ...prev, supplier: e.target.value }))}
                />
                {restockErrors.supplier && <p className="mt-1 text-xs text-red-500">{restockErrors.supplier}</p>}
              </label>

              <label className="text-sm text-gray-700">
                Quantity ({restockTarget.unit})
                <input
                  type="number"
                  min={1}
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={restockDetails.quantity}
                  onChange={(e) => setRestockDetails((prev) => ({ ...prev, quantity: e.target.value }))}
                />
                {restockErrors.quantity && <p className="mt-1 text-xs text-red-500">{restockErrors.quantity}</p>}
              </label>

              <label className="text-sm text-gray-700 md:col-span-2">
                Needed By
                <input
                  type="date"
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={restockDetails.neededBy}
                  onChange={(e) => setRestockDetails((prev) => ({ ...prev, neededBy: e.target.value }))}
                />
                {restockErrors.neededBy && <p className="mt-1 text-xs text-red-500">{restockErrors.neededBy}</p>}
              </label>

              <label className="text-sm text-gray-700 md:col-span-2">
                Notes (Optional)
                <textarea
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
                  rows={3}
                  value={restockDetails.notes}
                  onChange={(e) => setRestockDetails((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add handling or urgency notes"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={confirmRestockRequest}
              className="mt-4 h-10 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Confirm Restock Request
            </button>
          </div>
        </div>
      )}

      {isRestockSuccessOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setIsRestockSuccessOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-gray-800">Restock Request Created</h3>
            <p className="mt-2 text-sm text-gray-600">The request was recorded and marked for supplier coordination.</p>
            <button type="button" onClick={() => setIsRestockSuccessOpen(false)} className="mt-5 h-9 w-28 rounded-lg bg-blue-600 text-sm font-semibold text-white">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
