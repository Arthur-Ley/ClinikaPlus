import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import Button from '../../components/ui/Button.tsx';
import Pagination from '../../components/ui/Pagination.tsx';
import { Plus, X, Search, ChevronDown, Boxes, AlertTriangle, PackageX, CheckCircle2, Pencil, Pill } from 'lucide-react';
import { emitGlobalSearchRefresh } from '../../context/globalSearchEvents.ts';
 

type InventoryStatus = 'Adequate' | 'Low' | 'Critical';

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
  supplier: string;
  form: string;
  strength: string;
  lastUpdated: string;
  lastUpdatedIso: string | null;
};
type CategoryOption = {
  category_id: number;
  category_name: string;
};
type SupplierOption = {
  supplier_id: number;
  supplier_name: string;
  status: string;
  is_preferred: boolean;
};
type CreateMedicationResponse = {
  medication: {
    medication_id: number;
    medication_name: string;
    category_id: number;
    form: string;
    strength: string | null;
    unit: string;
    reorder_threshold: number;
  };
  batch: {
    batch_id: number;
    batch_number: string;
    quantity: number;
    expiry_date: string;
    supplier_id: number;
  };
  inventory: {
    inventory_id: number;
    medication_id: number;
    total_stock: number;
    status: InventoryStatus;
    last_updated: string;
  };
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
  supplier_name: string | null;
};

const formOptions = ['Tablet', 'Capsule', 'Pen', 'Syrup', 'Inhaler', 'Vial'] as const;
const unitOptions = ['pcs', 'pens', 'vials', 'bottles', 'inhalers', 'sachets'] as const;
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const DEFAULT_PAGE_SIZE = 5;

function normalizeStatus(value: string): InventoryStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'low') return 'Low';
  return 'Adequate';
}

