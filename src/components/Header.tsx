import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bell, Search, Settings, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGlobalSearchData } from '../context/GlobalSearchDataContext.tsx';
import { useBillingPayments } from '../context/useBillingPayments.ts';
import { getAuthSession, getCurrentUser, type LoginResponse } from '../services/authApi';
import NotificationPanel from './notifications/NotificationPanel.tsx';
import {
  loadNotificationFeed,
  loadNotificationSummary,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotification,
  type NotificationItem,
  type NotificationSummary,
} from '../services/notificationsApi.ts';

type NavigationEntry = {
  id: string;
  label: string;
  path: string;
  keywords: string[];
};

type SearchResult = {
  id: string;
  section: 'navigation' | 'inventory' | 'billing';
  entityType?: 'medication' | 'alert' | 'request' | 'supplier' | 'bill' | 'transaction';
  label: string;
  sublabel?: string;
  status?: string;
  path: string;
  query?: string;
  score: number;
};

const NAVIGATION_ENTRIES: NavigationEntry[] = [
{ id: 'nav-pharmacy-inventory', label: 'Pharmacy Inventory', path: '/pharmacy/inventory', keywords: ['stocks', 'inventory', 'medicines', 'medication', 'alerts', 'warnings'] },
  { id: 'nav-restock-requests', label: 'Restock Requests', path: '/pharmacy/restock', keywords: ['restock', 'requests', 'purchase', 'order'] },
  { id: 'nav-suppliers', label: 'Suppliers', path: '/pharmacy/restock', keywords: ['suppliers', 'vendor', 'pharma'] },
  { id: 'nav-billing', label: 'Billing & Payments', path: '/billing', keywords: ['billing', 'bills', 'charges', 'invoice'] },
  { id: 'nav-payments', label: 'Payments', path: '/billing/payments', keywords: ['payments', 'cash', 'gcash', 'maya'] },
  { id: 'nav-transactions', label: 'Transactions', path: '/billing/transactions', keywords: ['transactions', 'receipt', 'history', 'audit trail'] },
  { id: 'nav-revenue', label: 'Revenue Reports', path: '/billing/reports', keywords: ['revenue', 'reports', 'analytics', 'finance'] },

];

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function safeLower(value: string | null | undefined) {
  return String(value || '').toLowerCase();
}

function formatDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || 'N/A';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textMatchScore(text: string, query: string) {
  const target = safeLower(text);
  if (!target || !query) return 0;
  if (target === query) return 10;
  if (target.startsWith(query)) return 7;
  if (target.includes(query)) return 4;
  return 0;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function highlight(text: string, query: string): ReactNode {
  if (!query.trim()) return text;
  const reg = new RegExp(`(${escapeRegex(query)})`, 'ig');
  const parts = text.split(reg);
  if (parts.length === 1) return text;
  const normalizedQuery = query.toLowerCase();
  return (
    <>
      {parts.map((part, index) => (
        part.toLowerCase() === normalizedQuery ? (
          <mark key={`${part}-${index}`} className="rounded bg-amber-200 px-0.5 text-gray-900">{part}</mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      ))}
    </>
  );
}

function getPageTitle(pathname: string) {
  if (pathname === '/' || pathname.startsWith('/dashboard')) return 'Overview';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/notifications')) return 'Notifications';
  if (pathname.startsWith('/pharmacy/inventory') || pathname.startsWith('/inventory')) {
    return 'Pharmacy | Inventory & Alerts';
  }
  if (pathname.startsWith('/pharmacy/restock') || pathname.startsWith('/restock') || pathname.startsWith('/suppliers')) {
  return 'Pharmacy | Restock & Suppliers';
  }
  if (pathname.startsWith('/billing/reports') || pathname.startsWith('/reports')) {
  return 'Billing & Reports | Reports';
  }
  if (pathname.startsWith('/billing/transactions') || pathname.startsWith('/transactions')) {
    return 'Billing & Reports | Transactions';
  }
  if (pathname.startsWith('/billing')) return 'Billing & Reports | Billing & Payments';
  return 'Overview';
}

function isUnresolved(status: NotificationItem['status']) {
  return status === 'Active' || status === 'InProgress';
}

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const { medications, alerts, restockRequests, suppliers, transactions, isLoading: searchLoading } = useGlobalSearchData();
  const { billingRecords, isLoading: billingLoading } = useBillingPayments();
  const authSession = useMemo(() => getAuthSession(), []);
  const [currentUser, setCurrentUser] = useState<LoginResponse['user'] | null>(authSession?.user ?? null);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [notificationSummary, setNotificationSummary] = useState<NotificationSummary | null>(null);
  const [isNotificationLoading, setIsNotificationLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(rawQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setIsProfileOpen(false);
        setIsNotificationsOpen(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrateCurrentUser() {
      if (!authSession?.accessToken) return;

      const hasName = Boolean(authSession.user.firstName?.trim() || authSession.user.lastName?.trim());
      if (hasName && authSession.user.email) {
        setCurrentUser(authSession.user);
        return;
      }

      try {
        const response = await getCurrentUser(authSession.accessToken);
        if (isMounted) {
          setCurrentUser(response.user);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(authSession.user);
        }
      }
    }

    hydrateCurrentUser();
    return () => {
      isMounted = false;
    };
  }, [authSession]);

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      const accessToken = authSession?.accessToken;
      if (!accessToken) return;

      setIsNotificationLoading(true);

      try {
        const [summaryResponse, feedResponse] = await Promise.all([
          loadNotificationSummary(),
          loadNotificationFeed(),
        ]);

        if (!isMounted) return;

        setNotificationSummary(summaryResponse.summary);
        setNotificationItems(feedResponse.items || []);
      } catch {
        if (isMounted) {
          setNotificationSummary(null);
          setNotificationItems([]);
        }
      } finally {
        if (isMounted) setIsNotificationLoading(false);
      }
    }

    if (isNotificationsOpen) {
      loadNotifications();
    }

    return () => {
      isMounted = false;
    };
  }, [authSession, isNotificationsOpen]);

  useEffect(() => {
    let isMounted = true;

    async function loadNotificationSummaryOnly() {
      const accessToken = authSession?.accessToken;
      if (!accessToken) return;

      try {
        const response = await loadNotificationSummary();
        if (isMounted) {
          setNotificationSummary(response.summary);
        }
      } catch {
        if (isMounted) {
          setNotificationSummary(null);
        }
      }
    }

    loadNotificationSummaryOnly();

    return () => {
      isMounted = false;
    };
  }, [authSession]);

  const navigationMatches = useMemo(() => {
    const query = normalize(debouncedQuery);
    if (!query) return [] as SearchResult[];

    return NAVIGATION_ENTRIES
      .map((entry) => {
        const score = Math.max(
          textMatchScore(entry.label, query),
          ...entry.keywords.map((keyword) => textMatchScore(keyword, query)),
        );
        if (score <= 0) return null;
        return {
          id: entry.id,
          section: 'navigation' as const,
          label: entry.label,
          sublabel: entry.keywords.join(', '),
          path: entry.path,
          score,
        } as SearchResult;
      })
      .filter(isDefined)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  }, [debouncedQuery]);

  const inventoryMatches = useMemo(() => {
    const query = normalize(debouncedQuery);
    if (!query) return [] as SearchResult[];

    const medicationMatches: SearchResult[] = medications
      .map((row) => {
        const fields = [row.medication_name, row.category_name, row.batch_number, row.status];
        const score = Math.max(...fields.map((field) => textMatchScore(field, query)));
        if (score <= 0) return null;
        const medicationKey = `I-${String(row.medication_id).padStart(3, '0')}`;
        return {
          id: `medication-${row.medication_id}`,
          section: 'inventory',
          entityType: 'medication',
          label: row.medication_name,
          sublabel: `${row.category_name} | Stock: ${row.total_stock} | Status: ${row.status}`,
          status: row.status,
          path: '/inventory',
          query: `focusMedicationId=${encodeURIComponent(medicationKey)}`,
          score,
        } satisfies SearchResult;
      })
      .filter(isDefined);

    const alertMatches: SearchResult[] = alerts
      .map((row) => {
        const fields = [row.medication_name, row.alert_type, row.severity];
        const score = Math.max(...fields.map((field) => textMatchScore(field, query)));
        if (score <= 0) return null;
        const medicationKey = `I-${String(row.medication_id).padStart(3, '0')}`;
        return {
          id: `alert-${row.alert_id ?? row.medication_id}`,
          section: 'inventory',
          entityType: 'alert',
          label: row.medication_name,
          sublabel: `${row.alert_type} | Severity: ${row.severity}`,
          status: row.severity,
          path: '/alerts',
          query: `focusAlertMedicationId=${encodeURIComponent(medicationKey)}`,
          score,
        } satisfies SearchResult;
      })
      .filter(isDefined);

    const restockMatches: SearchResult[] = restockRequests
      .map((row) => {
        const fields = [row.request_code, row.medication_name, row.supplier_name, row.status];
        const score = Math.max(...fields.map((field) => textMatchScore(field, query)));
        if (score <= 0) return null;
        return {
          id: `request-${row.request_id}`,
          section: 'inventory',
          entityType: 'request',
          label: row.request_code,
          sublabel: `${row.medication_name} | ${row.supplier_name} | ${row.status}`,
          status: row.status,
          path: '/restock',
          query: `focusRequestCode=${encodeURIComponent(row.request_code)}`,
          score,
        } satisfies SearchResult;
      })
      .filter(isDefined);

    const supplierMatches: SearchResult[] = suppliers
      .map((row) => {
        const fields = [row.supplier_name, row.email_address, row.status];
        const score = Math.max(...fields.map((field) => textMatchScore(field, query)));
        if (score <= 0) return null;
        return {
          id: `supplier-${row.supplier_id}`,
          section: 'inventory',
          entityType: 'supplier',
          label: row.supplier_name,
          sublabel: `${row.email_address} | ${row.status}`,
          status: row.status,
          path: '/suppliers',
          query: `focusSupplierId=${encodeURIComponent(String(row.supplier_id))}`,
          score,
        } satisfies SearchResult;
      })
      .filter(isDefined);

    return [...medicationMatches, ...alertMatches, ...restockMatches, ...supplierMatches]
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  }, [debouncedQuery, medications, alerts, restockRequests, suppliers]);

  const billingMatches = useMemo(() => {
    const query = normalize(debouncedQuery);
    if (!query) return [] as SearchResult[];

    const billResults = billingRecords
      .map((row) => {
        const fields = [row.id, row.patient, row.date, row.status];
        const score = Math.max(...fields.map((field) => textMatchScore(field, query)));
        if (score <= 0) return null;
        return {
          id: `bill-${row.id}`,
          section: 'billing',
          entityType: 'bill',
          label: row.id,
          sublabel: `${row.patient} | ${formatDateLabel(row.date)} | ${row.status}`,
          status: row.status,
          path: '/billing',
          query: `focusBillId=${encodeURIComponent(row.id)}`,
          score,
        } satisfies SearchResult;
      })
      .filter(isDefined)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

    const transactionResults: SearchResult[] = transactions
      .map((row) => {
        const fields = [row.payment_code, row.bill_code, row.patient_name, row.method, row.reference_number, row.received_by, row.status];
        const score = Math.max(...fields.map((field) => textMatchScore(field, query)));
        if (score <= 0) return null;
        return {
          id: `transaction-${row.payment_id}`,
          section: 'billing',
          entityType: 'transaction',
          label: row.payment_code,
          sublabel: `${row.bill_code} | ${row.patient_name} | ${row.method} | ${formatDateLabel(row.date)}`,
          status: row.status,
          path: '/billing/transactions',
          score,
        } satisfies SearchResult;
      })
      .filter(isDefined);

    return [...billResults, ...transactionResults]
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  }, [debouncedQuery, billingRecords, transactions]);

  const visibleNavigation = navigationMatches.slice(0, 5);
  const visibleInventory = inventoryMatches.slice(0, 5);
  const visibleBilling = billingMatches.slice(0, 5);
  const selectableResults = useMemo(
    () => [...visibleNavigation, ...visibleInventory, ...visibleBilling],
    [visibleNavigation, visibleInventory, visibleBilling],
  );
  const effectiveHighlightedIndex = selectableResults.length === 0
    ? -1
    : highlightedIndex < 0 || highlightedIndex >= selectableResults.length
      ? 0
      : highlightedIndex;

  function navigateTo(path: string, query?: string) {
    const targetPath = path;
    const targetSearch = query ? `?${query}` : '';
    if (location.pathname === targetPath && query) {
      const params = new URLSearchParams(query);
      const focusMedicationId = params.get('focusMedicationId');
      const focusAlertMedicationId = params.get('focusAlertMedicationId');
      const focusRequestCode = params.get('focusRequestCode');
      const focusSupplierId = params.get('focusSupplierId');
      const focusBillId = params.get('focusBillId');

      setTimeout(() => {
        const selector = focusMedicationId
          ? `[data-search-medication-id="${focusMedicationId}"]`
          : focusAlertMedicationId
            ? `[data-search-alert-id="${focusAlertMedicationId}"]`
            : focusRequestCode
              ? `[data-search-request-code="${focusRequestCode}"]`
              : focusSupplierId
                ? `[data-search-supplier-id="${focusSupplierId}"]`
                : focusBillId
                  ? `[data-search-bill-id="${focusBillId}"]`
                : '';

        if (!selector) return;
        const node = document.querySelector(selector);
        if (node instanceof HTMLElement) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
    }

    if (location.pathname === targetPath) {
      navigate(`${targetPath}${targetSearch}`, { replace: false });
    } else {
      navigate(`${targetPath}${targetSearch}`);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || !debouncedQuery) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (selectableResults.length === 0) return;
      setHighlightedIndex((prev) => (prev + 1) % selectableResults.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (selectableResults.length === 0) return;
      setHighlightedIndex((prev) => (prev <= 0 ? selectableResults.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (effectiveHighlightedIndex < 0 || effectiveHighlightedIndex >= selectableResults.length) return;
      const selected = selectableResults[effectiveHighlightedIndex];
      navigateTo(selected.path, selected.query);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }

  function entityLabel(type: SearchResult['entityType']) {
    if (type === 'medication') return 'Medication';
    if (type === 'alert') return 'Alert';
    if (type === 'request') return 'Restock';
    if (type === 'supplier') return 'Supplier';
    if (type === 'bill') return 'Bill';
    return '';
  }

  function refreshNotificationSummary() {
    const accessToken = authSession?.accessToken;
    if (!accessToken) return;

    loadNotificationSummary()
      .then((response) => setNotificationSummary(response.summary))
      .catch(() => setNotificationSummary(null));
  }

  async function handleMarkNotificationRead(item: NotificationItem) {
    if (item.is_read) return;

    setNotificationItems((previous) => previous.map((entry) => (
      entry.notification_id === item.notification_id
        ? { ...entry, is_read: true, read_at: new Date().toISOString() }
        : entry
    )));

    try {
      await markNotificationRead(item.notification_id);
    } catch {
      try {
        const { items } = await loadNotificationFeed();
        setNotificationItems(items || []);
      } catch {
        setNotificationItems((previous) => previous.map((entry) => (
          entry.notification_id === item.notification_id
            ? { ...entry, is_read: false, read_at: null }
            : entry
        )));
      }
    }
  }

  async function handleResolveNotification(item: NotificationItem) {
    if (item.action_ref) {
      await handleNotificationAction(item);
      return;
    }

    try {
      await resolveNotification(item.notification_id);
      const response = await loadNotificationFeed();
      setNotificationItems(response.items || []);
      setNotificationSummary(response.summary);
      refreshNotificationSummary();
    } catch {
      const response = await loadNotificationFeed().catch(() => null);
      if (response) {
        setNotificationItems(response.items || []);
        setNotificationSummary(response.summary);
      }
    }
  }

  async function handleNotificationAction(item: NotificationItem) {
    if (!item.is_read && item.status !== 'Resolved') {
      await handleMarkNotificationRead(item);
    }

    const ref = item.action_ref?.trim();
    if (!ref) {
      if (item.status !== 'Resolved') {
        await handleResolveNotification(item);
      }
      return;
    }

    if (ref.startsWith('/')) {
      const [path, query] = ref.split('?', 2);
      navigate(query ? `${path}?${query}` : path);
      setIsNotificationsOpen(false);
      return;
    }

    window.location.href = ref;
    setIsNotificationsOpen(false);
  }

  async function handleMarkAllNotificationsRead() {
    const pendingIds = new Set(
      notificationItems
        .filter((item) => isUnresolved(item.status) && !item.is_read)
        .map((item) => item.notification_id),
    );

    if (pendingIds.size === 0) return;

    setNotificationItems((previous) => previous.map((entry) => (
      pendingIds.has(entry.notification_id)
        ? { ...entry, is_read: true, read_at: entry.read_at || new Date().toISOString() }
        : entry
    )));

    try {
      await markAllNotificationsRead();
    } catch {
      try {
        const response = await loadNotificationFeed();
        setNotificationItems(response.items || []);
        setNotificationSummary(response.summary);
      } catch {
        setNotificationItems((previous) => previous.map((entry) => (
          pendingIds.has(entry.notification_id)
            ? { ...entry, is_read: false, read_at: null }
            : entry
        )));
      }
    }
  }

  function handleViewAllNotifications() {
    setIsNotificationsOpen(false);
    navigate('/notifications');
  }

  const notificationBadgeCount = notificationSummary?.badgeCount || 0;

  const pageTitle = getPageTitle(location.pathname);
  const fullName = [currentUser?.firstName, currentUser?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const profileInitials = [currentUser?.firstName, currentUser?.lastName]
    .map((value) => value?.trim().charAt(0).toUpperCase() || '')
    .filter(Boolean)
    .join('')
    .slice(0, 2) || (currentUser?.email?.trim().charAt(0).toUpperCase() || 'U');

  return (
    <header className="relative z-20 h-16 bg-[#F5F7FA] px-5 flex items-end pb-3">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold tracking-tight text-gray-800">{pageTitle}</h1>
        </div>
        <div ref={rootRef} className="flex items-center gap-3">
          <div className="relative w-full sm:w-[380px] max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            value={rawQuery}
            onChange={(event) => {
              const nextValue = event.target.value;
              setRawQuery(nextValue);
              if (!nextValue.trim()) {
                setDebouncedQuery('');
                setIsOpen(false);
                setHighlightedIndex(-1);
              } else {
                setIsOpen(true);
              }
            }}
            onFocus={() => {
              if (debouncedQuery || rawQuery.trim()) setIsOpen(true);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages, medications, alerts, requests, suppliers, bills, receipts"
            className="w-full h-10 rounded-lg border border-blue-100 bg-blue-100 pl-9 pr-10 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-300"
          />
          {rawQuery.trim() && (
            <button
              type="button"
              onClick={() => {
                setRawQuery('');
                setDebouncedQuery('');
                setIsOpen(false);
                setHighlightedIndex(-1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-500 hover:bg-blue-200"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}

          {isOpen && debouncedQuery && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
              {(searchLoading || billingLoading) && (
                <div className="space-y-2 p-3">
                  <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                  <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
                  <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
                  <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
                </div>
              )}

              {!(searchLoading || billingLoading) && (
                <div className="p-2">
                  {visibleNavigation.length > 0 && (
                    <section>
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Navigation Results</p>
                      <div className="space-y-1">
                        {visibleNavigation.map((result) => {
                          const globalIndex = selectableResults.findIndex((item) => item.id === result.id);
                          const active = effectiveHighlightedIndex === globalIndex;
                          return (
                            <button
                              key={result.id}
                              type="button"
                              onMouseEnter={() => setHighlightedIndex(globalIndex)}
                              onClick={() => navigateTo(result.path, result.query)}
                              className={`w-full rounded-lg px-2 py-2 text-left ${active ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                            >
                              <p className="text-sm font-semibold text-gray-800">{highlight(result.label, debouncedQuery)}</p>
                              <p className="text-xs text-gray-600">{highlight(result.sublabel || '', debouncedQuery)}</p>
                            </button>
                          );
                        })}
                      </div>
                      {navigationMatches.length > 5 && (
                        <button
                          type="button"
                          onClick={() => navigateTo('/dashboard')}
                          className="mt-1 w-full px-2 py-1.5 text-left text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          See all results
                        </button>
                      )}
                    </section>
                  )}

                  {visibleInventory.length > 0 && (
                    <section className={visibleNavigation.length > 0 ? 'mt-2 border-t border-gray-200 pt-2' : ''}>
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Inventory Results</p>
                      <div className="space-y-1">
                        {visibleInventory.map((result, index) => {
                          const globalIndex = selectableResults.findIndex((item) => item.id === result.id);
                          const active = effectiveHighlightedIndex === globalIndex;
                          const previous = visibleInventory[index - 1];
                          const showEntityDivider = previous?.entityType !== result.entityType;
                          return (
                            <div key={result.id}>
                              {showEntityDivider && (
                                <p className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                  {entityLabel(result.entityType)}
                                </p>
                              )}
                              <button
                                type="button"
                                onMouseEnter={() => setHighlightedIndex(globalIndex)}
                                onClick={() => navigateTo(result.path, result.query)}
                                className={`w-full rounded-lg px-2 py-2 text-left ${active ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                              >
                                <p className="text-sm font-semibold text-gray-800">{highlight(result.label, debouncedQuery)}</p>
                                <p className="text-xs text-gray-600">{highlight(result.sublabel || '', debouncedQuery)}</p>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {inventoryMatches.length > 5 && (
                        <button
                          type="button"
                          onClick={() => navigateTo('/inventory')}
                          className="mt-1 w-full px-2 py-1.5 text-left text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          See all results
                        </button>
                      )}
                    </section>
                  )}

                  {visibleBilling.length > 0 && (
                    <section className={visibleNavigation.length > 0 || visibleInventory.length > 0 ? 'mt-2 border-t border-gray-200 pt-2' : ''}>
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Billing Results</p>
                      <div className="space-y-1">
                        {visibleBilling.map((result) => {
                          const globalIndex = selectableResults.findIndex((item) => item.id === result.id);
                          const active = effectiveHighlightedIndex === globalIndex;
                          return (
                            <button
                              key={result.id}
                              type="button"
                              onMouseEnter={() => setHighlightedIndex(globalIndex)}
                              onClick={() => navigateTo(result.path, result.query)}
                              className={`w-full rounded-lg px-2 py-2 text-left ${active ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                            >
                              <p className="text-sm font-semibold text-gray-800">{highlight(result.label, debouncedQuery)}</p>
                              <p className="text-xs text-gray-600">{highlight(result.sublabel || '', debouncedQuery)}</p>
                            </button>
                          );
                        })}
                      </div>
                      {billingMatches.length > 5 && (
                        <button
                          type="button"
                          onClick={() => navigateTo('/billing')}
                          className="mt-1 w-full px-2 py-1.5 text-left text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          See all results
                        </button>
                      )}
                    </section>
                  )}

                  {visibleNavigation.length === 0 && visibleInventory.length === 0 && visibleBilling.length === 0 && (
                    <div className="px-2 py-4 text-sm text-gray-600">No results found.</div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
          <div className="relative">
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition hover:bg-amber-50 hover:text-amber-500"
              aria-label="Notifications"
              aria-expanded={isNotificationsOpen}
              onClick={() => {
                setIsNotificationsOpen((previous) => !previous);
                setIsOpen(false);
                setIsProfileOpen(false);
                setHighlightedIndex(-1);
              }}
            >
              <Bell size={16} />
              {notificationBadgeCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
                  {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <NotificationPanel
                items={notificationItems}
                summary={notificationSummary}
                isLoading={isNotificationLoading}
                onClose={() => setIsNotificationsOpen(false)}
                onMarkRead={handleMarkNotificationRead}
                onResolve={handleResolveNotification}
                onAction={handleNotificationAction}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onViewAll={handleViewAllNotifications}
              />
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 bg-gradient-to-br from-blue-600 to-blue-700 text-sm font-bold tracking-wide text-white shadow-sm transition hover:border-blue-300 hover:from-blue-700 hover:to-blue-700"
              onClick={() => {
                setIsProfileOpen((prev) => !prev);
                setIsOpen(false);
                setHighlightedIndex(-1);
              }}
              aria-label="Open profile menu"
              aria-expanded={isProfileOpen}
            >
              <span>{profileInitials}</span>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-72 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Signed in as</p>
                <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Full Name</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{fullName || 'Current user'}</p>
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700">
                        {currentUser?.role || authSession?.user.role || 'pharmacist'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email Address</p>
                    <p className="mt-1 break-all text-sm text-gray-600">{currentUser?.email || authSession?.user.email || 'No email available'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/settings');
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Settings size={16} />
                  Settings
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
