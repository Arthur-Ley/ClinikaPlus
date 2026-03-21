import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Pill, CheckCircle, Plus, Search, ChevronDown, CheckCircle2, Pencil, Layers, Package, Building2, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { createRestockRequest, loadRestockRequests, RESTOCK_REQUESTS_CHANGED_EVENT } from './restockRequestsStore';
import { emitGlobalSearchRefresh } from '../../context/globalSearchEvents';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';

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
}

interface InventoryRow {
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

// ─── API response types (replaces `any`) ────────────────────────────────────

type MedicationApiItem = {
  medication_id: number;
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
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ALERTS_PAGE_SIZE = 6;
const DEFAULT_PAGE_SIZE = 5;
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const formOptions = ['Tablet', 'Capsule', 'Pen', 'Syrup', 'Inhaler', 'Vial'] as const;
const unitOptions = ['pcs', 'pens', 'vials', 'bottles', 'inhalers', 'sachets'] as const;

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

  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null);
  const [isEditingMedication, setIsEditingMedication] = useState(false);
  const [isSavingMedicationEdit, setIsSavingMedicationEdit] = useState(false);
  const [medicationEditError, setMedicationEditError] = useState('');
  const [medicationDraft, setMedicationDraft] = useState({ name: '', category: '', form: '', strength: '', stock: '', reorder: '', supplier: '' });
  const [isAddMedicationOpen, setIsAddMedicationOpen] = useState(false);
  const [isAddedSuccessOpen, setIsAddedSuccessOpen] = useState(false);
  const [isSubmittingMedication, setIsSubmittingMedication] = useState(false);
  const [formError, setFormError] = useState('');
  const [categoryDropdown, setCategoryDropdown] = useState<CategoryOption[]>([]);
  const [supplierDropdown, setSupplierDropdown] = useState<SupplierOption[]>([]);
  const [restockSupplierDropdown, setRestockSupplierDropdown] = useState<SupplierOption[]>([]);
  const [newMedication, setNewMedication] = useState({ name: '', categoryId: '', form: 'Tablet', strength: '', unit: 'pcs', quantity: '', batch: '', reorder: '', expiry: '', supplierId: '' });

