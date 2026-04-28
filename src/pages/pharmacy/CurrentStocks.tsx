import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Pill, CheckCircle, Plus, ChevronDown, CheckCircle2, Pencil, Layers, Package, Building2, RefreshCw, Trash2, CalendarDays } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { createRestockRequest, loadRestockRequests, RESTOCK_REQUESTS_CHANGED_EVENT } from './restockRequestsStore';
import { emitGlobalSearchRefresh } from '../../context/globalSearchEvents';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import SectionToolbar from '../../components/ui/SectionToolbar';

type Severity = 'critical' | 'warning';
type InventoryStatus = 'Adequate' | 'Low' | 'Critical';

interface InventoryAlert {
  id: string;
  name: string;
  category: string;
  lowStock: number;
  expiry: string;
  suggestedRestock: number;
  unit: string;
  severity: Severity;
  alertType: 'Stock Risk' | 'Expiration Risk';
  riskMode: 'Low Stock' | 'Near Expiry' | 'Out of Stock' | 'Expired';
  message: string;
}

interface InventoryRow {
  id: string;
  name: string;
  categoryId: number | null;
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
  storageRequirement: string;
  lastUpdated: string;
  lastUpdatedIso: string | null;
}

type CategoryOption = {
  category_id: number;
  category_name: string;
};
type SupplierOption = {
  supplier_id: number;
  supplier_name: string;
  status: string;
  is_preferred: boolean;
  contact_number?: string | null;
  email_address?: string | null;
  contactNumber?: string | null;
  emailAddress?: string | null;
};
type CreateMedicationResponse = {
  medication: {
    medication_id: number;
    medication_name: string;
    category_id: number;
    form: string;
    strength: string | null;
    storage_requirement: string | null;
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
type CreateCategoryResponse = {
  category: {
    category_id: number;
    category_name: string;
    description: string | null;
  };
};

// ─── API response types (replaces `any`) ────────────────────────────────────

type MedicationApiItem = {
  medication_id: number;
  category_id?: number | null;
  medication_name: string;
  category_name: string;
  batch_number: string | null;
  total_stock: number | null;
  unit: string;
  status: string;
  expiry_date: string | null;
  reorder_threshold: number;
  supplier_id: number | null;
  supplier_name: string | null;
  form: string | null;
  strength: string | null;
  storage_requirement: string | null;
  last_updated: string | null;
};

type AlertApiItem = {
  medication_key: string;
  medication_name: string;
  category_name: string;
  total_stock: number;
  expiry_date: string | null;
  reorder_threshold: number;
  unit: string;
  severity: string;
  alert_type?: 'Stock Risk' | 'Expiration Risk' | 'Expiry Risk' | null;
  risk_mode?: 'Low Stock' | 'Near Expiry' | 'Out of Stock' | 'Expired' | null;
  alert_message?: string | null;
};

type SaveMedicationPayload = {
  medication_name: string;
  category_id: number;
  category_name: string;
  form: string;
  strength: string;
  storage_requirement: string;
  total_stock: number;
  reorder_threshold: number;
  supplier_id: number;
  supplier_name: string;
};

type ToastState = { type: 'success' | 'error'; message: string } | null;
type NewMedicationForm = {
  name: string;
  categoryId: string;
  form: string;
  strength: string;
  storageRequirement: string;
  unit: string;
  quantity: string;
  batch: string;
  reorder: string;
  expiry: string;
  supplierId: string;
};
type AddMedicationFieldErrors = Partial<Record<keyof NewMedicationForm, string>>;
type NewCategoryForm = {
  categoryName: string;
  description: string;
};
type AddCategoryFieldErrors = Partial<Record<keyof NewCategoryForm, string>>;

// ─── Constants ───────────────────────────────────────────────────────────────

const ALERTS_PAGE_SIZE = 6;
const DEFAULT_PAGE_SIZE = 12;
const MIN_STOCKS_PAGE_SIZE = 12;
const MAX_STOCKS_PAGE_SIZE = 12;
const ESTIMATED_TABLE_HEADER_HEIGHT = 38;
const ESTIMATED_TABLE_ROW_HEIGHT = 38;
const TABLE_FOOTER_RESERVED_HEIGHT = 92;
const TABLE_VIEWPORT_BOTTOM_GUTTER = 24;
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const formOptions = ['Tablet', 'Capsule', 'Pen', 'Syrup', 'Inhaler', 'Vial'] as const;
const unitOptions = ['pcs', 'pens', 'vials', 'bottles', 'inhalers', 'sachets'] as const;
const MEDICATION_UPDATE_TIMEOUT_MS = 9000;
const MEDICATION_UPDATE_RETRY_LIMIT = 2;
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const ADD_MEDICATION_TIMEOUT_MS = 12000;
const ADD_CATEGORY_TIMEOUT_MS = 12000;
const ADD_MEDICATION_ICON_URL = 'https://api.iconify.design/mdi:pill.svg?color=%23475569';
const ADD_CATEGORY_ICON_URL = 'https://api.iconify.design/mdi:shape-outline.svg?color=%23475569';
const EMPTY_NEW_MEDICATION: NewMedicationForm = {
  name: '',
  categoryId: '',
  form: 'Tablet',
  strength: '',
  storageRequirement: '',
  unit: 'pcs',
  quantity: '',
  batch: '',
  reorder: '',
  expiry: '',
  supplierId: '',
};
const EMPTY_NEW_CATEGORY: NewCategoryForm = {
  categoryName: '',
  description: '',
};

const severityColors: Record<Severity, string> = {
  critical: 'border-red-300 bg-red-50',
  warning: 'border-amber-300 bg-amber-50',
};

const statusTextColors: Record<InventoryStatus, string> = {
  Adequate: 'text-green-600',
  Low: 'text-amber-600',
  Critical: 'text-red-600',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function normalizeAlertType(value: AlertApiItem['alert_type']): 'Stock Risk' | 'Expiration Risk' {
  return value === 'Expiration Risk' || value === 'Expiry Risk' ? 'Expiration Risk' : 'Stock Risk';
}

function deriveRiskMode(alertType: 'Stock Risk' | 'Expiration Risk', severity: Severity): InventoryAlert['riskMode'] {
  if (alertType === 'Stock Risk') {
    return severity === 'critical' ? 'Out of Stock' : 'Low Stock';
  }
  return severity === 'critical' ? 'Expired' : 'Near Expiry';
}

function isExpiredDate(expiry: string) {
  if (!expiry || expiry === 'N/A') return false;
  const parsed = new Date(expiry);
  if (Number.isNaN(parsed.getTime())) return false;
  parsed.setHours(23, 59, 59, 999);
  return parsed.getTime() < Date.now();
}

function matchesMonthFilter(lastUpdatedIso: string | null, filterMonth: string) {
  if (!['This Month', 'Last Month', 'Last 3 Months', 'This Year'].includes(filterMonth)) return true;
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
  if (filterMonth === 'This Year') return updatedAt >= currentYearStart && updatedAt < nextYearStart;
  if (filterMonth === 'This Month') return updatedAt >= currentMonthStart && updatedAt < nextMonthStart;
  if (filterMonth === 'Last Month') return updatedAt >= lastMonthStart && updatedAt < currentMonthStart;
  return updatedAt >= threeMonthsAgoStart && updatedAt < nextMonthStart;
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

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRetryableMedicationUpdateStatus(status: number) {
  return RETRYABLE_HTTP_STATUS.has(status);
}

function parseNonNegativeInteger(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

async function parseApiErrorMessage(response: Response, fallbackMessage: string) {
  try {
    const json = (await response.json()) as { error?: string; message?: string };
    const message = (json.error || json.message || '').trim();
    return message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function Skeleton() {
  return (
    <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5 animate-pulse">
      <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="h-6 w-56 rounded bg-gray-300" />
            <div className="h-9 w-24 rounded-lg bg-gray-300" />
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="h-10 w-full rounded-lg bg-gray-300 lg:w-72" />
            <div className="flex gap-2">
              <div className="h-10 w-32 rounded-lg bg-gray-300" />
              <div className="h-10 w-36 rounded-lg bg-gray-300" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 min-h-[200px] content-start">
          {[1, 2, 3].map((card) => (
            <div key={card} className="rounded-xl border-2 border-gray-300 bg-gray-50 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="h-4 w-40 rounded bg-gray-300" />
                <div className="h-5 w-16 rounded-full bg-gray-300" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-32 rounded bg-gray-300" />
                <div className="h-3 w-28 rounded bg-gray-300" />
                <div className="h-3 w-36 rounded bg-gray-300" />
              </div>
              <div className="mt-4 flex gap-2">
                <div className="h-8 flex-1 rounded-lg bg-gray-300" />
                <div className="h-8 flex-1 rounded-lg bg-gray-300" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-center">
          <div className="h-9 w-28 rounded-lg bg-gray-300" />
        </div>
      </div>

      <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="h-10 w-full rounded-lg bg-gray-300 md:w-72" />
          <div className="flex flex-wrap gap-2">
            <div className="h-10 w-36 rounded-lg bg-gray-300" />
            <div className="h-10 w-32 rounded-lg bg-gray-300" />
            <div className="h-10 w-28 rounded-lg bg-gray-300" />
            <div className="h-10 w-32 rounded-lg bg-gray-300" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-full rounded bg-gray-300" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CurrentStocks() {
  const location = useLocation();
  const handledFocusIdRef = useRef('');
  const stocksTableViewportRef = useRef<HTMLDivElement | null>(null);

  const [items, setItems] = useState<InventoryRow[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [isLoadingStocks, setIsLoadingStocks] = useState(true);
  const [stocksError, setStocksError] = useState('');

  const [alertSearchTerm, setAlertSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Severity | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [alertPage, setAlertPage] = useState(1);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [highlightedAlertId, setHighlightedAlertId] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All Categories');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [filterMonth, setFilterMonth] = useState('This Year');
  const [currentPage, setCurrentPage] = useState(1);
  const [stocksPageSize, setStocksPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null);
  const [isEditingMedication, setIsEditingMedication] = useState(false);
  const [isSavingMedicationEdit, setIsSavingMedicationEdit] = useState(false);
  const [medicationEditError, setMedicationEditError] = useState('');
  const [medicationDraft, setMedicationDraft] = useState({ name: '', categoryId: '', form: '', strength: '', storageRequirement: '', stock: '', reorder: '', supplierId: '' });
  const [medicationToast, setMedicationToast] = useState<ToastState>(null);
  const [isAddChoiceOpen, setIsAddChoiceOpen] = useState(false);
  const [isAddMedicationOpen, setIsAddMedicationOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddedSuccessOpen, setIsAddedSuccessOpen] = useState(false);
  const [addSuccessMessage, setAddSuccessMessage] = useState('');
  const [isSubmittingMedication, setIsSubmittingMedication] = useState(false);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [formError, setFormError] = useState('');
  const [addMedicationFieldErrors, setAddMedicationFieldErrors] = useState<AddMedicationFieldErrors>({});
  const [categoryFormError, setCategoryFormError] = useState('');
  const [addCategoryFieldErrors, setAddCategoryFieldErrors] = useState<AddCategoryFieldErrors>({});
  const [categoryDropdown, setCategoryDropdown] = useState<CategoryOption[]>([]);
  const [supplierDropdown, setSupplierDropdown] = useState<SupplierOption[]>([]);
  const [restockSupplierDropdown, setRestockSupplierDropdown] = useState<SupplierOption[]>([]);
  const [newMedication, setNewMedication] = useState<NewMedicationForm>(EMPTY_NEW_MEDICATION);
  const [newCategory, setNewCategory] = useState<NewCategoryForm>(EMPTY_NEW_CATEGORY);

  const [restockTarget, setRestockTarget] = useState<InventoryAlert | null>(null);
  const [restockDetails, setRestockDetails] = useState({ supplier: '', quantity: '', neededBy: '', notes: '' });
  const [restockErrors, setRestockErrors] = useState({ supplier: '', quantity: '', neededBy: '' });
  const [createdRequests, setCreatedRequests] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [disposeTarget, setDisposeTarget] = useState<InventoryAlert | null>(null);
  const [disposeError, setDisposeError] = useState('');
  const [isDisposingExpired, setIsDisposingExpired] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoadingStocks(true);
    setStocksError('');
    try {
      const [stockRes, alertRes] = await Promise.all([
        fetch(`${API_BASE_URL}/medications`).then(r => r.json()) as Promise<{ items: MedicationApiItem[] }>,
        fetch(`${API_BASE_URL}/inventory-alerts`).then(r => r.json()) as Promise<{ items: AlertApiItem[] }>,
      ]);

      const normalizedItems: InventoryRow[] = (stockRes.items || []).map((entry) => ({
        id: `I-${entry.medication_id.toString().padStart(3, '0')}`,
        name: entry.medication_name,
        categoryId: entry.category_id ?? null,
        category: entry.category_name,
        batch: entry.batch_number || 'N/A',
        stock: entry.total_stock ?? 0,
        unit: entry.unit,
        status: normalizeStatus(entry.status),
        expiry: entry.expiry_date || 'N/A',
        reorder: entry.reorder_threshold,
        supplierId: entry.supplier_id || null,
        supplier: entry.supplier_name || 'N/A',
        form: entry.form || '',
        strength: entry.strength || '',
        storageRequirement: entry.storage_requirement || '',
        lastUpdated: formatDateDisplay(entry.last_updated),
        lastUpdatedIso: entry.last_updated,
      }));
      setItems(normalizedItems);
      setSelectedItem(prev => prev ? normalizedItems.find(r => r.id === prev.id) || null : null);

      setAlerts((alertRes.items || []).map((entry): InventoryAlert => {
        const normalizedSeverity: Severity = String(entry.severity).toLowerCase() === 'critical' ? 'critical' : 'warning';
        const normalizedAlertType = normalizeAlertType(entry.alert_type);
        return {
          id: entry.medication_key,
          name: entry.medication_name,
          category: entry.category_name,
          lowStock: entry.total_stock,
          expiry: entry.expiry_date || 'N/A',
          suggestedRestock: Math.max(entry.reorder_threshold - entry.total_stock, 0),
          unit: entry.unit,
          severity: normalizedSeverity,
          alertType: normalizedAlertType,
          riskMode: entry.risk_mode || deriveRiskMode(normalizedAlertType, normalizedSeverity),
          message: entry.alert_message || '',
        };
      }));

      const requests = await loadRestockRequests();
      const pending: Record<string, boolean> = {};
      requests.filter(r => r.status === 'Pending').forEach(r => { pending[r.medicationId] = true; });
      setCreatedRequests(pending);
    } catch (err) {
      setStocksError(err instanceof Error ? err.message : 'Failed to load data');
      setItems([]);
      setAlerts([]);
    } finally {
      setIsLoadingStocks(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleChange = () => loadData();
    window.addEventListener(RESTOCK_REQUESTS_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(RESTOCK_REQUESTS_CHANGED_EVENT, handleChange);
  }, [loadData, location.pathname]);

  useEffect(() => {
    if (!medicationToast) return;
    const timer = window.setTimeout(() => setMedicationToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [medicationToast]);

  const buildInitialMedicationForm = useCallback((categories: CategoryOption[], suppliers: SupplierOption[]): NewMedicationForm => ({
    ...EMPTY_NEW_MEDICATION,
    categoryId: String(categories[0]?.category_id || ''),
    supplierId: String(suppliers[0]?.supplier_id || ''),
  }), []);

  const resetAddMedicationState = useCallback((categories: CategoryOption[] = [], suppliers: SupplierOption[] = []) => {
    setFormError('');
    setAddMedicationFieldErrors({});
    setNewMedication(buildInitialMedicationForm(categories, suppliers));
  }, [buildInitialMedicationForm]);

  const closeAddMedicationModal = useCallback(() => {
    if (isSubmittingMedication) return;
    setIsAddMedicationOpen(false);
    resetAddMedicationState(categoryDropdown, supplierDropdown);
  }, [isSubmittingMedication, resetAddMedicationState, categoryDropdown, supplierDropdown]);

  const openAddMedicationModal = useCallback(() => {
    setIsAddChoiceOpen(false);
    resetAddMedicationState(categoryDropdown, supplierDropdown);
    setIsAddMedicationOpen(true);
  }, [resetAddMedicationState, categoryDropdown, supplierDropdown]);

  const resetAddCategoryState = useCallback(() => {
    setCategoryFormError('');
    setAddCategoryFieldErrors({});
    setNewCategory(EMPTY_NEW_CATEGORY);
  }, []);

  const closeAddCategoryModal = useCallback(() => {
    if (isSubmittingCategory) return;
    setIsAddCategoryOpen(false);
    resetAddCategoryState();
  }, [isSubmittingCategory, resetAddCategoryState]);

  const openAddCategoryModal = useCallback(() => {
    setIsAddChoiceOpen(false);
    resetAddCategoryState();
    setIsAddCategoryOpen(true);
  }, [resetAddCategoryState]);

  const openAddChoiceModal = useCallback(() => {
    setIsAddChoiceOpen(true);
  }, []);

  const closeAddChoiceModal = useCallback(() => {
    setIsAddChoiceOpen(false);
  }, []);

  useEffect(() => {
    if (!isAddMedicationOpen) return;
    const controller = new AbortController();
    const { signal } = controller;
    setFormError('');
    setAddMedicationFieldErrors({});
    async function loadDropdowns() {
      try {
        const [categoryRes, supplierRes] = await Promise.all([
          fetch(`${API_BASE_URL}/medications/categories`, { signal }),
          fetch(`${API_BASE_URL}/medications/suppliers`, { signal }),
        ]);
        if (!categoryRes.ok || !supplierRes.ok) throw new Error('Failed to load category/supplier data.');
        const categoryJson = (await categoryRes.json()) as { categories: CategoryOption[] };
        const supplierJson = (await supplierRes.json()) as { suppliers: SupplierOption[] };
        if (signal.aborted) return;
        const categories = categoryJson.categories || [];
        const suppliers = supplierJson.suppliers || [];
        setCategoryDropdown(categories);
        setSupplierDropdown(suppliers);
        resetAddMedicationState(categories, suppliers);
      } catch (error) {
        if (signal.aborted) return;
        setFormError(error instanceof Error ? error.message : 'Failed to load form options.');
      }
    }
    loadDropdowns();
    return () => controller.abort();
  }, [isAddMedicationOpen, resetAddMedicationState]);

  useEffect(() => {
    if (!restockTarget) return;
    let isMounted = true;

    async function loadRestockSuppliers() {
      try {
        const response = await fetch(`${API_BASE_URL}/suppliers`);
        if (!response.ok) throw new Error('Failed to load suppliers.');
        const supplierJson = (await response.json()) as { suppliers: SupplierOption[] };
        if (!isMounted) return;
        const nextSuppliers = supplierJson.suppliers || [];
        setRestockSupplierDropdown(nextSuppliers);
        setRestockDetails((prev) => ({
          ...prev,
          supplier:
            prev.supplier ||
            String(nextSuppliers[0]?.supplier_id || ''),
        }));
      } catch (error) {
        if (!isMounted) return;
        setRestockErrors((prev) => ({
          ...prev,
          supplier: error instanceof Error ? error.message : 'Failed to load suppliers.',
        }));
      }
    }

    loadRestockSuppliers();
    return () => { isMounted = false; };
  }, [restockTarget]);

  useEffect(() => {
    if (!selectedItem) return;
    if (categoryDropdown.length && supplierDropdown.length) return;
    let cancelled = false;
    (async () => {
      try {
        await loadMedicationEditOptions();
      } catch (error) {
        if (cancelled) return;
        setMedicationEditError(error instanceof Error ? error.message : 'Failed to load edit options.');
      }
    })();
    return () => { cancelled = true; };
  }, [selectedItem, categoryDropdown.length, supplierDropdown.length]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a =>
      a.name.toLowerCase().includes(alertSearchTerm.toLowerCase()) &&
      (!severityFilter || a.severity === severityFilter) &&
      (!categoryFilter || a.category.toLowerCase().includes(categoryFilter.toLowerCase()))
    ).sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1 };
      return severityOrder[a.severity] - severityOrder[b.severity] || a.lowStock - b.lowStock;
    });
  }, [alerts, alertSearchTerm, severityFilter, categoryFilter]);

  const alertCategories = useMemo(() => Array.from(new Set(alerts.map(a => a.category))).sort(), [alerts]);
  const alertTotalPages = Math.ceil(filteredAlerts.length / ALERTS_PAGE_SIZE);
  const canCollapseAlerts = filteredAlerts.length > 3;
  const visibleAlerts = showAllAlerts ? filteredAlerts : filteredAlerts.slice(0, 3);

  // Fix 1: added alertPage to deps
  useEffect(() => {
    setAlertPage(1);
    setShowAllAlerts(false);
  }, [alertSearchTerm, severityFilter, categoryFilter]);
  useEffect(() => { if (alertPage > alertTotalPages) setAlertPage(1); }, [alertPage, alertTotalPages]);

  const filteredItems = useMemo(() => {
    return items.filter(item => (
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterStatus === 'All Status' || item.status === filterStatus) &&
      (filterCategory === 'All Categories' || item.category === filterCategory) &&
      matchesMonthFilter(item.lastUpdatedIso, filterMonth)
    )).sort((a, b) => {
      const statusDiff = statusSortRank(a.status) - statusSortRank(b.status);
      if (statusDiff !== 0) return statusDiff;
      const expiryDiff = expirySortRank(a.expiry) - expirySortRank(b.expiry);
      if (expiryDiff !== 0) return expiryDiff;
      return a.name.localeCompare(b.name);
    });
  }, [items, searchTerm, filterStatus, filterCategory, filterMonth]);

  const categoryOptions = useMemo(() => Array.from(new Set(items.map(i => i.category))).sort(), [items]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / stocksPageSize));
  const startIndex = (currentPage - 1) * stocksPageSize;
  const pagedItems = filteredItems.slice(startIndex, startIndex + stocksPageSize);

  useEffect(() => setCurrentPage(1), [searchTerm, filterStatus, filterCategory, filterMonth]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const focusMedicationId = useMemo(() => new URLSearchParams(location.search).get('focusMedicationId') || '', [location.search]);
  const focusAlertMedicationId = useMemo(() => new URLSearchParams(location.search).get('focusAlertMedicationId') || '', [location.search]);
  const focusAlertName = useMemo(() => new URLSearchParams(location.search).get('focusAlertName') || '', [location.search]);
  const focusAlertQuery = useMemo(() => new URLSearchParams(location.search).get('focusAlertQuery') || '', [location.search]);
  const openMedicationId = useMemo(() => new URLSearchParams(location.search).get('openMedicationId') || '', [location.search]);

  useEffect(() => {
    if (!focusMedicationId || !items.length) return;
    if (handledFocusIdRef.current === focusMedicationId) return;
    const target = items.find(i => i.id === focusMedicationId);
    if (!target) return;
    setFilterCategory('All Categories');
    setFilterStatus('All Status');
    setSearchTerm(target.name);
  }, [focusMedicationId, items]);

  useEffect(() => {
    if (!alerts.length || !items.length) return;
    if (!focusAlertMedicationId && !focusAlertName && !focusAlertQuery) return;
    const normalizedName = focusAlertName.trim().toLowerCase();
    const normalizedQuery = focusAlertQuery.trim().toLowerCase();
    const queryTokens = normalizedQuery
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3);

    function scoreAlert(alert: InventoryAlert) {
      const haystack = `${alert.name} ${alert.category}`.toLowerCase();
      let score = 0;
      if (normalizedName && haystack.includes(normalizedName)) score += 6;
      if (normalizedQuery && haystack.includes(normalizedQuery)) score += 8;
      if (queryTokens.length) {
        for (const token of queryTokens) {
          if (haystack.includes(token)) score += 2;
        }
      }
      return score;
    }

    const directMatch = focusAlertMedicationId
      ? alerts.find((alert) => alert.id === focusAlertMedicationId)
      : null;
    const bestMatch = directMatch
      || alerts
        .map((alert) => ({ alert, score: scoreAlert(alert) }))
        .sort((a, b) => b.score - a.score)[0]?.alert
      || null;

    if (!bestMatch || scoreAlert(bestMatch) <= 0) return;
    const targetId = bestMatch.id;
    setSeverityFilter('');
    setCategoryFilter('');
    setAlertSearchTerm('');
    setShowAllAlerts(true);
    setHighlightedAlertId(targetId);
    const timeout = window.setTimeout(() => setHighlightedAlertId(''), 3000);
    setTimeout(() => {
      const node = document.querySelector(`[data-search-alert-id="${targetId}"]`);
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const targetItem =
        items.find((item) => item.id === targetId)
        || items.find((item) => item.name.toLowerCase() === bestMatch.name.toLowerCase());
      if (targetItem) {
        openMedicationDetails(targetItem);
      }
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [focusAlertMedicationId, focusAlertName, focusAlertQuery, alerts, items]);

  useEffect(() => {
    if (!focusMedicationId || !filteredItems.length) return;
    if (handledFocusIdRef.current === focusMedicationId) return;
    const targetIndex = filteredItems.findIndex(i => i.id === focusMedicationId);
    if (targetIndex < 0) return;
    setCurrentPage(Math.floor(targetIndex / stocksPageSize) + 1);
    setTimeout(() => {
      const node = document.querySelector(`[data-search-medication-id="${focusMedicationId}"]`);
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        handledFocusIdRef.current = focusMedicationId;
      }
    }, 120);
  }, [focusMedicationId, filteredItems, stocksPageSize]);

  useEffect(() => {
    const viewport = stocksTableViewportRef.current;
    if (!viewport) return;

    const recomputePageSize = () => {
      const viewportRect = viewport.getBoundingClientRect();
      const availableHeight = window.innerHeight - viewportRect.top - TABLE_FOOTER_RESERVED_HEIGHT - TABLE_VIEWPORT_BOTTOM_GUTTER;
      if (availableHeight <= 0) return;
      const rows = Math.floor((availableHeight - ESTIMATED_TABLE_HEADER_HEIGHT) / ESTIMATED_TABLE_ROW_HEIGHT);
      const nextPageSize = Math.max(MIN_STOCKS_PAGE_SIZE, Math.min(MAX_STOCKS_PAGE_SIZE, rows));
      setStocksPageSize((prev) => (prev === nextPageSize ? prev : nextPageSize));
    };

    recomputePageSize();

    const observer = new ResizeObserver(recomputePageSize);
    observer.observe(viewport);
    window.addEventListener('resize', recomputePageSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recomputePageSize);
    };
  }, [showAllAlerts, filteredAlerts.length]);

  useEffect(() => {
    if (!openMedicationId || !items.length) return;
    const target = items.find(i => i.id === openMedicationId);
    if (target) setSelectedItem(target);
  }, [openMedicationId, items]);

  const openRestock = (alert: InventoryAlert) => {
    if (alert.alertType !== 'Stock Risk') return;
    const item = items.find(i => i.id === alert.id);
    setRestockTarget(alert);
    setRestockDetails({
      supplier: item?.supplierId ? String(item.supplierId) : '',
      quantity: alert.suggestedRestock.toString(),
      neededBy: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: ''
    });
    setRestockErrors({ supplier: '', quantity: '', neededBy: '' });
  };

  const validateAndSubmitRestock = async () => {
    const errors = {
      supplier: !restockDetails.supplier.trim() ? 'Required' : '',
      quantity: isNaN(Number(restockDetails.quantity)) || Number(restockDetails.quantity) <= 0 ? 'Valid number > 0' : '',
      neededBy: !restockDetails.neededBy ? 'Required' : ''
    };
    setRestockErrors(errors);
    if (Object.values(errors).some(Boolean) || !restockTarget) return;
  const item = items.find(i => i.id === restockTarget.id);
    if (!item) {
      setRestockErrors(prev => ({ ...prev, supplier: 'Unable to find the selected medication.' }));
      return;
    }
    const supplierId = Number(restockDetails.supplier);
    if (!Number.isInteger(supplierId) || supplierId <= 0) { setRestockErrors(prev => ({ ...prev, supplier: 'Select a supplier.' })); return; }
    try {
      setIsSubmitting(true);
      await createRestockRequest({
        medicationId: Number(restockTarget.id.replace(/^I-/, '')),
        supplierId,
        medication: restockTarget.name,
        category: restockTarget.category,
        severity: restockTarget.severity === 'critical' ? 'Critical' : 'Warning',
        suggestedQuantity: restockTarget.suggestedRestock,
        quantity: Number(restockDetails.quantity),
        unit: restockTarget.unit,
        currentStock: restockTarget.lowStock,
        threshold: item.reorder,
        neededBy: restockDetails.neededBy,
        notes: restockDetails.notes
      });
      setCreatedRequests(prev => ({ ...prev, [restockTarget.id]: true }));
      setRestockTarget(null);
      setShowSuccess(true);
    } catch (err) {
      setRestockErrors(prev => ({ ...prev, supplier: (err as Error).message || 'Failed' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  function openDisposeModal(alert: InventoryAlert) {
    if (alert.alertType !== 'Expiration Risk') return;
    setDisposeTarget(alert);
    setDisposeError('');
  }

  function closeDisposeModal() {
    if (isDisposingExpired) return;
    setDisposeTarget(null);
    setDisposeError('');
  }

  const canDisposeSelectedTarget = useMemo(() => {
    if (!disposeTarget) return false;
    return disposeTarget.riskMode === 'Expired' || isExpiredDate(disposeTarget.expiry);
  }, [disposeTarget]);

  async function confirmDisposeExpired() {
    if (!disposeTarget || !canDisposeSelectedTarget || isDisposingExpired) return;

    const medicationId = Number(disposeTarget.id.replace('I-', ''));
    if (!Number.isInteger(medicationId) || medicationId <= 0) {
      setDisposeError('Invalid medication identifier. Please refresh and try again.');
      return;
    }

    try {
      setIsDisposingExpired(true);
      setDisposeError('');
      const response = await fetch(`${API_BASE_URL}/medications/${medicationId}/dispose-expired`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Disposed expired batch via inventory & alerts priority cards.' }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({} as { error?: string }));
        throw new Error(json.error || 'Failed to dispose expired batch.');
      }
      setDisposeTarget(null);
      await loadData();
      emitGlobalSearchRefresh();
    } catch (error) {
      setDisposeError(error instanceof Error ? error.message : 'Failed to dispose expired batch.');
    } finally {
      setIsDisposingExpired(false);
    }
  }

  const selectedRestockSupplier = useMemo(
    () => restockSupplierDropdown.find((supplier) => String(supplier.supplier_id) === restockDetails.supplier) || null,
    [restockSupplierDropdown, restockDetails.supplier],
  );

  async function handleAddMedicationSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmittingMedication) return;

    const medicationName = newMedication.name.trim();
    const form = newMedication.form.trim();
    const strength = newMedication.strength.trim();
    const storageRequirement = newMedication.storageRequirement.trim();
    const unit = newMedication.unit.trim();
    const batch = newMedication.batch.trim();
    const expiry = newMedication.expiry.trim();
    const categoryId = parsePositiveInteger(newMedication.categoryId);
    const reorderThreshold = parsePositiveInteger(newMedication.reorder);
    const quantity = parsePositiveInteger(newMedication.quantity);
    const supplierId = parsePositiveInteger(newMedication.supplierId);
    const errors: AddMedicationFieldErrors = {};

    if (!medicationName) errors.name = 'Medication name is required.';
    else if (medicationName.length > 120) errors.name = 'Medication name must be 120 characters or fewer.';
    if (!form) errors.form = 'Form is required.';
    else if (!formOptions.includes(form as typeof formOptions[number])) errors.form = 'Select a valid form.';
    if (!strength) errors.strength = 'Strength is required.';
    if (!storageRequirement) errors.storageRequirement = 'Storage requirement is required.';
    if (!unit) errors.unit = 'Unit is required.';
    else if (!unitOptions.includes(unit as typeof unitOptions[number])) errors.unit = 'Select a valid unit.';
    if (!categoryId) errors.categoryId = 'Select a valid category.';
    else if (!categoryDropdown.some((entry) => entry.category_id === categoryId)) errors.categoryId = 'Selected category is no longer available.';
    if (!reorderThreshold) errors.reorder = 'Reorder threshold must be a positive integer.';
    if (!batch) errors.batch = 'Batch number is required.';
    if (!quantity) errors.quantity = 'Quantity must be a positive integer.';
    if (!expiry) errors.expiry = 'Expiry date is required.';
    else if (Number.isNaN(new Date(expiry).getTime())) errors.expiry = 'Select a valid expiry date.';
    if (!supplierId) errors.supplierId = 'Select a valid supplier.';
    else if (!supplierDropdown.some((entry) => entry.supplier_id === supplierId)) errors.supplierId = 'Selected supplier is no longer available.';

    setAddMedicationFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError('Please fix the highlighted fields and try again.');
      return;
    }
    if (!navigator.onLine) {
      setFormError('You appear to be offline. Check your connection and try again.');
      return;
    }

    setIsSubmittingMedication(true);
    setFormError('');
    setAddMedicationFieldErrors({});
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), ADD_MEDICATION_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE_URL}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          medication_name: medicationName,
          category_id: categoryId,
          form,
          strength,
          storage_requirement: storageRequirement,
          unit,
          reorder_threshold: reorderThreshold,
          batch_number: batch,
          quantity,
          expiry_date: expiry,
          supplier_id: supplierId,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response, 'Failed to create medication.'));
      }

      try {
        await response.json() as CreateMedicationResponse;
      } catch {
        // Some environments may return empty/invalid JSON even when the write succeeded.
      }

      setIsAddMedicationOpen(false);
      resetAddMedicationState(categoryDropdown, supplierDropdown);
      setAddSuccessMessage('Medication record has been successfully added.');
      setIsAddedSuccessOpen(true);
      await loadData();
      emitGlobalSearchRefresh();
      setCurrentPage(1);
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      const message = isAbort
        ? 'Add medication request timed out. Please try again.'
        : error instanceof Error
          ? error.message
          : 'Failed to create medication.';
      setFormError(message);
    } finally {
      window.clearTimeout(timeout);
      setIsSubmittingMedication(false);
    }
  }

  async function handleAddCategorySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmittingCategory) return;

    const categoryName = newCategory.categoryName.trim();
    const description = newCategory.description.trim();
    const errors: AddCategoryFieldErrors = {};

    if (!categoryName) {
      errors.categoryName = 'Category name is required.';
    } else if (categoryName.length > 255) {
      errors.categoryName = 'Category name must be 255 characters or fewer.';
    }

    setAddCategoryFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setCategoryFormError('Please fix the highlighted fields and try again.');
      return;
    }
    if (!navigator.onLine) {
      setCategoryFormError('You appear to be offline. Check your connection and try again.');
      return;
    }

    setIsSubmittingCategory(true);
    setCategoryFormError('');
    setAddCategoryFieldErrors({});
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), ADD_CATEGORY_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/medications/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          category_name: categoryName,
          description: description || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response, 'Failed to create category.'));
      }

      const json = (await response.json()) as CreateCategoryResponse;
      const createdCategory = json.category;
      if (createdCategory?.category_id && createdCategory?.category_name) {
        setCategoryDropdown((prev) => {
          const next = [...prev, {
            category_id: createdCategory.category_id,
            category_name: createdCategory.category_name,
          }];
          next.sort((a, b) => a.category_name.localeCompare(b.category_name));
          return next;
        });
      }

      setIsAddCategoryOpen(false);
      resetAddCategoryState();
      setAddSuccessMessage('Category has been successfully added.');
      setIsAddedSuccessOpen(true);
      emitGlobalSearchRefresh();
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      const message = isAbort
        ? 'Add category request timed out. Please try again.'
        : error instanceof Error
          ? error.message
          : 'Failed to create category.';
      setCategoryFormError(message);
    } finally {
      window.clearTimeout(timeout);
      setIsSubmittingCategory(false);
    }
  }

  async function loadMedicationEditOptions() {
    const [categoryRes, supplierRes] = await Promise.all([
      fetch(`${API_BASE_URL}/medications/categories`),
      fetch(`${API_BASE_URL}/medications/suppliers`),
    ]);

    if (!categoryRes.ok || !supplierRes.ok) {
      throw new Error('Failed to load medication edit options.');
    }

    const categoryJson = (await categoryRes.json()) as { categories?: CategoryOption[] };
    const supplierJson = (await supplierRes.json()) as { suppliers?: SupplierOption[] };
    const categories = categoryJson.categories || [];
    const suppliers = supplierJson.suppliers || [];

    setCategoryDropdown(categories);
    setSupplierDropdown(suppliers);
    return { categories, suppliers };
  }

