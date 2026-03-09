import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleUserRound, Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGlobalSearchData } from '../context/GlobalSearchDataContext.tsx';

type NavigationEntry = {
  id: string;
  label: string;
  path: string;
  keywords: string[];
};

type SearchResult = {
  id: string;
  section: 'navigation' | 'inventory';
  entityType?: 'medication' | 'alert' | 'request' | 'supplier';
  label: string;
  sublabel?: string;
  status?: string;
  path: string;
  query?: string;
  score: number;
};

const NAVIGATION_ENTRIES: NavigationEntry[] = [
  { id: 'nav-current-stocks', label: 'Current Stocks', path: '/inventory', keywords: ['stocks', 'inventory', 'medicines', 'medication'] },
  { id: 'nav-inventory-alerts', label: 'Inventory Alerts', path: '/alerts', keywords: ['alerts', 'warnings', 'expiry', 'critical'] },
  { id: 'nav-restock-requests', label: 'Restock Requests', path: '/restock', keywords: ['restock', 'requests', 'purchase', 'order'] },
  { id: 'nav-suppliers', label: 'Suppliers', path: '/suppliers', keywords: ['suppliers', 'vendor', 'pharma'] },
  { id: 'nav-billing', label: 'Billing', path: '/billing', keywords: ['billing', 'bills', 'charges', 'invoice'] },
  { id: 'nav-payments', label: 'Payments', path: '/payments', keywords: ['payments', 'cash', 'gcash', 'maya'] },
  { id: 'nav-revenue', label: 'Revenue Reports', path: '/revenue', keywords: ['revenue', 'reports', 'analytics', 'finance'] },
  { id: 'nav-insurance', label: 'Insurance Claims', path: '/insurance-claims', keywords: ['insurance', 'claims', 'philhealth', 'maxicare'] },
];

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function safeLower(value: string | null | undefined) {
  return String(value || '').toLowerCase();
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

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const { medications, alerts, restockRequests, suppliers, isLoading } = useGlobalSearchData();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(rawQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  useEffect(() => {
    if (!debouncedQuery) {
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }
    setIsOpen(true);
  }, [debouncedQuery]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

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

  const visibleNavigation = navigationMatches.slice(0, 5);
  const visibleInventory = inventoryMatches.slice(0, 5);
  const selectableResults = useMemo(() => [...visibleNavigation, ...visibleInventory], [visibleNavigation, visibleInventory]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectableResults.length === 0) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex((prev) => {
      if (prev < 0 || prev >= selectableResults.length) return 0;
      return prev;
    });
  }, [isOpen, selectableResults]);

  function navigateTo(path: string, query?: string) {
    const targetPath = path;
    const targetSearch = query ? `?${query}` : '';
    if (location.pathname === targetPath && query) {
      const params = new URLSearchParams(query);
      const focusMedicationId = params.get('focusMedicationId');
      const focusAlertMedicationId = params.get('focusAlertMedicationId');
      const focusRequestCode = params.get('focusRequestCode');
      const focusSupplierId = params.get('focusSupplierId');

      setTimeout(() => {
        const selector = focusMedicationId
          ? `[data-search-medication-id="${focusMedicationId}"]`
          : focusAlertMedicationId
            ? `[data-search-alert-id="${focusAlertMedicationId}"]`
            : focusRequestCode
              ? `[data-search-request-code="${focusRequestCode}"]`
              : focusSupplierId
                ? `[data-search-supplier-id="${focusSupplierId}"]`
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
      if (highlightedIndex < 0 || highlightedIndex >= selectableResults.length) return;
      const selected = selectableResults[highlightedIndex];
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
    return '';
  }

  return (
    <header className="relative z-20 h-16 bg-[#F5F7FA] px-5 flex items-center justify-end">
      <div ref={rootRef} className="flex items-center gap-3 w-full justify-end">
        <div className="relative w-full sm:w-[380px] max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            value={rawQuery}
            onChange={(event) => setRawQuery(event.target.value)}
            onFocus={() => {
              if (debouncedQuery) setIsOpen(true);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages, medications, alerts, requests, suppliers"
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
              {isLoading && (
                <div className="space-y-2 p-3">
                  <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                  <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
                  <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
                  <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
                </div>
              )}

              {!isLoading && (
                <div className="p-2">
                  {visibleNavigation.length > 0 && (
                    <section>
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Navigation Results</p>
                      <div className="space-y-1">
                        {visibleNavigation.map((result) => {
                          const globalIndex = selectableResults.findIndex((item) => item.id === result.id);
                          const active = highlightedIndex === globalIndex;
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
                          const active = highlightedIndex === globalIndex;
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

                  {visibleNavigation.length === 0 && visibleInventory.length === 0 && (
                    <div className="px-2 py-4 text-sm text-gray-600">No results found.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <button type="button" className="text-blue-600 shrink-0">
          <CircleUserRound size={26} />
        </button>
      </div>
    </header>
  );
}
