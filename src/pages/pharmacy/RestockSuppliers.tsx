import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
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
  Copy,
  Check,
  ClipboardList,
  Shield,
  CircleDot,
} from 'lucide-react';
import Button from '../../components/ui/Button.tsx';
import {
  loadRestockRequests,
  RESTOCK_REQUESTS_CHANGED_EVENT,
  updateRestockRequest,
  type RestockRequestSeverity,
  type RestockRequestStatus,
} from '../pharmacy/restockRequestsStore.ts';
import { useLocation } from 'react-router-dom';
import { emitGlobalSearchRefresh } from '../../context/globalSearchEvents';

type RequestSeverity = RestockRequestSeverity;
type RequestStatus = RestockRequestStatus;

type RestockRequest = {
  requestId: number;
  id: string;
  medicationId: string;
  medication: string;
  category: string;
  severity: RequestSeverity;
  quantity: number;
  unit: string;
  currentStock: number;
  threshold: number;
  requestedOn: string;
  requestedOnIso: string;
  supplierId: number;
  supplier: string;
  status: RequestStatus;
  neededBy: string;
  notes: string;
};

type SupplierStatus = 'Preferred' | 'Active' | 'Review';

type Supplier = {
  supplierId: number;
  id: string;
  name: string;
  totalRequests: number;
  completed: number;
  cancelled: number;
  status: SupplierStatus;
  contact?: string;
  email?: string;
  address?: string;
  avatarUrl?: string;
};

type SupplierApiRow = {
  supplier_id: number;
  supplier_name: string;
  email_address: string | null;
  contact_number: string | null;
  address: string | null;
  status: string;
  is_preferred: boolean;
  supplier_image: string | null;
};
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const DEFAULT_SUPPLIER_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22 viewBox=%220 0 160 160%22%3E%3Crect width=%22160%22 height=%22160%22 fill=%22%23E5E7EB%22/%3E%3Ccircle cx=%2280%22 cy=%2260%22 r=%2230%22 fill=%22%239CA3AF%22/%3E%3Cpath d=%22M30 136c6-24 24-38 50-38s44 14 50 38%22 fill=%22none%22 stroke=%22%239CA3AF%22 stroke-width=%2216%22 stroke-linecap=%22round%22/%3E%3C/svg%3E';

function formatDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function cardIconStyle(tone: 'blue' | 'amber') {
  return tone === 'blue'
    ? 'bg-blue-600/90 text-white'
    : 'bg-amber-500/90 text-white';
}