function buildMedicationUpdatePayload(
  categories: CategoryOption[],
  suppliers: SupplierOption[],
): { payload: SaveMedicationPayload | null; message: string } {
    const medicationName = medicationDraft.name.trim();
    const form = medicationDraft.form.trim();
    const strength = medicationDraft.strength.trim();
    const storageRequirement = medicationDraft.storageRequirement.trim();
    const stock = parseNonNegativeInteger(medicationDraft.stock);
    const reorder = parseNonNegativeInteger(medicationDraft.reorder);
    const categoryId = Number(medicationDraft.categoryId);
    const supplierId = Number(medicationDraft.supplierId);

    if (!medicationName) {
      return { payload: null, message: 'Medication name is required.' };
    }
    if (medicationName.length > 120) {
      return { payload: null, message: 'Medication name must be 120 characters or fewer.' };
    }
    if (!form) {
      return { payload: null, message: 'Medication form is required.' };
    }
    if (!storageRequirement) {
      return { payload: null, message: 'Storage requirement is required.' };
    }
    if (stock === null || stock < 0) {
      return { payload: null, message: 'Stock must be an integer greater than or equal to 0.' };
    }
    if (reorder === null || reorder < 0) {
      return { payload: null, message: 'Threshold must be an integer greater than or equal to 0.' };
    }
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return { payload: null, message: 'Select a valid category.' };
    }
    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      return { payload: null, message: 'Select a valid supplier.' };
    }

    const category = categories.find((entry) => entry.category_id === categoryId);
    if (!category) {
      return { payload: null, message: 'Selected category is no longer available. Please refresh options.' };
    }
    const supplier = suppliers.find((entry) => entry.supplier_id === supplierId);
    if (!supplier) {
      return { payload: null, message: 'Selected supplier is no longer available. Please refresh options.' };
    }

    return {
      payload: {
        medication_name: medicationName,
        category_id: categoryId,
        category_name: category.category_name,
        form,
        strength,
        storage_requirement: storageRequirement,
        total_stock: stock,
        reorder_threshold: reorder,
        supplier_id: supplierId,
        supplier_name: supplier.supplier_name,
      },
      message: '',
    };
  }

  async function patchMedicationWithRetry(medicationId: number, payload: SaveMedicationPayload) {
    let lastError = new Error('Failed to update medication.');

    for (let attempt = 0; attempt <= MEDICATION_UPDATE_RETRY_LIMIT; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), MEDICATION_UPDATE_TIMEOUT_MS);

      try {
        if (!navigator.onLine) {
          throw new Error('You appear to be offline. Check your connection and try again.');
        }

        const response = await fetch(`${API_BASE_URL}/medications/${medicationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (response.ok) {
          return;
        }

        const message = await parseApiErrorMessage(response, 'Failed to update medication.');
        const isTransient = isRetryableMedicationUpdateStatus(response.status);
        lastError = new Error(message);

        if (!isTransient || attempt >= MEDICATION_UPDATE_RETRY_LIMIT) {
          throw lastError;
        }

        await wait(350 * (attempt + 1));
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === 'AbortError';
        const isNetworkError = error instanceof TypeError || isAbort;
        lastError = isAbort
          ? new Error('Medication update timed out. Please try again.')
          : error instanceof Error
            ? error
            : new Error('Failed to update medication.');

        if (!isNetworkError || attempt >= MEDICATION_UPDATE_RETRY_LIMIT) {
          throw lastError;
        }

        await wait(350 * (attempt + 1));
      } finally {
        window.clearTimeout(timeout);
      }
    }

    throw lastError;
  }

  function openMedicationDetails(item: InventoryRow) {
    setSelectedItem(item);
    setIsEditingMedication(false);
    setMedicationEditError('');
    setMedicationDraft({
      name: item.name,
      categoryId: item.categoryId ? String(item.categoryId) : '',
      form: item.form || '',
      strength: item.strength || '',
      storageRequirement: item.storageRequirement || '',
      stock: String(item.stock),
      reorder: String(item.reorder),
      supplierId: item.supplierId ? String(item.supplierId) : '',
    });
  }

  async function startEditingMedication() {
    if (!selectedItem) return;
    setMedicationEditError('');
    try {
      const loaded = categoryDropdown.length && supplierDropdown.length ? null : await loadMedicationEditOptions();
      const categories = categoryDropdown.length ? categoryDropdown : (loaded?.categories || []);
      const suppliers = supplierDropdown.length ? supplierDropdown : (loaded?.suppliers || []);

      const fallbackCategoryId = selectedItem.categoryId || categories.find((entry) => entry.category_name === selectedItem.category)?.category_id || 0;
      const fallbackSupplierId = selectedItem.supplierId || suppliers.find((entry) => entry.supplier_name === selectedItem.supplier)?.supplier_id || 0;

      setMedicationDraft({
        name: selectedItem.name,
        categoryId: fallbackCategoryId ? String(fallbackCategoryId) : '',
        form: selectedItem.form || '',
        strength: selectedItem.strength || '',
        storageRequirement: selectedItem.storageRequirement || '',
        stock: String(selectedItem.stock),
        reorder: String(selectedItem.reorder),
        supplierId: fallbackSupplierId ? String(fallbackSupplierId) : '',
      });
    } catch (error) {
      setMedicationEditError(error instanceof Error ? error.message : 'Failed to load edit options.');
      return;
    }
    setIsEditingMedication(true);
  }

  async function saveMedicationDraft() {
    if (!selectedItem) return;

    let categories = categoryDropdown;
    let suppliers = supplierDropdown;
    if (!categories.length || !suppliers.length) {
      try {
        const loaded = await loadMedicationEditOptions();
        categories = loaded.categories;
        suppliers = loaded.suppliers;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load edit options.';
        setMedicationEditError(message);
        setMedicationToast({ type: 'error', message });
        return;
      }
    }

    const validation = buildMedicationUpdatePayload(categories, suppliers);
    if (!validation.payload) {
      setMedicationEditError(validation.message);
      setMedicationToast({ type: 'error', message: validation.message });
      return;
    }

    const medicationId = Number(selectedItem.id.replace('I-', ''));
    if (!Number.isInteger(medicationId) || medicationId <= 0) {
      const message = 'Invalid medication identifier. Please reopen the medication details.';
      setMedicationEditError(message);
      setMedicationToast({ type: 'error', message });
      return;
    }

    setIsSavingMedicationEdit(true);
    setMedicationEditError('');
    try {
      await patchMedicationWithRetry(medicationId, validation.payload);
      await loadData();
      emitGlobalSearchRefresh();
      setIsEditingMedication(false);
      setMedicationToast({ type: 'success', message: 'Medication updated successfully.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update medication.';
      setMedicationEditError(message);
      setMedicationToast({ type: 'error', message });
    } finally {
      setIsSavingMedicationEdit(false);
    }
  }

  const restockItem = restockTarget ? items.find(i => i.id === restockTarget.id) : null;
  const showInitialSkeleton = isLoadingStocks && items.length === 0 && alerts.length === 0 && !stocksError;

  return (
    <div className="space-y-5">
      {medicationToast && (
        <div className="fixed right-4 top-4 z-[10000]">
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${medicationToast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {medicationToast.message}
          </div>
        </div>
      )}
      {showInitialSkeleton && <Skeleton />}

      {!showInitialSkeleton && (
        <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">

          {/* ── ALERTS ── */}
          <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
            <SectionToolbar
              className="mb-4"
              icon={AlertTriangle}
              title={`Priority Alerts (${filteredAlerts.length})`}
              searchValue={alertSearchTerm}
              onSearchChange={setAlertSearchTerm}
              searchPlaceholder="Search alerts..."
              rightControls={(
                <>
                  <button type="button" className="h-10 rounded-lg border border-gray-300 px-3 text-sm font-medium hover:bg-gray-200" onClick={loadData}>Refresh</button>
                  <div className="relative">
                    <select className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={severityFilter} onChange={e => setSeverityFilter(e.target.value as Severity | '')}>
                      <option value="">All Severity</option>
                      <option value="critical">Critical</option>
                      <option value="warning">Warning</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                      <option value="">All Categories</option>
                      {alertCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </>
              )}
            />
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 min-h-[200px] content-start">
              {visibleAlerts.map(alert => (
                <div
                  key={`${alert.id}-${alert.alertType}-${alert.riskMode}`}
                  data-search-alert-id={alert.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const target = items.find(i => i.id === alert.id);
                    if (!target) return;
                    openMedicationDetails(target);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    const target = items.find(i => i.id === alert.id);
                    if (!target) return;
                    openMedicationDetails(target);
                  }}
                  className={`p-4 rounded-xl border-2 ${severityColors[alert.severity]} cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${highlightedAlertId === alert.id ? 'ring-2 ring-blue-400 shadow-md' : ''}`}
                >
                  <div className="mb-2 flex items-start gap-2">
                    <h3 className="min-w-0 flex-1 text-sm font-bold leading-5 text-gray-900">{alert.name}</h3>
                    <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                      {alert.alertType}
                    </span>
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${alert.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                      {alert.severity === 'critical' ? 'Critical' : 'Warning'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${alert.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                      {alert.riskMode}
                    </span>
                  </div>
                  <div className="space-y-1 mb-3 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">Stock</span><span className="font-semibold">{alert.lowStock} {alert.unit}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Expiry</span><span>{alert.expiry}</span></div>
                    <div className="flex justify-between font-semibold text-blue-600"><span>Suggested Restock</span><span>{alert.suggestedRestock} {alert.unit}</span></div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 whitespace-nowrap py-1.5 px-2 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium text-[13px]"
                      onClick={(event) => {
                        event.stopPropagation();
                        openMedicationDetails(items.find(i => i.id === alert.id) || items[0]);
                      }}
                    >
                      View
                    </button>
                    {alert.alertType === 'Stock Risk' && (
                      <button
                        type="button"
                        className={`flex-1 whitespace-nowrap py-1.5 px-2 rounded-lg font-semibold text-[13px] ${createdRequests[alert.id] ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openRestock(alert);
                        }}
                        disabled={Boolean(createdRequests[alert.id])}
                      >
                        {createdRequests[alert.id] ? 'Requested' : 'Create Stock Request'}
                      </button>
                    )}
                    {alert.alertType === 'Expiration Risk' && (
                      <button
                        type="button"
                        className="flex-1 whitespace-nowrap py-1.5 px-2 rounded-lg font-semibold text-[13px] bg-red-600 text-white hover:bg-red-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDisposeModal(alert);
                        }}
                      >
                        {alert.riskMode === 'Expired' || isExpiredDate(alert.expiry) ? 'Dispose Expired' : 'Prepare Disposal'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!visibleAlerts.length && !isLoadingStocks && (
                <div className="col-span-full p-10 text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                  <p className="text-gray-500 text-sm">No current alerts</p>
                </div>
              )}
            </div>
            {canCollapseAlerts && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  onClick={() => setShowAllAlerts((prev) => !prev)}
                >
                  {showAllAlerts ? 'Show less' : 'Show more'}
                </button>
              </div>
            )}
            {alertTotalPages > 1 && !canCollapseAlerts && (
              <div className="mt-4">
                <Pagination currentPage={alertPage} totalPages={alertTotalPages} onPageChange={setAlertPage} />
              </div>
            )}
          </div>

          {/* ── STOCKS TABLE ── */}
          <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
            <SectionToolbar
              className="mb-5"
              icon={Pill}
              title="Medication Stocks"
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search Medication"
              rightControls={(
                <>
                  <Button
                    className="inline-flex h-10 items-center gap-2 whitespace-nowrap bg-green-600 pl-3 pr-4 py-1.5 text-sm text-white hover:bg-green-700"
                    onClick={openAddChoiceModal}
                  >
                    <Plus size={16} className="shrink-0" />
                    Add Medication
                  </Button>
                  <div className="relative">
                    <select className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                      <option>All Categories</option>
                      {categoryOptions.map(cat => <option key={cat}>{cat}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option>All Status</option>
                      <option>Adequate</option>
                      <option>Low</option>
                      <option>Critical</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                      <option>This Year</option>
                      <option>This Month</option>
                      <option>Last Month</option>
                      <option>Last 3 Months</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </>
              )}
            />
            <div ref={stocksTableViewportRef} className="overflow-x-auto rounded-xl min-h-[360px]">
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
                  {isLoadingStocks && Array.from({ length: stocksPageSize }).map((_, i) => (
                    <tr key={i} className="border-t border-gray-200">
                      <td colSpan={9} className="px-2 py-1.5"><div className="h-8 w-full animate-pulse rounded bg-gray-200" /></td>
                    </tr>
                  ))}
                  {!isLoadingStocks && stocksError && (
                    <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-red-600">{stocksError}</td></tr>
                  )}
                  {!isLoadingStocks && !stocksError && pagedItems.length === 0 && (
                    <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-600">No medication records found.</td></tr>
                  )}
                  {!isLoadingStocks && !stocksError && pagedItems.map((item, idx) => (
                    <tr key={item.id} data-search-medication-id={item.id} className="border-t border-gray-200 hover:bg-gray-200/40">
                      <td className="px-2 py-1.5 font-semibold text-gray-800">#{String(startIndex + idx + 1).padStart(3, '0')}</td>
                      <td className="px-2 py-1.5 text-gray-800 truncate" title={item.name}>{item.name}</td>
                      <td className="px-2 py-1.5 text-gray-700 truncate">{item.category}</td>
                      <td className="px-2 py-1.5 text-gray-700 truncate">{item.batch}</td>
                      <td className="px-2 py-1.5 font-semibold text-gray-800">{item.stock} {item.unit}</td>
                      <td className="px-2 py-1.5 text-gray-700">{item.reorder} {item.unit}</td>
                      <td className="px-2 py-1.5 text-gray-800">{item.expiry}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.status === 'Critical' ? 'bg-red-100 text-red-700' : item.status === 'Low' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <button type="button" onClick={() => openMedicationDetails(item)} className="text-blue-600 hover:text-blue-700 font-semibold">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-gray-600">
              <p>Showing <span className="rounded-md bg-gray-300 px-2">{pagedItems.length}</span> out of {filteredItems.length}</p>
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          </div>

        </section>
      )}

      {disposeTarget && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md" onClick={closeDisposeModal}>
          <div className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2 ${canDisposeSelectedTarget ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {canDisposeSelectedTarget ? 'Dispose Expired Batch' : 'Prepare Disposal Plan'}
                  </h3>
                  <p className="text-xs text-gray-500">Medication safety and stock reconciliation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDisposeModal}
                disabled={isDisposingExpired}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-60"
                aria-label="Close dispose modal"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-bold text-gray-800">{disposeTarget.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">{disposeTarget.alertType}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${disposeTarget.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {disposeTarget.severity === 'critical' ? 'Critical' : 'Warning'}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${disposeTarget.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {disposeTarget.riskMode}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-600">
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="inline-flex items-center gap-1.5"><Package size={14} />Current Stock</span>
                    <span className="font-semibold text-gray-800">{disposeTarget.lowStock} {disposeTarget.unit}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />Expiry Date</span>
                    <span className="font-semibold text-gray-800">{disposeTarget.expiry}</span>
                  </div>
                </div>
              </div>

              <div className={`rounded-xl border px-3 py-2 text-sm ${canDisposeSelectedTarget ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <p>
                    {canDisposeSelectedTarget
                      ? 'This action will dispose the latest expired batch and deduct its quantity from current inventory stock.'
                      : 'This medication is near expiry. Prepare disposal documentation and monitor until it reaches expired status before final disposal.'}
                  </p>
                </div>
              </div>

              {disposeError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {disposeError}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-gray-200 bg-white px-5 py-4">
              <button
                type="button"
                onClick={closeDisposeModal}
                disabled={isDisposingExpired}
                className="h-9 flex-1 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {canDisposeSelectedTarget ? 'Cancel' : 'Close'}
              </button>
              {canDisposeSelectedTarget && (
                <button
                  type="button"
                  onClick={confirmDisposeExpired}
                  disabled={isDisposingExpired}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  {isDisposingExpired ? 'Disposing...' : 'Confirm Dispose'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Detail / Edit Modal ── */}
      {selectedItem && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md" onClick={() => { setSelectedItem(null); setIsEditingMedication(false); }}>
          <div className="w-full max-w-[640px] rounded-2xl border border-gray-200 bg-gray-100 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gray-100"><Pill size={20} className="text-gray-500" /></div>
                <h2 className="text-lg font-bold text-gray-800">Medication Details</h2>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { void startEditingMedication(); }} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"><Pencil size={14} /></button>
                <button type="button" onClick={() => { if (isSavingMedicationEdit) return; setSelectedItem(null); setIsEditingMedication(false); }} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"><X size={14} /></button>
              </div>
            </div>
            {isSavingMedicationEdit && (
              <div className="px-5 pt-4">
                <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
                  Saving medication changes...
                </div>
              </div>
            )}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-white border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3"><Pill size={15} className="text-gray-400" /><span className="text-sm font-bold text-gray-700">Medication</span></div>
                <div className="space-y-2.5">
                  <div><p className="text-xs text-gray-400 mb-0.5">Medication Name</p>{isEditingMedication ? <input className="h-8 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.name} onChange={e => setMedicationDraft(p => ({ ...p, name: e.target.value }))} /> : <p className="text-sm font-bold text-gray-800">{selectedItem.name}</p>}</div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Category</p>{isEditingMedication ? <select className="h-8 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.categoryId} onChange={e => setMedicationDraft(p => ({ ...p, categoryId: e.target.value }))}><option value="">Select category</option>{categoryDropdown.map(c => <option key={c.category_id} value={String(c.category_id)}>{c.category_name}</option>)}</select> : <p className="text-sm font-bold text-gray-800">{selectedItem.category}</p>}</div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Form</p>{isEditingMedication ? <select className="h-8 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.form} onChange={e => setMedicationDraft(p => ({ ...p, form: e.target.value }))}><option value="">Select form</option>{formOptions.map(option => <option key={option} value={option}>{option}</option>)}</select> : <p className="text-sm font-bold text-gray-800">{selectedItem.form || 'N/A'}</p>}</div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Strength</p>{isEditingMedication ? <input className="h-8 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.strength} onChange={e => setMedicationDraft(p => ({ ...p, strength: e.target.value }))} /> : <p className="text-sm font-bold text-gray-800">{selectedItem.strength || 'N/A'}</p>}</div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Storage Requirement</p>{isEditingMedication ? <input className="h-8 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.storageRequirement} onChange={e => setMedicationDraft(p => ({ ...p, storageRequirement: e.target.value }))} /> : <p className="text-sm font-bold text-gray-800">{selectedItem.storageRequirement || 'N/A'}</p>}</div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Unit</p><p className="text-sm font-bold text-gray-800">{selectedItem.unit}</p></div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl bg-white border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3"><Layers size={15} className="text-gray-400" /><span className="text-sm font-bold text-gray-700">Batch</span></div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div><p className="text-xs text-gray-400 mb-0.5">Batch</p><p className="text-sm font-bold text-gray-800">{selectedItem.batch}</p></div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Expiry</p><p className="text-sm font-bold text-gray-800">{selectedItem.expiry}</p></div>
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3"><Package size={15} className="text-gray-400" /><span className="text-sm font-bold text-gray-700">Stock</span></div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div><p className="text-xs text-gray-400 mb-0.5">Stock</p>{isEditingMedication ? <div className="flex items-center gap-1"><input type="number" min={0} className="h-8 w-20 rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.stock} onChange={e => setMedicationDraft(p => ({ ...p, stock: e.target.value }))} /><span className="text-xs text-gray-500">{selectedItem.unit}</span></div> : <p className="text-sm font-bold text-gray-800">{selectedItem.stock} {selectedItem.unit}</p>}</div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Threshold</p>{isEditingMedication ? <div className="flex items-center gap-1"><input type="number" min={0} className="h-8 w-20 rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.reorder} onChange={e => setMedicationDraft(p => ({ ...p, reorder: e.target.value }))} /><span className="text-xs text-gray-500">{selectedItem.unit}</span></div> : <p className="text-sm font-bold text-gray-800">{selectedItem.reorder} {selectedItem.unit}</p>}</div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Status</p><span className={`text-sm font-bold ${statusTextColors[selectedItem.status]}`}>{selectedItem.status}</span></div>
                    <div><p className="text-xs text-gray-400 mb-0.5">Last Updated</p><p className="text-sm font-bold text-gray-800">{selectedItem.lastUpdated}</p></div>
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3"><Building2 size={15} className="text-gray-400" /><span className="text-sm font-bold text-gray-700">Supplier</span></div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Supplier Name</p>{isEditingMedication ? <select className="h-8 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.supplierId} onChange={e => setMedicationDraft(p => ({ ...p, supplierId: e.target.value }))}><option value="">Select supplier</option>{supplierDropdown.map(s => <option key={s.supplier_id} value={String(s.supplier_id)}>{s.supplier_name}</option>)}</select> : <p className="text-sm font-bold text-gray-800">{selectedItem.supplier}</p>}</div>
                </div>
              </div>
            </div>
            {isEditingMedication && (
              <div className="px-5 pb-5">
                {medicationEditError && <p className="mb-2 text-sm text-red-600">{medicationEditError}</p>}
                <div className="flex items-center justify-end gap-2">
                  <button type="button" className="h-9 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60" onClick={() => { setMedicationEditError(''); setIsEditingMedication(false); }} disabled={isSavingMedicationEdit}>Cancel</button>
                  <button type="button" className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60" onClick={saveMedicationDraft} disabled={isSavingMedicationEdit}>{isSavingMedicationEdit ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* ── Add Choice Modal ── */}
      {isAddChoiceOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md" onClick={closeAddChoiceModal}>
          <div className="w-full max-w-[620px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between border-b border-gray-300 pb-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">What would you like to add?</h2>
                <p className="mt-1 text-sm text-gray-600">Choose whether to create a medication record or add a category only.</p>
              </div>
              <button
                type="button"
                onClick={closeAddChoiceModal}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600 hover:text-gray-700"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={openAddMedicationModal}
                className="rounded-xl border border-gray-300 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
              >
                <img src={ADD_MEDICATION_ICON_URL} alt="Medication icon" className="h-10 w-10" />
                <h3 className="mt-3 text-base font-semibold text-gray-800">Add Medication</h3>
                <p className="mt-1 text-sm text-gray-600">Create a medication record with stock, batch, and supplier details.</p>
              </button>

              <button
                type="button"
                onClick={openAddCategoryModal}
                className="rounded-xl border border-gray-300 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
              >
                <img src={ADD_CATEGORY_ICON_URL} alt="Category icon" className="h-10 w-10" />
                <h3 className="mt-3 text-base font-semibold text-gray-800">Add Category Only</h3>
                <p className="mt-1 text-sm text-gray-600">Create a category entry without adding medication stock yet.</p>
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Add Medication Modal ── */}
      {isAddMedicationOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md" onClick={closeAddMedicationModal}>
          <form className="w-full max-w-[460px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={e => e.stopPropagation()} onSubmit={handleAddMedicationSubmit}>
            <div className="mb-4 flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700"><Pill size={16} />Add Medication</h2>
              <button type="button" onClick={closeAddMedicationModal} disabled={isSubmittingMedication} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600 hover:text-gray-700 disabled:opacity-50"><X size={14} /></button>
            </div>
            {isSubmittingMedication && <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">Submitting medication...</p>}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-700">Medication Name<input required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.name} onChange={e => setNewMedication(p => ({ ...p, name: e.target.value }))} /></label>
              <label className="text-sm text-gray-700">Category<select required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.categoryId} onChange={e => setNewMedication(p => ({ ...p, categoryId: e.target.value }))}><option value="">Select category</option>{categoryDropdown.map(c => <option key={c.category_id} value={String(c.category_id)}>{c.category_name}</option>)}</select></label>
              <label className="text-sm text-gray-700">Form<select required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.form} onChange={e => setNewMedication(p => ({ ...p, form: e.target.value }))}>{formOptions.map(o => <option key={o}>{o}</option>)}</select></label>
              <label className="text-sm text-gray-700">Strength<input required placeholder="e.g., 500mg" className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.strength} onChange={e => setNewMedication(p => ({ ...p, strength: e.target.value }))} /></label>
              <label className="text-sm text-gray-700">Storage Requirement<input required placeholder="e.g., Keep refrigerated at 2-8 C" className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.storageRequirement} onChange={e => setNewMedication(p => ({ ...p, storageRequirement: e.target.value }))} /></label>
              <label className="text-sm text-gray-700">Unit<select required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.unit} onChange={e => setNewMedication(p => ({ ...p, unit: e.target.value }))}>{unitOptions.map(o => <option key={o}>{o}</option>)}</select></label>
              <label className="text-sm text-gray-700">Reorder Threshold<input type="number" required min={1} className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.reorder} onChange={e => setNewMedication(p => ({ ...p, reorder: e.target.value }))} /></label>
              <label className="text-sm text-gray-700">Batch Number<input required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.batch} onChange={e => setNewMedication(p => ({ ...p, batch: e.target.value }))} /></label>
              <label className="text-sm text-gray-700">Quantity<input type="number" required min={1} className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.quantity} onChange={e => setNewMedication(p => ({ ...p, quantity: e.target.value }))} /></label>
              <label className="text-sm text-gray-700">Expiry Date<input type="date" required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.expiry} onChange={e => setNewMedication(p => ({ ...p, expiry: e.target.value }))} /></label>
              <label className="text-sm text-gray-700 md:col-span-2">Supplier<select required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.supplierId} onChange={e => setNewMedication(p => ({ ...p, supplierId: e.target.value }))}><option value="">Select supplier</option>{supplierDropdown.map(s => <option key={s.supplier_id} value={String(s.supplier_id)}>{s.supplier_name}</option>)}</select></label>
            </div>
            {Object.values(addMedicationFieldErrors).length > 0 && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                {Object.values(addMedicationFieldErrors).map((message, index) => (
                  <p key={`${index}-${message}`} className="text-xs text-red-600">{message}</p>
                ))}
              </div>
            )}
            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
            <button type="submit" className="mt-5 h-9 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-60" disabled={isSubmittingMedication}>{isSubmittingMedication ? 'Saving...' : 'Add Medication'}</button>
          </form>
        </div>,
        document.body,
      )}

      {/* ── Add Category Modal ── */}
      {isAddCategoryOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md" onClick={closeAddCategoryModal}>
          <form className="w-full max-w-[460px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} onSubmit={handleAddCategorySubmit}>
            <div className="mb-4 flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700">
                <img src={ADD_CATEGORY_ICON_URL} alt="Category icon" className="h-5 w-5" />
                Add Category
              </h2>
              <button
                type="button"
                onClick={closeAddCategoryModal}
                disabled={isSubmittingCategory}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600 hover:text-gray-700 disabled:opacity-50"
              >
                <X size={14} />
              </button>
            </div>

            {isSubmittingCategory && <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">Submitting category...</p>}

            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm text-gray-700">
                Category Name
                <input
                  required
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={newCategory.categoryName}
                  onChange={(event) => setNewCategory((prev) => ({ ...prev, categoryName: event.target.value }))}
                />
              </label>

              <label className="text-sm text-gray-700">
                Description
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
                  value={newCategory.description}
                  onChange={(event) => setNewCategory((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Optional"
                />
              </label>
            </div>

            {Object.values(addCategoryFieldErrors).length > 0 && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                {Object.values(addCategoryFieldErrors).map((message, index) => (
                  <p key={`${index}-${message}`} className="text-xs text-red-600">{message}</p>
                ))}
              </div>
            )}

            {categoryFormError && <p className="mt-3 text-sm text-red-600">{categoryFormError}</p>}

            <button type="submit" className="mt-5 h-9 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-60" disabled={isSubmittingCategory}>
              {isSubmittingCategory ? 'Saving...' : 'Add Category'}
            </button>
          </form>
        </div>,
        document.body,
      )}

      {/* ── Restock Modal ── */}
      {restockTarget && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md" onClick={() => setRestockTarget(null)}>
          <div className="w-full max-w-[640px] rounded-2xl border border-gray-200 bg-gray-100 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gray-100"><RefreshCw size={20} className="text-gray-500" /></div>
                <h2 className="text-lg font-bold text-gray-800">Create Restock Request</h2>
              </div>
              <button type="button" onClick={() => setRestockTarget(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"><X size={14} /></button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-white border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Pill size={15} className="text-gray-400" />
                  <span className="text-sm font-bold text-gray-700">Medication Details</span>
                </div>
                <div className="space-y-2.5 text-sm">
                  <div><p className="text-xs text-gray-400 mb-0.5">Medication Name</p><p className="font-bold text-gray-800">{restockTarget.name}</p></div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Category</p><p className="font-bold text-gray-800">{restockTarget.category}</p></div>
                  {restockItem?.form && <div><p className="text-xs text-gray-400 mb-0.5">Form</p><p className="font-bold text-gray-800">{restockItem.form}</p></div>}
                  {restockItem?.strength && <div><p className="text-xs text-gray-400 mb-0.5">Strength</p><p className="font-bold text-gray-800">{restockItem.strength}</p></div>}
                  <div><p className="text-xs text-gray-400 mb-0.5">Current Stock</p><p className="font-bold text-gray-800">{restockTarget.lowStock} {restockTarget.unit}</p></div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Threshold</p><p className="font-bold text-gray-800">{restockItem?.reorder ?? '—'} {restockTarget.unit}</p></div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Status</p>
                    <span className={`text-sm font-bold ${restockItem ? statusTextColors[restockItem.status] : 'text-gray-800'}`}>
                      {restockItem?.status ?? '—'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                    <textarea
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                      value={restockDetails.notes}
                      onChange={e => setRestockDetails(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Add handling or urgency notes..."
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package size={15} className="text-gray-400" />
                  <span className="text-sm font-bold text-gray-700">Request Details</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Quantity Needed ({restockTarget.unit})</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        className="flex-1 h-9 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={restockDetails.quantity}
                        onChange={e => setRestockDetails(p => ({ ...p, quantity: e.target.value }))}
                      />
                      <button type="button" className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-200 text-gray-600 font-bold text-lg" onClick={() => setRestockDetails(p => ({ ...p, quantity: String(Math.max(1, Number(p.quantity) + 1)) }))}>+</button>
                      <button type="button" className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-200 text-gray-600 font-bold text-lg" onClick={() => setRestockDetails(p => ({ ...p, quantity: String(Math.max(1, Number(p.quantity) - 1)) }))}>−</button>
                    </div>
                    {restockErrors.quantity && <p className="mt-1 text-xs text-red-500">{restockErrors.quantity}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Supplier</p>
                    <select
                      className="w-full h-9 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={restockDetails.supplier}
                      onChange={e => setRestockDetails(p => ({ ...p, supplier: e.target.value }))}
                    >
                      <option value="">Select supplier</option>
                      {restockSupplierDropdown.map((supplier) => (
                        <option key={supplier.supplier_id} value={String(supplier.supplier_id)}>
                          {supplier.supplier_name}
                        </option>
                      ))}
                    </select>
                    {restockErrors.supplier && <p className="mt-1 text-xs text-red-500">{restockErrors.supplier}</p>}
                  </div>
                  {selectedRestockSupplier && (
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-1">
                      <div><p className="text-xs text-gray-400">Supplier Name</p><p className="text-sm font-bold text-gray-800">{selectedRestockSupplier.supplier_name}</p></div>
                      <div><p className="text-xs text-gray-400">Contact Number</p><p className="text-sm font-semibold text-gray-700">{selectedRestockSupplier.contact_number?.trim() || selectedRestockSupplier.contactNumber?.trim() || 'N/A'}</p></div>
                      <div><p className="text-xs text-gray-400">Email Address</p><p className="text-sm font-semibold text-gray-700">{selectedRestockSupplier.email_address?.trim() || selectedRestockSupplier.emailAddress?.trim() || 'N/A'}</p></div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Needed By</p>
                    <input
                      type="date"
                      className="w-full h-9 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={restockDetails.neededBy}
                      onChange={e => setRestockDetails(p => ({ ...p, neededBy: e.target.value }))}
                    />
                    {restockErrors.neededBy && <p className="mt-1 text-xs text-red-500">{restockErrors.neededBy}</p>}
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                    <p className="text-xs text-gray-400 mb-0.5">Suggested Restock</p>
                    <p className="text-sm font-bold text-blue-600">{restockTarget.suggestedRestock} {restockTarget.unit}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 space-y-2">
              <button
                type="button"
                onClick={validateAndSubmitRestock}
                className="w-full h-10 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
              <button
                type="button"
                onClick={() => setRestockTarget(null)}
                className="w-full h-10 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Added Success Modal ── */}
      {isAddedSuccessOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md" onClick={() => setIsAddedSuccessOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" strokeWidth={2} />
            <h3 className="mt-2 text-4xl font-bold text-gray-800">Added Successfully!</h3>
            <p className="mt-2 text-sm text-gray-600">{addSuccessMessage || 'Record has been successfully added.'}</p>
            <button type="button" onClick={() => setIsAddedSuccessOpen(false)} className="mt-5 h-9 w-28 rounded-lg bg-blue-600 text-sm font-semibold text-white">Done</button>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Restock Success Modal ── */}
      {showSuccess && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md" onClick={() => setShowSuccess(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <CheckCircle className="mx-auto h-14 w-14 text-green-500" strokeWidth={2} />
            <h3 className="mt-2 text-2xl font-bold text-gray-800">Request Created!</h3>
            <p className="mt-2 text-sm text-gray-600">Your restock request has been submitted successfully.</p>
            <button type="button" onClick={() => setShowSuccess(false)} className="mt-5 h-9 w-28 rounded-lg bg-green-600 text-sm font-semibold text-white">Done</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
