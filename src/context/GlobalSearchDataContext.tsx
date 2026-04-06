import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RESTOCK_REQUESTS_CHANGED_EVENT } from '../pages/pharmacy/restockRequestsStore';
import { GLOBAL_SEARCH_REFRESH_EVENT } from './globalSearchEvents';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export type SearchMedication = {
  medication_id: number;
  medication_name: string;
  category_name: string;
  batch_number: string;
  total_stock: number;
  status: string;
};

export type SearchAlert = {
  alert_id: number | null;
  medication_id: number;
  medication_name: string;
  alert_type: string;
  severity: string;
};

export type SearchRestockRequest = {
  request_id: number;
  request_code: string;
  medication_name: string;
  supplier_name: string;
  status: string;
};

export type SearchSupplier = {
  supplier_id: number;
  supplier_name: string;
  email_address: string;
  status: string;
};

export type SearchTransaction = {
  payment_id: number;
  payment_code: string;
  bill_code: string;
  patient_name: string;
  method: string;
  date: string;
  reference_number: string;
  received_by: string;
  status: string;
};

type GlobalSearchDataContextValue = {
  medications: SearchMedication[];
  alerts: SearchAlert[];
  restockRequests: SearchRestockRequest[];
  suppliers: SearchSupplier[];
  transactions: SearchTransaction[];
  isLoading: boolean;
  hasLoaded: boolean;
  refresh: () => Promise<void>;
};

type MedicationApiItem = {
  medication_id: number;
  medication_name: string | null;
  category_name: string | null;
  batch_number: string | null;
  total_stock: number | null;
  status: string | null;
};

type AlertApiItem = {
  alert_id: number | null;
  medication_id: number;
  medication_name: string | null;
  alert_type?: string | null;
  severity?: string | null;
};

type RestockApiItem = {
  request_id: number;
  request_code: string | null;
  medication_name: string | null;
  supplier_name: string | null;
  status: string | null;
};

type SupplierApiItem = {
  supplier_id: number;
  supplier_name: string | null;
  email_address: string | null;
  status: string | null;
};

type TransactionApiItem = {
  payment_id: number;
  payment_code: string | null;
  bill_code: string | null;
  patient_name: string | null;
  method: string | null;
  date: string | null;
  reference_number: string | null;
  received_by: string | null;
  bill_status?: string | null;
  status?: string | null;
};

const GlobalSearchDataContext = createContext<GlobalSearchDataContextValue | undefined>(undefined);

export function GlobalSearchDataProvider({ children }: { children: ReactNode }) {
  const [medications, setMedications] = useState<SearchMedication[]>([]);
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);
  const [restockRequests, setRestockRequests] = useState<SearchRestockRequest[]>([]);
  const [suppliers, setSuppliers] = useState<SearchSupplier[]>([]);
  const [transactions, setTransactions] = useState<SearchTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [medicationsRes, alertsRes, restockRes, suppliersRes, transactionsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/medications`),
        fetch(`${API_BASE_URL}/inventory-alerts`),
        fetch(`${API_BASE_URL}/restock-requests`),
        fetch(`${API_BASE_URL}/suppliers`),
        fetch(`${API_BASE_URL}/billing/transactions?page=1&page_size=100`),
      ]);

      if (!medicationsRes.ok || !alertsRes.ok || !restockRes.ok || !suppliersRes.ok || !transactionsRes.ok) {
        throw new Error('Failed to load global search data.');
      }

      const medicationsJson = (await medicationsRes.json()) as { items?: MedicationApiItem[] };
      const alertsJson = (await alertsRes.json()) as { items?: AlertApiItem[] };
      const restockJson = (await restockRes.json()) as { items?: RestockApiItem[] };
      const suppliersJson = (await suppliersRes.json()) as { suppliers?: SupplierApiItem[] };
      const transactionsJson = (await transactionsRes.json()) as { items?: TransactionApiItem[] };

      setMedications(
        (medicationsJson.items || []).map((item) => ({
          medication_id: item.medication_id,
          medication_name: item.medication_name || 'N/A',
          category_name: item.category_name || 'N/A',
          batch_number: item.batch_number || 'N/A',
          total_stock: Number(item.total_stock || 0),
          status: item.status || 'N/A',
        })),
      );

      setAlerts(
        (alertsJson.items || []).map((item) => ({
          alert_id: item.alert_id ?? null,
          medication_id: item.medication_id,
          medication_name: item.medication_name || 'N/A',
          alert_type: item.alert_type || 'Stock Risk',
          severity: item.severity || 'N/A',
        })),
      );

      setRestockRequests(
        (restockJson.items || []).map((item) => ({
          request_id: item.request_id,
          request_code: item.request_code || `RR-${item.request_id}`,
          medication_name: item.medication_name || 'N/A',
          supplier_name: item.supplier_name || 'N/A',
          status: item.status || 'N/A',
        })),
      );

      setSuppliers(
        (suppliersJson.suppliers || []).map((item) => ({
          supplier_id: item.supplier_id,
          supplier_name: item.supplier_name || 'N/A',
          email_address: item.email_address || 'N/A',
          status: item.status || 'N/A',
        })),
      );

      setTransactions(
        (transactionsJson.items || []).map((item) => ({
          payment_id: item.payment_id,
          payment_code: item.payment_code || `PAY-${item.payment_id}`,
          bill_code: item.bill_code || 'N/A',
          patient_name: item.patient_name || 'N/A',
          method: item.method || 'N/A',
          date: item.date || 'N/A',
          reference_number: item.reference_number || 'N/A',
          received_by: item.received_by || 'N/A',
          status: item.bill_status || item.status || 'N/A',
        })),
      );
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      setIsLoading(false);
      setHasLoaded(true);
    });
  }, [refresh]);

  useEffect(() => {
    async function handleRefresh() {
      try {
        await refresh();
      } catch {
        // Preserve previous data on refresh failure.
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(GLOBAL_SEARCH_REFRESH_EVENT, handleRefresh);
      window.addEventListener(RESTOCK_REQUESTS_CHANGED_EVENT, handleRefresh);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(GLOBAL_SEARCH_REFRESH_EVENT, handleRefresh);
        window.removeEventListener(RESTOCK_REQUESTS_CHANGED_EVENT, handleRefresh);
      }
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      medications,
      alerts,
      restockRequests,
      suppliers,
      transactions,
      isLoading,
      hasLoaded,
      refresh,
    }),
    [medications, alerts, restockRequests, suppliers, transactions, isLoading, hasLoaded, refresh],
  );

  return <GlobalSearchDataContext.Provider value={value}>{children}</GlobalSearchDataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGlobalSearchData() {
  const context = useContext(GlobalSearchDataContext);
  if (!context) {
    throw new Error('useGlobalSearchData must be used within GlobalSearchDataProvider.');
  }
  return context;
}