function formatDateDisplay(value: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function matchesMonthFilter(lastUpdatedIso: string | null, filterMonth: string) {
  if (filterMonth === 'This Month' || filterMonth === 'Last Month' || filterMonth === 'Last 3 Months' || filterMonth === 'This Year') {
    if (!lastUpdatedIso) return false;
    const updatedAt = new Date(lastUpdatedIso);
    if (Number.isNaN(updatedAt.getTime())) return false;
    const now = new Date();
    const currentYearStart = new Date(now.getFullYear(), 0, 1);
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const threeMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    if (filterMonth === 'This Year') {
      return updatedAt >= currentYearStart && updatedAt < nextYearStart;
    }
    if (filterMonth === 'This Month') {
      return updatedAt >= currentMonthStart && updatedAt < nextMonthStart;
    }
    if (filterMonth === 'Last Month') {
      return updatedAt >= lastMonthStart && updatedAt < currentMonthStart;
    }
    return updatedAt >= threeMonthsAgoStart && updatedAt < nextMonthStart;
  }

  return true;
}

function statusSortRank(status: InventoryStatus) {
  if (status === 'Critical') return 0;
  if (status === 'Low') return 1;
  return 2;
}

function expirySortRank(expiry: string) {
  if (!expiry || expiry === 'N/A') return Number.POSITIVE_INFINITY;
  const parsed = new Date(expiry);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return parsed.getTime();
}

function CurrentStocksSkeleton() {
  return (
    <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5 animate-pulse">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <article key={item} className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <div className="h-5 w-36 rounded bg-gray-300" />
              <div className="h-6 w-6 rounded-full bg-gray-300" />
            </div>
            <div className="mt-3 h-10 w-32 rounded bg-gray-300" />
            <div className="mt-2 h-4 w-40 rounded bg-gray-300" />
            <div className="mt-2 h-3 w-48 rounded bg-gray-300" />
          </article>
        ))}
      </div>
      <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="h-10 w-full rounded-lg bg-gray-300 md:w-72" />
          <div className="flex gap-2">
            <div className="h-10 w-32 rounded-lg bg-gray-300" />
            <div className="h-10 w-32 rounded-lg bg-gray-300" />
            <div className="h-10 w-32 rounded-lg bg-gray-300" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl">
          <div className="space-y-2">
            <div className="h-9 w-full rounded bg-gray-300" />
            <div className="h-9 w-full rounded bg-gray-300" />
            <div className="h-9 w-full rounded bg-gray-300" />
            <div className="h-9 w-full rounded bg-gray-300" />
            <div className="h-9 w-full rounded bg-gray-300" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function CurrentStocks() {
  const location = useLocation();
  const handledFocusIdRef = useRef('');
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null);
  const [filterCategory, setFilterCategory] = useState('All Categories');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [filterMonth, setFilterMonth] = useState('This Year');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddMedicationOpen, setIsAddMedicationOpen] = useState(false);
  const [isAddedSuccessOpen, setIsAddedSuccessOpen] = useState(false);
  const [isEditingMedication, setIsEditingMedication] = useState(false);
  const [isSavingMedicationEdit, setIsSavingMedicationEdit] = useState(false);
  const [medicationEditError, setMedicationEditError] = useState('');
  const [medicationDraft, setMedicationDraft] = useState({
    name: '',
    category: '',
    form: '',
    strength: '',
    stock: '',
    reorder: '',
    supplier: '',
  });
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);
  const [stocksError, setStocksError] = useState('');
  const [isSubmittingMedication, setIsSubmittingMedication] = useState(false);
  const [formError, setFormError] = useState('');
  const [categoryDropdown, setCategoryDropdown] = useState<CategoryOption[]>([]);
  const [supplierDropdown, setSupplierDropdown] = useState<SupplierOption[]>([]);
  const [newMedication, setNewMedication] = useState({
    name: '',
    categoryId: '',
    form: 'Tablet',
    strength: '',
    unit: 'pcs',
    quantity: '',
    batch: '',
    reorder: '',
    expiry: '',
    supplierId: '',
  });

  const loadMedicationStocks = useCallback(async () => {
    setIsLoadingStocks(true);
    setStocksError('');

    try {
      const response = await fetch(`${API_BASE_URL}/medications`);
      if (!response.ok) {
        throw new Error('Failed to load medications from database.');
      }

      const data = (await response.json()) as { items: MedicationStockApiItem[] };
      const normalized: InventoryRow[] = (data.items || []).map((entry) => ({
        id: `I-${String(entry.medication_id).padStart(3, '0')}`,
        name: entry.medication_name,
        category: entry.category_name,
        batch: entry.batch_number || 'N/A',
        stock: entry.total_stock ?? 0,
        unit: entry.unit,
        status: normalizeStatus(entry.status),
        expiry: entry.expiry_date || 'N/A',
        reorder: entry.reorder_threshold,
        supplier: entry.supplier_name || 'N/A',
        form: entry.form || '',
        strength: entry.strength || '',
        lastUpdated: formatDateDisplay(entry.last_updated),
        lastUpdatedIso: entry.last_updated,
      }));

      setItems(normalized);
      setSelectedItem((prev) => {
        if (!prev) return prev;
        return normalized.find((row) => row.id === prev.id) || null;
      });
    } catch (error) {
      setStocksError(error instanceof Error ? error.message : 'Failed to load medications.');
      setItems([]);
    } finally {
      setIsLoadingStocks(false);
    }
  }, []);

  useEffect(() => {
    void loadMedicationStocks();
  }, [loadMedicationStocks]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'All Status' || item.status === filterStatus;
        const matchesCategory = filterCategory === 'All Categories' || item.category === filterCategory;
        const matchesMonth = matchesMonthFilter(item.lastUpdatedIso, filterMonth);
        return matchesSearch && matchesStatus && matchesCategory && matchesMonth;
      })
      .sort((a, b) => {
        const statusRankDiff = statusSortRank(a.status) - statusSortRank(b.status);
        if (statusRankDiff !== 0) return statusRankDiff;
        const expiryRankDiff = expirySortRank(a.expiry) - expirySortRank(b.expiry);
        if (expiryRankDiff !== 0) return expiryRankDiff;
        return a.name.localeCompare(b.name);
      });
  }, [searchTerm, filterStatus, filterCategory, filterMonth, items]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterCategory, filterMonth]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / DEFAULT_PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!isAddMedicationOpen) return;

    let isMounted = true;
    setFormError('');

    async function loadDropdowns() {
      try {
        const [categoryRes, supplierRes] = await Promise.all([
          fetch(`${API_BASE_URL}/medications/categories`),
          fetch(`${API_BASE_URL}/medications/suppliers`),
        ]);

        if (!categoryRes.ok || !supplierRes.ok) {
          throw new Error('Failed to load category/supplier data.');
        }

        const categoryJson = (await categoryRes.json()) as { categories: CategoryOption[] };
        const supplierJson = (await supplierRes.json()) as { suppliers: SupplierOption[] };

        if (!isMounted) return;

        setCategoryDropdown(categoryJson.categories || []);
        setSupplierDropdown(supplierJson.suppliers || []);
        setNewMedication((prev) => ({
          ...prev,
          categoryId: prev.categoryId || String(categoryJson.categories?.[0]?.category_id || ''),
          supplierId: prev.supplierId || String(supplierJson.suppliers?.[0]?.supplier_id || ''),
        }));
      } catch (error) {
        if (!isMounted) return;
        setFormError(error instanceof Error ? error.message : 'Failed to load form options.');
      }
    }

    loadDropdowns();

    return () => {
      isMounted = false;
    };
  }, [isAddMedicationOpen]);

  const startIndex = (currentPage - 1) * DEFAULT_PAGE_SIZE;
  const pagedItems = filteredItems.slice(startIndex, startIndex + DEFAULT_PAGE_SIZE);
  const belowThresholdItems = useMemo(() => items.filter((item) => item.stock < item.reorder), [items]);
  const criticalItemsCount = useMemo(() => items.filter((item) => item.status === 'Critical').length, [items]);
  const outOfStockCount = useMemo(() => items.filter((item) => item.stock <= 0).length, [items]);

  const mostAffectedCategory = useMemo(() => {
    if (belowThresholdItems.length === 0) return 'None';
    const counts = belowThresholdItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }, [belowThresholdItems]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(items.map((item) => item.category)));
    categories.sort((a, b) => a.localeCompare(b));
    return categories;
  }, [items]);

  const showInitialSkeleton = isLoadingStocks && items.length === 0 && !stocksError;

  const focusMedicationId = useMemo(() => new URLSearchParams(location.search).get('focusMedicationId') || '', [location.search]);
  const openMedicationId = useMemo(() => new URLSearchParams(location.search).get('openMedicationId') || '', [location.search]);

  useEffect(() => {
    if (!focusMedicationId || !items.length) return;
    if (handledFocusIdRef.current === focusMedicationId) return;

    const target = items.find((item) => item.id === focusMedicationId);
    if (!target) return;

    setFilterCategory('All Categories');
    setFilterStatus('All Status');
    setSearchTerm(target.name);
  }, [focusMedicationId, items]);

  useEffect(() => {
    if (!focusMedicationId || !filteredItems.length) return;
    if (handledFocusIdRef.current === focusMedicationId) return;

    const targetIndex = filteredItems.findIndex((item) => item.id === focusMedicationId);
    if (targetIndex < 0) return;

    const targetPage = Math.floor(targetIndex / DEFAULT_PAGE_SIZE) + 1;
    setCurrentPage(targetPage);

    setTimeout(() => {
      const selector = `[data-search-medication-id="${focusMedicationId}"]`;
      const node = document.querySelector(selector);
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        handledFocusIdRef.current = focusMedicationId;
      }
    }, 120);
  }, [focusMedicationId, filteredItems]);

  useEffect(() => {
    if (!openMedicationId || !items.length) return;
    const target = items.find((item) => item.id === openMedicationId);
    if (!target) return;
    setSelectedItem(target);
  }, [openMedicationId, items]);

  async function handleAddMedicationSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmittingMedication(true);
    setFormError('');

    try {
      const payload = {
        medication_name: newMedication.name,
        category_id: Number(newMedication.categoryId),
        form: newMedication.form,
        strength: newMedication.strength,
        unit: newMedication.unit,
        reorder_threshold: Number(newMedication.reorder),
        batch_number: newMedication.batch,
        quantity: Number(newMedication.quantity),
        expiry_date: newMedication.expiry,
        supplier_id: Number(newMedication.supplierId),
      };

      const response = await fetch(`${API_BASE_URL}/medications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as CreateMedicationResponse | { error: string };
      if (!response.ok) {
        throw new Error('error' in json ? json.error : 'Failed to create medication.');
      }

      setIsAddMedicationOpen(false);
      setIsAddedSuccessOpen(true);
      setNewMedication({
        name: '',
        categoryId: categoryDropdown[0] ? String(categoryDropdown[0].category_id) : '',
        form: 'Tablet',
        strength: '',
        unit: 'pcs',
        quantity: '',
        batch: '',
        reorder: '',
        expiry: '',
        supplierId: supplierDropdown[0] ? String(supplierDropdown[0].supplier_id) : '',
      });
      await loadMedicationStocks();
      emitGlobalSearchRefresh();
      setCurrentPage(1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create medication.');
    } finally {
      setIsSubmittingMedication(false);
    }
  }

  function getMedicationMeta(item: InventoryRow) {
    return {
      batch: item.batch,
      category: item.category,
      supplier: item.supplier,
      form: item.form,
      strength: item.strength,
      suggestedRestock: `${item.reorder} ${item.unit}`,
      lastUpdated: item.lastUpdated,
    };
  }

  function openMedicationDetails(item: InventoryRow) {
    setSelectedItem(item);
    setIsEditingMedication(false);
    setMedicationDraft({
      name: item.name,
      category: item.category,
      form: item.form || '',
      strength: item.strength || '',
      stock: String(item.stock),
      reorder: String(item.reorder),
      supplier: item.supplier,
    });
  }

  function startEditingMedication() {
    if (!selectedItem) return;
    setMedicationEditError('');
    setMedicationDraft({
      name: selectedItem.name,
      category: selectedItem.category,
      form: selectedItem.form || '',
      strength: selectedItem.strength || '',
      stock: String(selectedItem.stock),
      reorder: String(selectedItem.reorder),
      supplier: selectedItem.supplier,
    });
    setIsEditingMedication(true);
  }

  function cancelEditingMedication() {
    setMedicationEditError('');
    setIsEditingMedication(false);
  }

  async function saveMedicationDraft() {
    if (!selectedItem) return;

    const nextStock = Number(medicationDraft.stock);
    const nextReorder = Number(medicationDraft.reorder);
    if (!medicationDraft.name.trim() || !medicationDraft.category.trim() || !medicationDraft.supplier.trim()) return;
    if (!Number.isFinite(nextStock) || !Number.isFinite(nextReorder) || nextStock < 0 || nextReorder < 0) return;

    const medicationId = Number(selectedItem.id.replace('I-', ''));
    if (!Number.isInteger(medicationId) || medicationId <= 0) return;

    setIsSavingMedicationEdit(true);
    setMedicationEditError('');
    try {
      const response = await fetch(`${API_BASE_URL}/medications/${medicationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          medication_name: medicationDraft.name.trim(),
          category_name: medicationDraft.category.trim(),
          form: medicationDraft.form.trim(),
          strength: medicationDraft.strength.trim(),
          total_stock: nextStock,
          reorder_threshold: nextReorder,
          supplier_name: medicationDraft.supplier.trim(),
        }),
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(json?.error || 'Failed to update medication.');
      }

      await loadMedicationStocks();
      emitGlobalSearchRefresh();
      setIsEditingMedication(false);
    } catch (error) {
      setMedicationEditError(error instanceof Error ? error.message : 'Failed to update medication.');
    } finally {
      setIsSavingMedicationEdit(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">Inventory | Current Stocks</h1>
      </div>

      {showInitialSkeleton && <CurrentStocksSkeleton />}

      {!showInitialSkeleton && (

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Inventory Health</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/90 text-white">
                <Boxes className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-blue-600">{items.length} Products</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Tracked in active inventory</p>
            <p className="mt-2 text-sm text-gray-700">Below Threshold: {belowThresholdItems.length} | Out of Stock: {outOfStockCount}</p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Critical Items</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/90 text-white">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-amber-500">{criticalItemsCount} Medications</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Below reorder threshold</p>
            <p className="mt-2 text-sm text-gray-700">Most Affected: {mostAffectedCategory}</p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Out of Stock</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-white">
                <PackageX className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-red-500">{outOfStockCount} Medications</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Unavailable for dispensing</p>
            <p className="mt-2 text-sm text-gray-700">{outOfStockCount > 0 ? 'Immediate restock required' : 'No stock-out items currently'}</p>
          </article>
        </div>

        <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-5">
            <div className="flex w-full md:w-auto items-center gap-2">
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
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap bg-green-600 pl-3 pr-4 py-1.5 text-sm text-white hover:bg-green-700"
                onClick={() => {
                  setFormError('');
                  setIsAddMedicationOpen(true);
                }}
              >
                <Plus size={16} className="shrink-0" />
                Add Medication
              </Button>

              <div className="relative">
                <select
                  className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option>All Categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option>All Status</option>
                  <option>Adequate</option>
                  <option>Low</option>
                  <option>Critical</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                >
                  <option>This Year</option>
                  <option>This Month</option>
                  <option>Last Month</option>
                  <option>Last 3 Months</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl">
            <table className="w-full table-fixed text-xs md:text-sm">
              <thead className="bg-gray-200/90 text-gray-700">
                <tr>
                  <th className="w-[7%] px-2 py-1.5 text-left font-semibold">#</th>
                  <th className="w-[18%] px-2 py-1.5 text-left font-semibold">Medication Name</th>
                  <th className="w-[14%] px-2 py-1.5 text-left font-semibold">Category</th>
                  <th className="w-[13%] px-2 py-1.5 text-left font-semibold">Batch</th>
                  <th className="w-[12%] px-2 py-1.5 text-left font-semibold">Stock</th>
                  <th className="w-[12%] px-2 py-1.5 text-left font-semibold">Threshold</th>
                  <th className="w-[12%] px-2 py-1.5 text-left font-semibold">Expiry Date</th>
                  <th className="w-[7%] px-2 py-1.5 text-left font-semibold">Status</th>
                  <th className="w-[5%] px-2 py-1.5 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingStocks && Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`stocks-skeleton-${index}`} className="border-t border-gray-200">
                    <td colSpan={9} className="px-2 py-1.5">
                      <div className="h-8 w-full animate-pulse rounded bg-gray-200" />
                    </td>
                  </tr>
                ))}
                {!isLoadingStocks && stocksError && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-sm text-red-600">
                      {stocksError}
                    </td>
                  </tr>
                )}
                {!isLoadingStocks && !stocksError && pagedItems.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-600">
                      No medication records found in the database.
                    </td>
                  </tr>
                )}
                {!isLoadingStocks && !stocksError && pagedItems.map((item, idx) => (
                  <tr key={item.id} data-search-medication-id={item.id} className="border-t border-gray-200 hover:bg-gray-200/40">
                    <td className="px-2 py-1.5 font-semibold text-gray-800">#{String(startIndex + idx + 1).padStart(3, '0')}</td>
                    <td className="px-2 py-1.5 text-gray-800 truncate" title={item.name}>{item.name}</td>
                    <td className="px-2 py-1.5 text-gray-700 truncate" title={item.category}>{item.category}</td>
                    <td className="px-2 py-1.5 text-gray-700 truncate" title={item.batch}>{item.batch}</td>
                    <td className="px-2 py-1.5 font-semibold text-gray-800 truncate">{item.stock} {item.unit}</td>
                    <td className="px-2 py-1.5 text-gray-700 truncate">{item.reorder} {item.unit}</td>
                    <td className="px-2 py-1.5 text-gray-800">{item.expiry}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'Critical'
                            ? 'bg-red-100 text-red-700'
                            : item.status === 'Low'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => openMedicationDetails(item)} className="text-blue-600 hover:text-blue-700 font-semibold">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-gray-600">
            <p>
              Showing <span className="rounded-md bg-gray-300 px-2">{pagedItems.length}</span> out of {filteredItems.length}
            </p>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>
      </section>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => {
          setSelectedItem(null);
          setIsEditingMedication(false);
        }}>
          <div className="w-full max-w-[460px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-blue-600">
                <Pill size={18} />
                Medication Details
              </h2>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={startEditingMedication} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600 hover:text-gray-700">
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => {
                  if (isSavingMedicationEdit) return;
                  setSelectedItem(null);
                  setIsEditingMedication(false);
                }} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600 hover:text-gray-700">
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5 text-2.5 font-semibold text-gray-700">
              <p>
                Medication Name:{' '}
                {isEditingMedication ? (
                  <input
                    className="h-8 rounded-md border border-gray-300 bg-transparent px-2 text-2.5 font-semibold text-gray-800"
                    value={medicationDraft.name}
                    onChange={(e) => setMedicationDraft((prev) => ({ ...prev, name: e.target.value }))}
                  />
                ) : (
                  <span className="font-semibold text-gray-800">{selectedItem.name}</span>
                )}
              </p>
              <p>Batch: <span className="font-semibold text-gray-800">{getMedicationMeta(selectedItem).batch}</span></p>
              <div className="my-2 border-b border-gray-300" />
              <p>
                Category:{' '}
                {isEditingMedication ? (
                  <input
                    className="h-8 rounded-md border border-gray-300 bg-transparent px-2 text-2.5 font-semibold text-gray-800"
                    value={medicationDraft.category}
                    onChange={(e) => setMedicationDraft((prev) => ({ ...prev, category: e.target.value }))}
                  />
                ) : (
                  <span className="font-semibold text-gray-800">{getMedicationMeta(selectedItem).category}</span>
                )}
              </p>
              <p>
                Form:{' '}
                {isEditingMedication ? (
                  <input
                    className="h-8 rounded-md border border-gray-300 bg-transparent px-2 text-2.5 font-semibold text-gray-800"
                    value={medicationDraft.form}
                    onChange={(e) => setMedicationDraft((prev) => ({ ...prev, form: e.target.value }))}
                  />
                ) : (
                  <span className="font-semibold text-gray-800">{getMedicationMeta(selectedItem).form || 'N/A'}</span>
                )}
              </p>
              <p>
                Strength:{' '}
                {isEditingMedication ? (
                  <input
                    className="h-8 rounded-md border border-gray-300 bg-transparent px-2 text-2.5 font-semibold text-gray-800"
                    value={medicationDraft.strength}
                    onChange={(e) => setMedicationDraft((prev) => ({ ...prev, strength: e.target.value }))}
                  />
                ) : (
                  <span className="font-semibold text-gray-800">{getMedicationMeta(selectedItem).strength || 'N/A'}</span>
                )}
              </p>
              <p>
                Stock:{' '}
                {isEditingMedication ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      className="h-8 w-20 rounded-md border border-gray-300 bg-transparent px-2 text-2.5 font-semibold text-gray-800"
                      value={medicationDraft.stock}
                      onChange={(e) => setMedicationDraft((prev) => ({ ...prev, stock: e.target.value }))}
                    />
                    <span>{selectedItem.unit}</span>
                  </span>
                ) : (
                  <span className="font-semibold text-gray-800">{selectedItem.stock} {selectedItem.unit}</span>
                )}
              </p>
              <p>
                Threshold:{' '}
                {isEditingMedication ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      className="h-8 w-20 rounded-md border border-gray-300 bg-transparent px-2 text-2.5 font-semibold text-gray-800"
                      value={medicationDraft.reorder}
                      onChange={(e) => setMedicationDraft((prev) => ({ ...prev, reorder: e.target.value }))}
                    />
                    <span>{selectedItem.unit}</span>
                  </span>
                ) : (
                  <span className="font-semibold text-gray-800">{selectedItem.reorder} {selectedItem.unit}</span>
                )}
              </p>
              <p>Expiry: <span className="font-semibold text-gray-800">{selectedItem.expiry}</span></p>
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
                  {selectedItem.status}
                </span>
              </p>
              <p>
                Supplier:{' '}
                {isEditingMedication ? (
                  <input
                    className="h-8 rounded-md border border-gray-300 bg-transparent px-2 text-2.5 font-semibold text-gray-800"
                    value={medicationDraft.supplier}
                    onChange={(e) => setMedicationDraft((prev) => ({ ...prev, supplier: e.target.value }))}
                  />
                ) : (
                  <span className="font-semibold text-gray-800">{getMedicationMeta(selectedItem).supplier}</span>
                )}
              </p>
              <p>Suggested Restock: <span className="font-semibold text-gray-800">{getMedicationMeta(selectedItem).suggestedRestock}</span></p>
              <p>Last Updated: <span className="font-semibold text-gray-800">{getMedicationMeta(selectedItem).lastUpdated}</span></p>
            </div>
            {isEditingMedication && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 disabled:opacity-60" onClick={cancelEditingMedication} disabled={isSavingMedicationEdit}>
                  Cancel
                </button>
                <button type="button" className="h-9 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60" onClick={saveMedicationDraft} disabled={isSavingMedicationEdit}>
                  {isSavingMedicationEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
            {isEditingMedication && medicationEditError && (
              <p className="mt-2 text-sm text-red-600">{medicationEditError}</p>
            )}
          </div>
        </div>
      )}

      {isAddMedicationOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setIsAddMedicationOpen(false)}>
          <form
            className="w-full max-w-[460px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddMedicationSubmit}
          >
            <div className="mb-4 flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700">
                <Pill size={16} />
                Add Medication
              </h2>
              <button type="button" onClick={() => setIsAddMedicationOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600 hover:text-gray-700">
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-700">
                Medication Name
                <input
                  required
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newMedication.name}
                  onChange={(e) => setNewMedication((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label className="text-sm text-gray-700">
                Category
                <select
                  required
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newMedication.categoryId}
                  onChange={(e) => setNewMedication((prev) => ({ ...prev, categoryId: e.target.value }))}
                >
                  <option value="">Select category</option>
                  {categoryDropdown.map((category) => (
                    <option key={category.category_id} value={String(category.category_id)}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                Form
                <select
                  required
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newMedication.form}
                  onChange={(e) => setNewMedication((prev) => ({ ...prev, form: e.target.value }))}
                >
                  {formOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                Strength
                <input
                  required
                  placeholder="e.g., 500mg or 100IU/mL"
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newMedication.strength}
                  onChange={(e) => setNewMedication((prev) => ({ ...prev, strength: e.target.value }))}
                />
              </label>
              <label className="text-sm text-gray-700">
                Unit
                <select
                  required
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newMedication.unit}
                  onChange={(e) => setNewMedication((prev) => ({ ...prev, unit: e.target.value }))}
                >
                  {unitOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                Reorder Threshold
                <input
                  type="number"
                  required
                  min={0}
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newMedication.reorder}
                  onChange={(e) => setNewMedication((prev) => ({ ...prev, reorder: e.target.value }))}
                />
              </label>
              <label className="text-sm text-gray-700">
                Batch Number
                <input
                  required
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newMedication.batch}
                  onChange={(e) => setNewMedication((prev) => ({ ...prev, batch: e.target.value }))}
                />
              </label>
              <label className="text-sm text-gray-700">
                Quantity
                <input
                  type="number"
                  required
                  min={1}
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newMedication.quantity}
                  onChange={(e) => setNewMedication((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </label>
              <label className="text-sm text-gray-700">
                Expiry Date
                <input
                  type="date"
                  required
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newMedication.expiry}
                  onChange={(e) => setNewMedication((prev) => ({ ...prev, expiry: e.target.value }))}
                />
              </label>
              <label className="text-sm text-gray-700 md:col-span-2">
                Supplier
                <select
                  required
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newMedication.supplierId}
                  onChange={(e) => setNewMedication((prev) => ({ ...prev, supplierId: e.target.value }))}
                >
                  <option value="">Select supplier</option>
                  {supplierDropdown.map((supplier) => (
                    <option key={supplier.supplier_id} value={String(supplier.supplier_id)}>
                      {supplier.supplier_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <button
              type="submit"
              className="mt-5 h-9 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isSubmittingMedication}
            >
              {isSubmittingMedication ? 'Saving...' : 'Add Medication'}
            </button>
          </form>
        </div>
      )}

      {isAddedSuccessOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setIsAddedSuccessOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" strokeWidth={2} />
            <h3 className="mt-2 text-4xl font-bold text-gray-800">Added Successfully!</h3>
            <p className="mt-2 text-sm text-gray-600">Medication record has been successfully added.</p>
            <button type="button" onClick={() => setIsAddedSuccessOpen(false)} className="mt-5 h-9 w-28 rounded-lg bg-blue-600 text-sm font-semibold text-white">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