  const [restockTarget, setRestockTarget] = useState<InventoryAlert | null>(null);
  const [restockDetails, setRestockDetails] = useState({ supplier: '', quantity: '', neededBy: '', notes: '' });
  const [restockErrors, setRestockErrors] = useState({ supplier: '', quantity: '', neededBy: '' });
  const [createdRequests, setCreatedRequests] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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
        lastUpdated: formatDateDisplay(entry.last_updated),
        lastUpdatedIso: entry.last_updated,
      }));
      setItems(normalizedItems);
      setSelectedItem(prev => prev ? normalizedItems.find(r => r.id === prev.id) || null : null);

      setAlerts((alertRes.items || []).map((entry): InventoryAlert => ({
        id: entry.medication_key,
        name: entry.medication_name,
        category: entry.category_name,
        lowStock: entry.total_stock,
        expiry: entry.expiry_date || 'N/A',
        suggestedRestock: Math.max(entry.reorder_threshold - entry.total_stock, 0),
        unit: entry.unit,
        severity: entry.severity.toLowerCase() as Severity,
      })));

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
    if (!isAddMedicationOpen) return;
    let isMounted = true;
    setFormError('');
    async function loadDropdowns() {
      try {
        const [categoryRes, supplierRes] = await Promise.all([
          fetch(`${API_BASE_URL}/medications/categories`),
          fetch(`${API_BASE_URL}/medications/suppliers`),
        ]);
        if (!categoryRes.ok || !supplierRes.ok) throw new Error('Failed to load category/supplier data.');
        const categoryJson = (await categoryRes.json()) as { categories: CategoryOption[] };
        const supplierJson = (await supplierRes.json()) as { suppliers: SupplierOption[] };
        if (!isMounted) return;
        setCategoryDropdown(categoryJson.categories || []);
        setSupplierDropdown(supplierJson.suppliers || []);
        setNewMedication(prev => ({
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
    return () => { isMounted = false; };
  }, [isAddMedicationOpen]);

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
  const pagedAlerts = filteredAlerts.slice((alertPage - 1) * ALERTS_PAGE_SIZE, alertPage * ALERTS_PAGE_SIZE);
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
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / DEFAULT_PAGE_SIZE));
  const startIndex = (currentPage - 1) * DEFAULT_PAGE_SIZE;
  const pagedItems = filteredItems.slice(startIndex, startIndex + DEFAULT_PAGE_SIZE);

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
    setCurrentPage(Math.floor(targetIndex / DEFAULT_PAGE_SIZE) + 1);
    setTimeout(() => {
      const node = document.querySelector(`[data-search-medication-id="${focusMedicationId}"]`);
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        handledFocusIdRef.current = focusMedicationId;
      }
    }, 120);
  }, [focusMedicationId, filteredItems]);

  useEffect(() => {
    if (!openMedicationId || !items.length) return;
    const target = items.find(i => i.id === openMedicationId);
    if (target) setSelectedItem(target);
  }, [openMedicationId, items]);

  const openRestock = (alert: InventoryAlert) => {
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

  const selectedRestockSupplier = useMemo(
    () => restockSupplierDropdown.find((supplier) => String(supplier.supplier_id) === restockDetails.supplier) || null,
    [restockSupplierDropdown, restockDetails.supplier],
  );

  async function handleAddMedicationSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmittingMedication(true);
    setFormError('');
    try {
      const response = await fetch(`${API_BASE_URL}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
      const json = (await response.json()) as CreateMedicationResponse | { error: string };
      if (!response.ok) throw new Error('error' in json ? json.error : 'Failed to create medication.');
      setIsAddMedicationOpen(false);
      setIsAddedSuccessOpen(true);
      setNewMedication({ name: '', categoryId: String(categoryDropdown[0]?.category_id || ''), form: 'Tablet', strength: '', unit: 'pcs', quantity: '', batch: '', reorder: '', expiry: '', supplierId: String(supplierDropdown[0]?.supplier_id || '') });
      await loadData();
      emitGlobalSearchRefresh();
      setCurrentPage(1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create medication.');
    } finally {
      setIsSubmittingMedication(false);
    }
  }

  function openMedicationDetails(item: InventoryRow) {
    setSelectedItem(item);
    setIsEditingMedication(false);
    setMedicationDraft({ name: item.name, category: item.category, form: item.form || '', strength: item.strength || '', stock: String(item.stock), reorder: String(item.reorder), supplier: item.supplier });
  }

  function startEditingMedication() {
    if (!selectedItem) return;
    setMedicationEditError('');
    setMedicationDraft({ name: selectedItem.name, category: selectedItem.category, form: selectedItem.form || '', strength: selectedItem.strength || '', stock: String(selectedItem.stock), reorder: String(selectedItem.reorder), supplier: selectedItem.supplier });
    setIsEditingMedication(true);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medication_name: medicationDraft.name.trim(), category_name: medicationDraft.category.trim(), form: medicationDraft.form.trim(), strength: medicationDraft.strength.trim(), total_stock: nextStock, reorder_threshold: nextReorder, supplier_name: medicationDraft.supplier.trim() }),
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(json?.error || 'Failed to update medication.');
      await loadData();
      emitGlobalSearchRefresh();
      setIsEditingMedication(false);
    } catch (error) {
      setMedicationEditError(error instanceof Error ? error.message : 'Failed to update medication.');
    } finally {
      setIsSavingMedicationEdit(false);
    }
  }

  const restockItem = restockTarget ? items.find(i => i.id === restockTarget.id) : null;
  const showInitialSkeleton = isLoadingStocks && items.length === 0 && alerts.length === 0 && !stocksError;

  return (
    <div className="space-y-5">
      {showInitialSkeleton && <Skeleton />}

      {!showInitialSkeleton && (
        <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">

          {/* ── ALERTS ── */}
          <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">Priority Alerts ({filteredAlerts.length})</h2>
                {/* Fix 4: added type="button" */}
                <button type="button" className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-200 text-sm font-medium" onClick={loadData}>Refresh</button>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    className="w-full h-10 pl-9 pr-4 border border-gray-300 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Search alerts..."
                    value={alertSearchTerm}
                    onChange={e => setAlertSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
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
                </div>
              </div>
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 min-h-[200px] content-start">
              {visibleAlerts.map(alert => (
                <div
                  key={alert.id}
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
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-sm line-clamp-2 flex-1 mr-2">{alert.name}</h3>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${alert.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                      {alert.severity.toUpperCase()}
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
                      className="flex-1 py-1.5 px-3 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium text-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        openMedicationDetails(items.find(i => i.id === alert.id) || items[0]);
                      }}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-1.5 px-3 rounded-lg font-semibold text-sm ${createdRequests[alert.id] ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openRestock(alert);
                      }}
                      disabled={Boolean(createdRequests[alert.id])}
                    >
                      {createdRequests[alert.id] ? 'Requested' : 'Create Request'}
                    </button>
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
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-5">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search Medication"
                  className="w-full h-10 pl-9 pr-4 border border-gray-300 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  className="inline-flex h-10 items-center gap-2 whitespace-nowrap bg-green-600 pl-3 pr-4 py-1.5 text-sm text-white hover:bg-green-700"
                  onClick={() => { setFormError(''); setIsAddMedicationOpen(true); }}
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
                  {isLoadingStocks && Array.from({ length: 5 }).map((_, i) => (
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
                <button type="button" onClick={startEditingMedication} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"><Pencil size={14} /></button>
                <button type="button" onClick={() => { if (isSavingMedicationEdit) return; setSelectedItem(null); setIsEditingMedication(false); }} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"><X size={14} /></button>
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-white border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3"><Pill size={15} className="text-gray-400" /><span className="text-sm font-bold text-gray-700">Medication</span></div>
                <div className="space-y-2.5">
                  <div><p className="text-xs text-gray-400 mb-0.5">Medication Name</p>{isEditingMedication ? <input className="h-8 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.name} onChange={e => setMedicationDraft(p => ({ ...p, name: e.target.value }))} /> : <p className="text-sm font-bold text-gray-800">{selectedItem.name}</p>}</div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Category</p>{isEditingMedication ? <input className="h-8 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.category} onChange={e => setMedicationDraft(p => ({ ...p, category: e.target.value }))} /> : <p className="text-sm font-bold text-gray-800">{selectedItem.category}</p>}</div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Form</p>{isEditingMedication ? <input className="h-8 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.form} onChange={e => setMedicationDraft(p => ({ ...p, form: e.target.value }))} /> : <p className="text-sm font-bold text-gray-800">{selectedItem.form || 'N/A'}</p>}</div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Strength</p>{isEditingMedication ? <input className="h-8 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.strength} onChange={e => setMedicationDraft(p => ({ ...p, strength: e.target.value }))} /> : <p className="text-sm font-bold text-gray-800">{selectedItem.strength || 'N/A'}</p>}</div>
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
                  <div><p className="text-xs text-gray-400 mb-0.5">Supplier Name</p>{isEditingMedication ? <input className="h-8 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" value={medicationDraft.supplier} onChange={e => setMedicationDraft(p => ({ ...p, supplier: e.target.value }))} /> : <p className="text-sm font-bold text-gray-800">{selectedItem.supplier}</p>}</div>
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

      {/* ── Add Medication Modal ── */}
      {isAddMedicationOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md" onClick={() => setIsAddMedicationOpen(false)}>
          <form className="w-full max-w-[460px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={e => e.stopPropagation()} onSubmit={handleAddMedicationSubmit}>
            <div className="mb-4 flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-700"><Pill size={16} />Add Medication</h2>
              <button type="button" onClick={() => setIsAddMedicationOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600 hover:text-gray-700"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-700">Medication Name<input required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.name} onChange={e => setNewMedication(p => ({ ...p, name: e.target.value }))} /></label>
              <label className="text-sm text-gray-700">Category<select required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.categoryId} onChange={e => setNewMedication(p => ({ ...p, categoryId: e.target.value }))}><option value="">Select category</option>{categoryDropdown.map(c => <option key={c.category_id} value={String(c.category_id)}>{c.category_name}</option>)}</select></label>
              <label className="text-sm text-gray-700">Form<select required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.form} onChange={e => setNewMedication(p => ({ ...p, form: e.target.value }))}>{formOptions.map(o => <option key={o}>{o}</option>)}</select></label>
              <label className="text-sm text-gray-700">Strength<input required placeholder="e.g., 500mg" className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.strength} onChange={e => setNewMedication(p => ({ ...p, strength: e.target.value }))} /></label>
              <label className="text-sm text-gray-700">Unit<select required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.unit} onChange={e => setNewMedication(p => ({ ...p, unit: e.target.value }))}>{unitOptions.map(o => <option key={o}>{o}</option>)}</select></label>
              <label className="text-sm text-gray-700">Reorder Threshold<input type="number" required min={0} className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.reorder} onChange={e => setNewMedication(p => ({ ...p, reorder: e.target.value }))} /></label>
              <label className="text-sm text-gray-700">Batch Number<input required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.batch} onChange={e => setNewMedication(p => ({ ...p, batch: e.target.value }))} /></label>
              <label className="text-sm text-gray-700">Quantity<input type="number" required min={1} className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.quantity} onChange={e => setNewMedication(p => ({ ...p, quantity: e.target.value }))} /></label>
              <label className="text-sm text-gray-700">Expiry Date<input type="date" required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.expiry} onChange={e => setNewMedication(p => ({ ...p, expiry: e.target.value }))} /></label>
              <label className="text-sm text-gray-700 md:col-span-2">Supplier<select required className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm" value={newMedication.supplierId} onChange={e => setNewMedication(p => ({ ...p, supplierId: e.target.value }))}><option value="">Select supplier</option>{supplierDropdown.map(s => <option key={s.supplier_id} value={String(s.supplier_id)}>{s.supplier_name}</option>)}</select></label>
            </div>
            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
            <button type="submit" className="mt-5 h-9 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white disabled:opacity-60" disabled={isSubmittingMedication}>{isSubmittingMedication ? 'Saving...' : 'Add Medication'}</button>
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
            <p className="mt-2 text-sm text-gray-600">Medication record has been successfully added.</p>
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