function RestockSuppliersSkeleton() {
  return (
    <section className="flex flex-col gap-5 rounded-2xl bg-gray-300/80 p-5 animate-pulse">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <article key={item} className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <div className="h-5 w-36 rounded bg-gray-300" />
              <div className="h-6 w-6 rounded-full bg-gray-300" />
            </div>
            <div className="mt-3 h-10 w-32 rounded bg-gray-300" />
            <div className="mt-2 h-4 w-44 rounded bg-gray-300" />
            <div className="mt-2 h-3 w-36 rounded bg-gray-300" />
          </article>
        ))}
      </div>

      <div className="order-2 rounded-2xl bg-gray-100 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="h-6 w-44 rounded bg-gray-300" />
          <div className="flex gap-2">
            <div className="h-10 w-28 rounded-lg bg-gray-300" />
            <div className="h-10 w-32 rounded-lg bg-gray-300" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {[1, 2, 3].map((col) => (
            <div key={col} className="rounded-xl border border-gray-300 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between border-b border-gray-300 pb-2">
                <div className="h-4 w-16 rounded bg-gray-300" />
                <div className="h-5 w-8 rounded-full bg-gray-300" />
              </div>
              <div className="space-y-2">
                <div className="h-16 rounded bg-gray-300" />
                <div className="h-16 rounded bg-gray-300" />
                <div className="h-8 rounded bg-gray-300" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="order-1 rounded-2xl bg-gray-100 p-4 md:p-5">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="h-6 w-40 rounded bg-gray-300" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-10 w-32 rounded-lg bg-gray-300" />
            <div className="h-10 w-28 rounded-lg bg-gray-300" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-9 w-full rounded bg-gray-300" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function RestockSuppliers() {
  const location = useLocation();
  const [requestSeverityFilter, setRequestSeverityFilter] = useState('All Severity');
  const [requestCategoryFilter, setRequestCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [supplierRows, setSupplierRows] = useState<Supplier[]>([]);
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState<
    'none' | 'add' | 'confirm' | 'success' | 'viewSupplier' | 'viewRequest' | 'editRequest' | 'cancelRequest'
  >('none');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RestockRequest | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [expandedStatusColumns, setExpandedStatusColumns] = useState<Record<RequestStatus, boolean>>({
    Completed: false,
    Pending: false,
    Cancelled: false,
  });
  const [draggingRequestId, setDraggingRequestId] = useState<number | null>(null);
  const [isCancelledDropActive, setIsCancelledDropActive] = useState(false);
  const [restockEdit, setRestockEdit] = useState({
    supplierId: '',
    quantity: '',
    neededBy: '',
    notes: '',
  });
  const [restockEditErrors, setRestockEditErrors] = useState({
    supplier: '',
    quantity: '',
    neededBy: '',
  });
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    status: '' as SupplierStatus | '',
    contact: '',
    email: '',
    address: '',
    avatarUrl: '',
  });
  const [formErrors, setFormErrors] = useState({
    name: '',
    status: '',
    contact: '',
    email: '',
    address: '',
  });
  const [newSupplierImageFile, setNewSupplierImageFile] = useState<File | null>(null);
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);
  const [isPhonePanelOpen, setIsPhonePanelOpen] = useState(false);
  const [isPhoneCopied, setIsPhoneCopied] = useState(false);
  const [focusHandledKey, setFocusHandledKey] = useState('');

  function resetNewSupplierForm() {
    setNewSupplier({
      name: '',
      status: '',
      contact: '',
      email: '',
      address: '',
      avatarUrl: '',
    });
    setFormErrors({
      name: '',
      status: '',
      contact: '',
      email: '',
      address: '',
    });
    setConfirmChecked(false);
    setNewSupplierImageFile(null);
    setIsSubmittingSupplier(false);
  }

  useEffect(() => {
    if (modal !== 'viewSupplier') {
      setIsPhonePanelOpen(false);
      setIsPhoneCopied(false);
    }
  }, [modal]);

  async function copySupplierPhone(phoneNumber: string) {
    if (!phoneNumber.trim()) return;
    try {
      await navigator.clipboard.writeText(phoneNumber.trim());
      setIsPhoneCopied(true);
      window.setTimeout(() => setIsPhoneCopied(false), 1200);
    } catch {
      setIsPhoneCopied(false);
    }
  }

  const syncRestockRequests = useCallback(async () => {
    const mappedRequests: RestockRequest[] = (await loadRestockRequests())
      .map((request) => ({
        ...request,
        requestedOn: formatDateLabel(request.requestedOnIso),
      }))
      .sort((a, b) => new Date(b.requestedOnIso).getTime() - new Date(a.requestedOnIso).getTime());
    setRestockRequests(mappedRequests);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError('');

    async function loadData() {
      try {
        const suppliersRes = await fetch(`${API_BASE_URL}/suppliers`);
        if (!suppliersRes.ok) {
          throw new Error('Failed to load supplier records.');
        }

        const suppliersJson = (await suppliersRes.json()) as { suppliers: SupplierApiRow[] };
        if (!isMounted) return;

        const mappedSuppliers: Supplier[] = (suppliersJson.suppliers || []).map((supplier) => {
          const resolvedStatus: SupplierStatus =
            supplier.is_preferred ? 'Preferred' : supplier.status === 'Active' ? 'Active' : 'Review';

          return {
            id: `SUP-${String(supplier.supplier_id).padStart(3, '0')}`,
            supplierId: supplier.supplier_id,
            name: supplier.supplier_name,
            totalRequests: 0,
            completed: 0,
            cancelled: 0,
            status: resolvedStatus,
            contact: supplier.contact_number || '',
            email: supplier.email_address || '',
            address: supplier.address || '',
            avatarUrl: supplier.supplier_image || DEFAULT_SUPPLIER_AVATAR,
          };
        });

        setSupplierRows(mappedSuppliers);
        await syncRestockRequests();
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load data.');
        setSupplierRows([]);
        setRestockRequests([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [syncRestockRequests]);

  useEffect(() => {
    function handleRestockRequestsChanged() {
      syncRestockRequests().catch((error) => {
        setLoadError(error instanceof Error ? error.message : 'Failed to refresh restock requests.');
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(RESTOCK_REQUESTS_CHANGED_EVENT, handleRestockRequestsChanged);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(RESTOCK_REQUESTS_CHANGED_EVENT, handleRestockRequestsChanged);
      }
    };
  }, [syncRestockRequests]);

  const requestCategories = useMemo(() => {
    const categories = Array.from(new Set(restockRequests.map((request) => request.category)));
    categories.sort((a, b) => a.localeCompare(b));
    return categories;
  }, [restockRequests]);

  const filteredRestockRequests = useMemo(() => {
    const severityRank: Record<RequestSeverity, number> = {
      Critical: 0,
      Warning: 1,
    };

    return restockRequests
      .filter((request) => {
        const matchesSeverity = requestSeverityFilter === 'All Severity' || request.severity === requestSeverityFilter;
        const matchesCategory = requestCategoryFilter === 'All Categories' || request.category === requestCategoryFilter;
        return matchesSeverity && matchesCategory;
      })
      .sort((a, b) => {
        const severityDiff = severityRank[a.severity] - severityRank[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.requestedOnIso).getTime() - new Date(a.requestedOnIso).getTime();
      });
  }, [restockRequests, requestSeverityFilter, requestCategoryFilter]);

  useEffect(() => {
    setExpandedStatusColumns({
      Completed: false,
      Pending: false,
      Cancelled: false,
    });
  }, [requestSeverityFilter, requestCategoryFilter]);

  const requestsByStatus = useMemo(() => {
    return {
      Completed: filteredRestockRequests.filter((request) => request.status === 'Completed'),
      Pending: filteredRestockRequests.filter((request) => request.status === 'Pending'),
      Cancelled: filteredRestockRequests.filter((request) => request.status === 'Cancelled'),
    } as const;
  }, [filteredRestockRequests]);

  const pendingRequests = useMemo(
    () => restockRequests.filter((request) => request.status === 'Pending'),
    [restockRequests],
  );
  const uniquePendingRequests = useMemo(() => {
    const latestByMedication = new Map<string, RestockRequest>();
    pendingRequests.forEach((request) => {
      const existing = latestByMedication.get(request.medicationId);
      if (!existing || new Date(request.requestedOnIso).getTime() > new Date(existing.requestedOnIso).getTime()) {
        latestByMedication.set(request.medicationId, request);
      }
    });
    return Array.from(latestByMedication.values());
  }, [pendingRequests]);
  const criticalNeedsCount = useMemo(
    () => uniquePendingRequests.filter((request) => request.severity === 'Critical').length,
    [uniquePendingRequests],
  );
  const pendingRequestsCount = useMemo(
    () => uniquePendingRequests.length,
    [uniquePendingRequests],
  );
  const oldestPendingDate = useMemo(() => {
    if (uniquePendingRequests.length === 0) return 'N/A';
    const oldestPending = uniquePendingRequests.slice().sort((a, b) => new Date(a.requestedOnIso).getTime() - new Date(b.requestedOnIso).getTime())[0];
    return oldestPending.requestedOn;
  }, [uniquePendingRequests]);
  const mostUrgentMedication = useMemo(() => {
    if (uniquePendingRequests.length === 0) return 'N/A';
    return uniquePendingRequests
      .slice()
      .sort((a, b) => a.currentStock - b.currentStock)[0].medication;
  }, [uniquePendingRequests]);
  const activeSuppliersCount = useMemo(
    () => supplierRows.filter((supplier) => supplier.status === 'Active' || supplier.status === 'Preferred').length,
    [supplierRows],
  );
  const preferredSupplier = useMemo(
    () => supplierRows.find((supplier) => supplier.status === 'Preferred')?.name || 'N/A',
    [supplierRows],
  );

  const supplierRequestStats = useMemo(() => {
    return restockRequests.reduce<Record<number, { total: number; completed: number; cancelled: number }>>((acc, request) => {
      if (!acc[request.supplierId]) {
        acc[request.supplierId] = { total: 0, completed: 0, cancelled: 0 };
      }
      acc[request.supplierId].total += 1;
      if (request.status === 'Completed') acc[request.supplierId].completed += 1;
      if (request.status === 'Cancelled') acc[request.supplierId].cancelled += 1;
      return acc;
    }, {});
  }, [restockRequests]);

  const alignedSuppliers = useMemo(() => {
    return supplierRows.map((supplier) => {
      const stats = supplierRequestStats[supplier.supplierId] || { total: 0, completed: 0, cancelled: 0 };
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

  const focusRequestCode = useMemo(() => new URLSearchParams(location.search).get('focusRequestCode') || '', [location.search]);
  const focusSupplierId = useMemo(() => new URLSearchParams(location.search).get('focusSupplierId') || '', [location.search]);

  useEffect(() => {
    if (!focusRequestCode) return;
    if (focusHandledKey === `request:${focusRequestCode}`) return;

    const target = restockRequests.find((request) => request.id === focusRequestCode);
    if (!target) return;

    setRequestSeverityFilter('All Severity');
    setRequestCategoryFilter('All Categories');
    setStatusFilter('All Status');

    setTimeout(() => {
      const node = document.querySelector(`[data-search-request-code="${focusRequestCode}"]`);
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setExpandedRequestId(focusRequestCode);
        setFocusHandledKey(`request:${focusRequestCode}`);
      }
    }, 120);
  }, [focusRequestCode, restockRequests, focusHandledKey]);

  useEffect(() => {
    if (!focusSupplierId) return;
    if (focusHandledKey === `supplier:${focusSupplierId}`) return;

    setStatusFilter('All Status');
    setTimeout(() => {
      const node = document.querySelector(`[data-search-supplier-id="${focusSupplierId}"]`);
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFocusHandledKey(`supplier:${focusSupplierId}`);
      }
    }, 120);
  }, [focusSupplierId, displayedSuppliers, focusHandledKey]);

  const selectedSupplierRequests = useMemo(() => {
    if (!selectedSupplier) return [];
    return restockRequests
      .filter(
        (request) =>
          request.supplierId === selectedSupplier.supplierId || request.supplier === selectedSupplier.name,
      )
      .sort((a, b) => new Date(b.requestedOnIso).getTime() - new Date(a.requestedOnIso).getTime());
  }, [restockRequests, selectedSupplier]);
  const showInitialSkeleton = isLoading && supplierRows.length === 0 && restockRequests.length === 0 && !loadError;

  const frequentSupplierMedications = useMemo(() => {
    const grouped = selectedSupplierRequests.reduce<Record<string, number>>((acc, request) => {
      acc[request.medication] = (acc[request.medication] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([medication]) => medication);
  }, [selectedSupplierRequests]);

  const recentSupplierHistory = useMemo(() => {
    return selectedSupplierRequests.slice(0, 7);
  }, [selectedSupplierRequests]);

  function statusCardClass(status: RequestStatus) {
    if (status === 'Completed') return 'border-[#22C55E] bg-[#22C55E]/15';
    if (status === 'Pending') return 'border-[#F59E0B] bg-[#F59E0B]/15';
    return 'border-[#EF4444] bg-[#EF4444]/15';
  }

  function statusAccentClass(status: RequestStatus) {
    if (status === 'Completed') return 'text-[#22C55E]';
    if (status === 'Pending') return 'text-[#F59E0B]';
    return 'text-[#EF4444]';
  }

  function statusButtonClass(status: RequestStatus) {
    if (status === 'Completed') return 'bg-[#22C55E] hover:bg-[#16A34A]';
    if (status === 'Pending') return 'bg-[#F59E0B] hover:bg-[#D97706]';
    return 'bg-[#EF4444] hover:bg-[#DC2626]';
  }

  function supplierStatusBadgeClass(status: SupplierStatus) {
    if (status === 'Preferred') return 'bg-[#22C55E]/15 text-[#22C55E]';
    if (status === 'Active') return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
  }

  function tableStatusChipClass(status: RequestStatus) {
    if (status === 'Completed') return 'bg-[#22C55E]/20 text-[#16A34A]';
    if (status === 'Pending') return 'bg-[#F59E0B]/20 text-[#B45309]';
    return 'bg-[#EF4444]/20 text-[#B91C1C]';
  }

  function openViewRequest(request: RestockRequest) {
    setSelectedRequest(request);
    setModal('viewRequest');
  }

  function openAdjustRequest(request: RestockRequest) {
    setSelectedRequest(request);
    setRestockEdit({
      supplierId: String(request.supplierId),
      quantity: String(request.quantity),
      neededBy: request.neededBy,
      notes: request.notes,
    });
    setRestockEditErrors({
      supplier: '',
      quantity: '',
      neededBy: '',
    });
    setModal('editRequest');
  }

  async function saveAdjustedRequest() {
    if (!selectedRequest) return;

    const supplierId = Number(restockEdit.supplierId);
    const nextErrors = {
      supplier: Number.isInteger(supplierId) && supplierId > 0 ? '' : 'Supplier is required.',
      quantity: Number(restockEdit.quantity) > 0 ? '' : 'Quantity must be greater than 0.',
      neededBy: restockEdit.neededBy ? '' : 'Needed-by date is required.',
    };
    setRestockEditErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    try {
      await updateRestockRequest(selectedRequest.requestId, {
        supplierId,
        quantity: Number(restockEdit.quantity),
        neededBy: restockEdit.neededBy,
        notes: restockEdit.notes,
      });
      await syncRestockRequests();
      setModal('none');
      setSelectedRequest(null);
    } catch (error) {
      setRestockEditErrors((prev) => ({
        ...prev,
        supplier: error instanceof Error ? error.message : 'Failed to update restock request.',
      }));
    }
  }

  function openCancelRequest(request: RestockRequest) {
    setSelectedRequest(request);
    setModal('cancelRequest');
  }

  async function confirmCancelRequest() {
    if (!selectedRequest) return;

    try {
      await updateRestockRequest(selectedRequest.requestId, { status: 'Cancelled' });
      await syncRestockRequests();
      setModal('none');
      setSelectedRequest(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to cancel request.');
    }
  }

  async function markRequestAsCompleted() {
    if (!selectedRequest) return;

    try {
      await updateRestockRequest(selectedRequest.requestId, { status: 'Completed' });
      await syncRestockRequests();
      setModal('none');
      setSelectedRequest(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to complete request.');
    }
  }

  async function movePendingRequestToCancelled(requestId: number) {
    try {
      await updateRestockRequest(requestId, { status: 'Cancelled' });
      await syncRestockRequests();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to cancel request.');
    }
  }

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

  async function handleConfirmSupplier() {
    if (!confirmChecked || !newSupplier.status || isSubmittingSupplier) return;

    setIsSubmittingSupplier(true);
    try {
      let supplierImageUrl = '';
      if (newSupplierImageFile) {
        const fileName = `${Date.now()}-${newSupplierImageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const path = `suppliers/${fileName}`;
        const signedUrlRes = await fetch(`${API_BASE_URL}/storage/signed-upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bucket: 'supplier-photos',
            path,
          }),
        });
        const signedJson = (await signedUrlRes.json().catch(() => null)) as { signedUrl?: string; publicUrl?: string; error?: string } | null;
        if (!signedUrlRes.ok || !signedJson?.signedUrl) {
          throw new Error(signedJson?.error || 'Failed to create upload URL for supplier image.');
        }

        const uploadRes = await fetch(signedJson.signedUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': newSupplierImageFile.type || 'application/octet-stream',
          },
          body: newSupplierImageFile,
        });
        if (!uploadRes.ok) {
          throw new Error('Failed to upload supplier image.');
        }
        supplierImageUrl = signedJson.publicUrl || '';
      }

      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplier_name: newSupplier.name.trim(),
          status: newSupplier.status,
          contact_number: newSupplier.contact.trim(),
          email_address: newSupplier.email.trim(),
          address: newSupplier.address.trim(),
          supplier_image: supplierImageUrl || null,
        }),
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(json?.error || 'Failed to create supplier.');
      }

      const suppliersRes = await fetch(`${API_BASE_URL}/suppliers`);
      if (!suppliersRes.ok) {
        throw new Error('Supplier created, but failed to refresh supplier list.');
      }
      const suppliersJson = (await suppliersRes.json()) as { suppliers: SupplierApiRow[] };
      const refreshed: Supplier[] = (suppliersJson.suppliers || []).map((supplier) => {
        const resolvedStatus: SupplierStatus =
          supplier.is_preferred ? 'Preferred' : supplier.status === 'Active' ? 'Active' : 'Review';
        return {
          id: `SUP-${String(supplier.supplier_id).padStart(3, '0')}`,
          supplierId: supplier.supplier_id,
          name: supplier.supplier_name,
          totalRequests: 0,
          completed: 0,
          cancelled: 0,
          status: resolvedStatus,
          contact: supplier.contact_number || '',
          email: supplier.email_address || '',
          address: supplier.address || '',
          avatarUrl: supplier.supplier_image || DEFAULT_SUPPLIER_AVATAR,
        };
      });
      setSupplierRows(refreshed);
      emitGlobalSearchRefresh();
      setModal('success');
      resetNewSupplierForm();
    } catch (error) {
      setFormErrors((prev) => ({
        ...prev,
        name: error instanceof Error ? error.message : 'Failed to create supplier.',
      }));
    } finally {
      setIsSubmittingSupplier(false);
    }
  }

  function handleSupplierImageChange(file: File | null) {
    if (!file) {
      setNewSupplier((prev) => ({ ...prev, avatarUrl: '' }));
      setNewSupplierImageFile(null);
      return;
    }
    setNewSupplierImageFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setNewSupplier((prev) => ({ ...prev, avatarUrl: result }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-5">
      {showInitialSkeleton && <RestockSuppliersSkeleton />}

      {!showInitialSkeleton && (
      <section className="flex flex-col gap-5 rounded-2xl bg-gray-300/80 p-5">
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
            <p className="mt-3 text-4xl font-bold text-amber-500">{pendingRequestsCount} medications</p>
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
              {(['Completed', 'Pending', 'Cancelled'] as RequestStatus[]).map((status) => {
                const statusRequests = requestsByStatus[status];
                const canCollapse = statusRequests.length > 3;
                const visibleRequests = expandedStatusColumns[status]
                  ? statusRequests
                  : statusRequests.slice(0, 3);

                return (
                <section
                  key={status}
                  className={`rounded-xl border p-3 ${status === 'Cancelled' && isCancelledDropActive ? 'border-[#EF4444] bg-[#FEE2E2]' : 'border-gray-300 bg-gray-50'}`}
                  onDragOver={(event) => {
                    if (status !== 'Cancelled' || draggingRequestId === null) return;
                    event.preventDefault();
                    setIsCancelledDropActive(true);
                  }}
                  onDragLeave={() => {
                    if (status === 'Cancelled') {
                      setIsCancelledDropActive(false);
                    }
                  }}
                  onDrop={async (event) => {
                    if (status !== 'Cancelled') return;
                    event.preventDefault();
                    const draggedId = Number(event.dataTransfer.getData('text/plain'));
                    setIsCancelledDropActive(false);
                    setDraggingRequestId(null);
                    if (!Number.isInteger(draggedId) || draggedId <= 0) return;

                    const draggedRequest = restockRequests.find((request) => request.requestId === draggedId);
                    if (!draggedRequest || draggedRequest.status !== 'Pending') return;

                    await movePendingRequestToCancelled(draggedId);
                  }}
                >
                  <div className="mb-2 flex items-center justify-between border-b border-gray-300 pb-2">
                    <h3 className="text-sm font-semibold text-gray-700">{status}</h3>
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                      {statusRequests.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {visibleRequests.map((request) => (
                      <article
                        key={request.id}
                        data-search-request-code={request.id}
                        draggable={request.status === 'Pending'}
                        onDragStart={(event) => {
                          if (request.status !== 'Pending') return;
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', String(request.requestId));
                          setDraggingRequestId(request.requestId);
                        }}
                        onDragEnd={() => {
                          setDraggingRequestId(null);
                          setIsCancelledDropActive(false);
                        }}
                        className={`rounded-lg border p-3 text-sm ${statusCardClass(request.status)} ${request.status === 'Pending' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className={`flex items-center gap-1 ${statusAccentClass(request.status)}`}>
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
                            className={`rounded-md px-2 py-1 text-xs font-semibold text-white ${statusButtonClass(request.status)}`}
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
                              <p className={statusAccentClass(request.status)}>
                                Status: {request.status}
                              </p>
                            </div>
                            <div className={`mt-3 flex flex-wrap items-center gap-4 text-sm ${statusAccentClass(request.status)}`}>
                              <button type="button" className="hover:opacity-80" onClick={() => openViewRequest(request)}>
                                View Stock Request
                              </button>
                              {request.status === 'Pending' && (
                                <button type="button" className="hover:opacity-80" onClick={() => openAdjustRequest(request)}>
                                  Adjust Restock
                                </button>
                              )}
                              {request.status === 'Pending' && (
                                <button type="button" className="hover:opacity-80" onClick={() => openCancelRequest(request)}>
                                  Cancel
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </article>
                    ))}
                    {visibleRequests.length === 0 && (
                      <article className="rounded-lg border border-gray-300 bg-white p-3 text-xs text-gray-600">
                        No {status.toLowerCase()} requests.
                      </article>
                    )}
                    {canCollapse && (
                      <button
                        type="button"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                        onClick={() =>
                          setExpandedStatusColumns((prev) => ({
                            ...prev,
                            [status]: !prev[status],
                          }))
                        }
                      >
                        {expandedStatusColumns[status] ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                </section>
              )})}
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
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-500" />
              <h2 className="text-xl font-semibold text-gray-700">Supplier Table</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Button
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap bg-green-500 pl-3 pr-4 py-1.5 text-sm hover:bg-green-600"
                onClick={() => {
                  resetNewSupplierForm();
                  setModal('add');
                }}
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
                  <tr key={supplier.id} data-search-supplier-id={String(supplier.supplierId)} className="border-t border-gray-200 hover:bg-gray-200/40">
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
                          setModal('viewSupplier');
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
      )}

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
              <button type="button" onClick={() => {
                setModal('none');
                setIsSubmittingSupplier(false);
              }} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600">
                <X size={14} />
              </button>
            </div>

            <div className="mb-4 flex justify-center">
              <div className="relative h-28 w-28">
                <img
                  src={newSupplier.avatarUrl || DEFAULT_SUPPLIER_AVATAR}
                  alt="Supplier profile preview"
                  className="h-28 w-28 rounded-full border border-gray-300 object-cover"
                />
                <div className="absolute bottom-1 right-1 rounded-full bg-gray-200 p-1.5 text-blue-600">
                  <ImagePlus size={14} />
                </div>
              </div>
            </div>

            <div className="mb-3 border-b border-gray-300" />

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <label className="text-sm text-gray-700 md:col-span-2">
                <span className="mb-1 inline-flex items-center gap-1"><ImagePlus size={14} /> Supplier Image (Optional)</span>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-transparent px-3 py-1.5 text-sm text-gray-700 file:mr-3 file:h-8 file:rounded-md file:border file:border-gray-300 file:bg-gray-200 file:px-3 file:text-sm file:font-medium file:text-gray-700"
                  onChange={(e) => handleSupplierImageChange(e.target.files?.[0] || null)}
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 inline-flex items-center gap-1"><Building2 size={14} /> Supplier Name</span>
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
              <img
                src={newSupplier.avatarUrl || DEFAULT_SUPPLIER_AVATAR}
                alt="Supplier profile preview"
                className="h-28 w-28 rounded-full border border-gray-300 object-cover"
              />
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
              disabled={!confirmChecked || isSubmittingSupplier}
            >
              {isSubmittingSupplier ? 'Saving...' : 'Confirm and Save Supplier'}
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

      {modal === 'viewRequest' && selectedRequest && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setModal('none')}>
          <div className="w-full max-w-[520px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="text-xl font-semibold text-gray-800">Stock Request Details</h2>
              <button type="button" onClick={() => setModal('none')} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1.5 text-sm text-gray-800">
              <p><span className="font-semibold">Request ID:</span> {selectedRequest.id}</p>
              <p><span className="font-semibold">Medication:</span> {selectedRequest.medication}</p>
              <p><span className="font-semibold">Category:</span> {selectedRequest.category}</p>
              <p><span className="font-semibold">Severity:</span> {selectedRequest.severity}</p>
              <p><span className="font-semibold">Quantity:</span> {selectedRequest.quantity} {selectedRequest.unit}</p>
              <p><span className="font-semibold">Stock / Threshold:</span> {selectedRequest.currentStock} {selectedRequest.unit} / {selectedRequest.threshold} {selectedRequest.unit}</p>
              <p><span className="font-semibold">Supplier:</span> {selectedRequest.supplier}</p>
              <p><span className="font-semibold">Requested On:</span> {selectedRequest.requestedOn}</p>
              <p><span className="font-semibold">Needed By:</span> {selectedRequest.neededBy || 'N/A'}</p>
              <p><span className="font-semibold">Status:</span> <span className={statusAccentClass(selectedRequest.status)}>{selectedRequest.status}</span></p>
              <p><span className="font-semibold">Notes:</span> {selectedRequest.notes || 'N/A'}</p>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              {selectedRequest.status === 'Pending' && (
                <button
                  type="button"
                  onClick={markRequestAsCompleted}
                  className="h-9 rounded-lg bg-[#22C55E] px-4 text-sm font-semibold text-white hover:bg-[#16A34A]"
                >
                  Mark as Completed
                </button>
              )}
              <button
                type="button"
                onClick={() => setModal('none')}
                className="h-9 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'editRequest' && selectedRequest && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setModal('none')}>
          <div className="w-full max-w-[520px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="text-xl font-semibold text-gray-800">Adjust Restock Request</h2>
              <button type="button" onClick={() => setModal('none')} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600">
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-700 md:col-span-2">
                Supplier
                <select
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={restockEdit.supplierId}
                  onChange={(e) => setRestockEdit((prev) => ({ ...prev, supplierId: e.target.value }))}
                >
                  <option value="">Select supplier</option>
                  {supplierRows.map((supplier) => (
                    <option key={supplier.id} value={String(supplier.supplierId)}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                {restockEditErrors.supplier && <p className="mt-1 text-xs text-red-500">{restockEditErrors.supplier}</p>}
              </label>

              <label className="text-sm text-gray-700">
                Quantity ({selectedRequest.unit})
                <input
                  type="number"
                  min={1}
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={restockEdit.quantity}
                  onChange={(e) => setRestockEdit((prev) => ({ ...prev, quantity: e.target.value }))}
                />
                {restockEditErrors.quantity && <p className="mt-1 text-xs text-red-500">{restockEditErrors.quantity}</p>}
              </label>

              <label className="text-sm text-gray-700">
                Needed By
                <input
                  type="date"
                  className="mt-1 h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm"
                  value={restockEdit.neededBy}
                  onChange={(e) => setRestockEdit((prev) => ({ ...prev, neededBy: e.target.value }))}
                />
                {restockEditErrors.neededBy && <p className="mt-1 text-xs text-red-500">{restockEditErrors.neededBy}</p>}
              </label>

              <label className="text-sm text-gray-700 md:col-span-2">
                Notes (Optional)
                <textarea
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm"
                  rows={3}
                  value={restockEdit.notes}
                  onChange={(e) => setRestockEdit((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </label>
            </div>

            <button type="button" onClick={saveAdjustedRequest} className="mt-4 h-10 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
              Save Changes
            </button>
          </div>
        </div>
      )}

      {modal === 'cancelRequest' && selectedRequest && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setModal('none')}>
          <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-gray-800">Cancel Request?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will mark <span className="font-semibold text-gray-800">{selectedRequest.id}</span> as Cancelled.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setModal('none')} className="h-9 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700">
                Keep Pending
              </button>
              <button type="button" onClick={confirmCancelRequest} className="h-9 rounded-lg bg-[#EF4444] px-4 text-sm font-semibold text-white hover:bg-[#DC2626]">
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'viewSupplier' && selectedSupplier && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={() => setModal('none')}>
          <div className="w-full max-w-[760px] rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between border-b border-gray-300 pb-3">
              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-gray-300 bg-white text-base font-bold text-blue-600">
                  {selectedSupplier.name
                    .split(' ')
                    .map((namePart) => namePart[0] || '')
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{selectedSupplier.name}</h3>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${supplierStatusBadgeClass(selectedSupplier.status)}`}>
                    {selectedSupplier.status}
                  </span>
                </div>
              </div>

              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  title={selectedSupplier.contact?.trim() || 'No phone number available'}
                  onClick={() => setIsPhonePanelOpen((prev) => !prev)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-600 transition hover:bg-gray-300 hover:text-gray-800"
                >
                  <Phone className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={selectedSupplier.email?.trim() || 'No email address available'}
                  onClick={() => {
                    const email = selectedSupplier.email?.trim();
                    if (!email) return;
                    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
                    window.open(gmailComposeUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-600 transition hover:bg-gray-300 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedSupplier.email?.trim()}
                >
                  <Mail className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={selectedSupplier.address?.trim() || 'No address available'}
                  onClick={() => {
                    const address = selectedSupplier.address?.trim();
                    if (!address) return;
                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-600 transition hover:bg-gray-300 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!selectedSupplier.address?.trim()}
                >
                  <MapPin className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setModal('none')} className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-gray-600">
                  <X size={14} />
                </button>

                {isPhonePanelOpen && (
                  <div className="absolute right-8 top-8 z-10 w-64 rounded-lg border border-gray-300 bg-white p-2.5 shadow-lg">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Phone Number</p>
                    <div className="flex items-center gap-1.5">
                      <input
                        readOnly
                        value={selectedSupplier.contact?.trim() || 'No phone number available'}
                        className="h-8 w-full rounded-md border border-gray-300 bg-gray-50 px-2 text-xs text-gray-700"
                        onFocus={(event) => event.currentTarget.select()}
                      />
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => copySupplierPhone(selectedSupplier.contact || '')}
                        disabled={!selectedSupplier.contact?.trim()}
                        title={selectedSupplier.contact?.trim() ? 'Copy phone number' : 'No phone number available'}
                      >
                        {isPhoneCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-gray-300 pb-3 text-sm md:grid-cols-4">
              <div>
                <p className="text-gray-500">Total Requests</p>
                <p className="font-semibold text-gray-800">{selectedSupplier.totalRequests}</p>
              </div>
              <div>
                <p className="text-gray-500">Completed</p>
                <p className="font-semibold text-gray-800">{selectedSupplier.completed}</p>
              </div>
              <div>
                <p className="text-gray-500">Cancelled</p>
                <p className="font-semibold text-gray-800">{selectedSupplier.cancelled}</p>
              </div>
              <div>
                <p className="text-gray-500">Pending</p>
                <p className="font-semibold text-gray-800">
                  {Math.max(0, selectedSupplier.totalRequests - selectedSupplier.completed - selectedSupplier.cancelled)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[230px_1fr]">
              <section className="rounded-xl border border-gray-300 bg-white p-3">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Shield className="h-4 w-4 text-gray-500" />
                  Frequently Supplied Medication
                </h4>
                <div className="space-y-2 text-sm text-gray-800">
                  {frequentSupplierMedications.length > 0 ? (
                    frequentSupplierMedications.map((medication) => (
                      <p key={medication} className="flex items-center gap-2">
                        <CircleDot className="h-3.5 w-3.5 text-blue-500" />
                        {medication}
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">No supplied medications yet.</p>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-gray-300 bg-white p-3">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <ClipboardList className="h-4 w-4 text-gray-500" />
                  Recent Procurement History
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed text-xs">
                    <thead className="text-gray-500">
                      <tr>
                        <th className="w-[30%] px-1 py-1 text-left font-semibold">Date</th>
                        <th className="w-[42%] px-1 py-1 text-left font-semibold">Medication</th>
                        <th className="w-[28%] px-1 py-1 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSupplierHistory.length > 0 ? (
                        recentSupplierHistory.map((request) => (
                          <tr key={`${request.id}-${request.requestedOnIso}`} className="border-t border-gray-200 text-gray-700">
                            <td className="px-1 py-1.5">{request.requestedOnIso.slice(0, 10)}</td>
                            <td className="px-1 py-1.5">{request.medication}</td>
                            <td className="px-1 py-1.5">
                              <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${tableStatusChipClass(request.status)}`}>
                                {request.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-1 py-2 text-gray-500">
                            No procurement history available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
