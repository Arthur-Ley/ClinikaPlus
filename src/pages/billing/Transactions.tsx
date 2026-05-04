import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import Pagination from '../../components/ui/Pagination';
import SectionToolbar from '../../components/ui/SectionToolbar';
import {
  BillingPaginationSkeleton,
  SkeletonBlock,
} from './BillingSkeletonParts';

type TransactionMethodFilter = 'all' | 'Cash' | 'GCash' | 'Maya' | 'Other';
type ReceiptTransaction = {
  payment_id: number;
  payment_code: string;
  bill_id: number;
  bill_source?: 'native' | 'integrated';
  bill_code: string;
  patient_id: number | null;
  patient_name: string;
  amount: number;
  method: string;
  date: string | null;
  status: string;
  reference_number: string | null;
  received_by: string | null;
  bill_status?: string;
};

type TransactionsResponse = {
  items?: ReceiptTransaction[];
  pagination?: {
    total_pages?: number;
  };
};

type ReceiptBillItem = {
  bill_item_id?: number;
  description?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  subtotal?: number | null;
  service_type?: string | null;
};

type ReceiptBillPayment = {
  payment_id?: number;
  payment_date?: string | null;
  received_by?: string | null;
  reference_number?: string | null;
  payment_method?: string | null;
  amount_paid?: number | null;
  receiver?: {
    user_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    role?: string | null;
  } | null;
};

type ReceiptBillDetails = {
  bill?: {
    bill_id?: number;
    bill_code?: string;
    net_amount?: number | null;
    total_amount?: number | null;
    less_amount?: number | null;
    discount_type?: string | null;
    subtotal_medications?: number | null;
    subtotal_laboratory?: number | null;
    subtotal_miscellaneous?: number | null;
    subtotal_room_charge?: number | null;
    subtotal_professional_fee?: number | null;
    status?: string | null;
    bill_status?: string | null;
  } | null;
  items?: ReceiptBillItem[];
  payments?: ReceiptBillPayment[];
  total_paid?: number;
  remaining_balance?: number;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const DEFAULT_TRANSACTIONS_PAGE_SIZE = 9;
const MIN_TRANSACTIONS_PAGE_SIZE = 5;
const MAX_TRANSACTIONS_PAGE_SIZE = 12;
const TRANSACTIONS_TABLE_HEADER_HEIGHT = 40;
const TRANSACTIONS_TABLE_ROW_HEIGHT = 60;
const TRANSACTIONS_TABLE_SAFETY_BUFFER = 6;

function formatPeso(value: number) {
  return `PHP ${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function paymentReferenceFor(transaction: ReceiptTransaction) {
  return transaction.reference_number || 'N/A';
}

function statusBadgeClass(status: string) {
  const normalized = (status || '').trim().toLowerCase();
  if (normalized === 'paid') return 'bg-green-100 text-green-700';
  if (normalized === 'pending') return 'bg-amber-100 text-amber-700';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
}

function formatRoleLabel(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return '';
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function TransactionsTableSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-xl">
      <table className="w-full table-fixed text-xs lg:text-sm">
        <thead className="bg-gray-200/90">
          <tr>
            <th className="w-[12%] px-2 py-2 text-left lg:px-3"><SkeletonBlock className="h-4 w-20" /></th>
            <th className="w-[10%] px-2 py-2 text-left lg:px-3"><SkeletonBlock className="h-4 w-16" /></th>
            <th className="w-[16%] px-2 py-2 text-left lg:px-3"><SkeletonBlock className="h-4 w-24" /></th>
            <th className="w-[7%] px-2 py-2 text-left lg:px-3"><SkeletonBlock className="h-4 w-14" /></th>
            <th className="w-[11%] px-2 py-2 text-left lg:px-3"><SkeletonBlock className="h-4 w-20" /></th>
            <th className="w-[13%] px-2 py-2 text-right lg:px-3"><SkeletonBlock className="ml-auto h-4 w-20" /></th>
            <th className="w-[10%] px-2 py-2 text-center lg:px-3"><SkeletonBlock className="mx-auto h-4 w-14" /></th>
            <th className="w-[9%] px-2 py-2 text-left lg:px-3"><SkeletonBlock className="h-4 w-20" /></th>
            <th className="w-[13%] px-2 py-2 text-center lg:px-3"><SkeletonBlock className="mx-auto h-4 w-20" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <tr key={`transactions-skeleton-row-${rowIndex}`} className="border-t border-gray-200">
              <td className="px-2 py-2 lg:px-3"><SkeletonBlock className="h-4 w-24" /></td>
              <td className="px-2 py-2 lg:px-3"><SkeletonBlock className="h-4 w-24" /></td>
              <td className="px-2 py-2 lg:px-3"><SkeletonBlock className="h-4 w-32" /></td>
              <td className="px-2 py-2 lg:px-3"><SkeletonBlock className="h-4 w-12" /></td>
              <td className="px-2 py-2 lg:px-3"><SkeletonBlock className="h-4 w-24" /></td>
              <td className="px-2 py-2 lg:px-3"><SkeletonBlock className="ml-auto h-4 w-24" /></td>
              <td className="px-2 py-2 lg:px-3"><SkeletonBlock className="mx-auto h-8 w-[84px] rounded-full" /></td>
              <td className="px-2 py-2 lg:px-4"><SkeletonBlock className="h-4 w-12" /></td>
              <td className="px-2 py-2 lg:px-3"><SkeletonBlock className="mx-auto h-4 w-24" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Transactions() {
  const tableCardRef = useRef<HTMLDivElement | null>(null);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const [forceSkeletonVisible, setForceSkeletonVisible] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<TransactionMethodFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptTransaction | null>(null);
  const [allTransactions, setAllTransactions] = useState<ReceiptTransaction[]>([]);
  const [receiptDetails, setReceiptDetails] = useState<ReceiptBillDetails | null>(null);
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);
  const [receiptLoadError, setReceiptLoadError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pageSize, setPageSize] = useState(DEFAULT_TRANSACTIONS_PAGE_SIZE);
  const effectivePageSize = pageSize;
  const shouldShowLoading = isLoading || forceSkeletonVisible;

  useEffect(() => {
    const timer = window.setTimeout(() => setForceSkeletonVisible(false), 550);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setIsLoading(true);
        setLoadError('');
        const allRows: ReceiptTransaction[] = [];
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages) {
          const params = new URLSearchParams({
            page: String(page),
            page_size: '100',
          });

          if (searchTerm.trim()) {
            params.set('search', searchTerm.trim());
          }

          if (methodFilter !== 'all') {
            params.set('method', methodFilter);
          }

          const response = await fetch(`${API_BASE_URL}/billing/transactions?${params.toString()}`);
          if (!response.ok) throw new Error('Failed to load transactions.');

          const payload = (await response.json()) as TransactionsResponse;
          allRows.push(...(payload.items || []));
          totalPages = Math.max(1, Number(payload.pagination?.total_pages || 1));
          page += 1;
        }

        if (!active) return;
        setAllTransactions(allRows);
      } catch {
        if (!active) return;
        setAllTransactions([]);
        setLoadError('Failed to load transactions.');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [methodFilter, searchTerm]);

  const filteredTransactions = allTransactions.filter((row) => {
    const matchesMethod = methodFilter === 'all' || row.method === methodFilter;
    if (!matchesMethod) return false;

    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return true;

    const haystack = [
      row.payment_code,
      row.bill_code,
      row.patient_name,
      row.method,
      row.reference_number,
      row.received_by,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });

  const usePagination = filteredTransactions.length > effectivePageSize;
  const totalPages = usePagination ? Math.max(1, Math.ceil(filteredTransactions.length / effectivePageSize)) : 1;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const pagedTransactions = usePagination
    ? filteredTransactions.slice(startIndex, startIndex + effectivePageSize)
    : filteredTransactions;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const tableCard = tableCardRef.current;
    const viewport = tableViewportRef.current;
    if (!tableCard || !viewport) return;

    const recomputePageSize = () => {
      const availableHeight = tableCard.clientHeight;
      const tableHeader = viewport.querySelector('thead');
      const firstBodyRow = viewport.querySelector('tbody tr');
      const measuredHeaderHeight = tableHeader instanceof HTMLElement
        ? tableHeader.getBoundingClientRect().height
        : TRANSACTIONS_TABLE_HEADER_HEIGHT;
      const measuredRowHeight = firstBodyRow instanceof HTMLElement
        ? firstBodyRow.getBoundingClientRect().height
        : TRANSACTIONS_TABLE_ROW_HEIGHT;

      if (availableHeight <= measuredHeaderHeight || measuredRowHeight <= 0) return;

      const rows = Math.floor((availableHeight - measuredHeaderHeight - TRANSACTIONS_TABLE_SAFETY_BUFFER) / measuredRowHeight);
      const nextPageSize = Math.max(MIN_TRANSACTIONS_PAGE_SIZE, Math.min(MAX_TRANSACTIONS_PAGE_SIZE, rows));
      setPageSize((prev) => (prev === nextPageSize ? prev : nextPageSize));
    };

    recomputePageSize();

    const observer = new ResizeObserver(recomputePageSize);
    observer.observe(tableCard);
    window.addEventListener('resize', recomputePageSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recomputePageSize);
    };
  }, [filteredTransactions.length]);

  useEffect(() => {
    let active = true;

    if (!selectedReceipt?.bill_id) {
      setReceiptDetails(null);
      setReceiptLoadError('');
      setIsReceiptLoading(false);
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        setIsReceiptLoading(true);
        setReceiptLoadError('');
        if (selectedReceipt.bill_source === 'integrated') {
          if (!supabase) {
            throw new Error('Integrated receipt source is unavailable.');
          }

          const [billRpc, integratedItemsQuery, paymentsResponse] = await Promise.all([
            supabase
              .schema('public')
              .rpc('get_bill_with_patient', { p_bill_id: selectedReceipt.bill_id }),
            supabase
              .schema('public')
              .from('tbl_bill_items')
              .select('bill_item_id, description, quantity, unit_price, subtotal, service_type')
              .eq('bill_id', selectedReceipt.bill_id)
              .order('bill_item_id', { ascending: true }),
            fetch(`${API_BASE_URL}/billing/payments`, { cache: 'no-store' }),
          ]);

          if (billRpc.error) {
            throw new Error('Failed to load integrated bill details.');
          }
          if (integratedItemsQuery.error) {
            throw new Error('Failed to load integrated billed items.');
          }
          if (!paymentsResponse.ok) {
            throw new Error('Failed to load integrated payment details.');
          }

          const paymentsPayload = (await paymentsResponse.json()) as {
            items?: Array<{
              payment_id?: number;
              bill_id?: number;
              bill_source?: string;
              payment_date?: string | null;
              received_by?: string | null;
              reference_number?: string | null;
              payment_method?: string | null;
              amount_paid?: number | null;
              status?: string | null;
              voided_at?: string | null;
            }>;
          };
          const billRow = Array.isArray(billRpc.data) ? billRpc.data[0] : billRpc.data;
          const payments = (paymentsPayload.items || [])
            .filter((row) => Number(row.bill_id) === Number(selectedReceipt.bill_id))
            .filter((row) => String(row.bill_source || '').toLowerCase() === 'integrated')
            .filter((row) => String(row.status || '').toLowerCase() !== 'voided')
            .filter((row) => !row.voided_at)
            .sort((a, b) => new Date(a.payment_date || 0).getTime() - new Date(b.payment_date || 0).getTime());
          const totalPaid = payments.reduce((sum, row) => sum + Number(row?.amount_paid || 0), 0);
          const netAmount = Number((billRow as Record<string, unknown> | null)?.net_amount ?? (billRow as Record<string, unknown> | null)?.total_amount ?? selectedReceipt.amount ?? 0);
          const integratedItems = Array.isArray(integratedItemsQuery.data)
            ? integratedItemsQuery.data as ReceiptBillItem[]
            : [];
          const payload: ReceiptBillDetails = {
            bill: billRow as ReceiptBillDetails['bill'],
            items: integratedItems,
            payments,
            total_paid: totalPaid,
            remaining_balance: Math.max(0, netAmount - totalPaid),
          };
          if (!active) return;
          setReceiptDetails(payload);
        } else {
          const response = await fetch(`${API_BASE_URL}/billing/bills/${selectedReceipt.bill_id}`);
          if (!response.ok) {
            throw new Error('Failed to load receipt details.');
          }
          const payload = (await response.json()) as ReceiptBillDetails;
          if (!active) return;
          setReceiptDetails(payload);
        }
      } catch {
        if (!active) return;
        setReceiptDetails(null);
        setReceiptLoadError('Failed to load full receipt details.');
      } finally {
        if (active) {
          setIsReceiptLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedReceipt]);

  const receiptBill = receiptDetails?.bill ?? null;
  const receiptItems = Array.isArray(receiptDetails?.items) ? receiptDetails.items : [];
  const receiptPayments = Array.isArray(receiptDetails?.payments) ? receiptDetails.payments : [];
  const latestReceiptPayment = receiptPayments.length ? receiptPayments[receiptPayments.length - 1] : null;
  const receiptTotalPaid = Number(receiptDetails?.total_paid ?? selectedReceipt?.amount ?? 0);
  const receiptNetAmount = Number(receiptBill?.net_amount ?? receiptBill?.total_amount ?? selectedReceipt?.amount ?? 0);
  const receiptSubtotalFromBill = Number(
    (receiptBill?.subtotal_medications ?? 0) +
    (receiptBill?.subtotal_laboratory ?? 0) +
    (receiptBill?.subtotal_miscellaneous ?? 0) +
    (receiptBill?.subtotal_room_charge ?? 0) +
    (receiptBill?.subtotal_professional_fee ?? 0)
  );
  const receiptSubtotalFromItems = receiptItems.reduce((sum, item) => sum + Number(item?.subtotal ?? 0), 0);
  const receiptSubtotal = receiptSubtotalFromBill > 0 ? receiptSubtotalFromBill : receiptSubtotalFromItems;
  const receiptRemainingBalance = Number(
    receiptDetails?.remaining_balance ?? Math.max(0, receiptNetAmount - receiptTotalPaid)
  );
  const receiptBillStatus = receiptBill?.status || receiptBill?.bill_status || selectedReceipt?.bill_status || selectedReceipt?.status || 'N/A';
  const receiptReceiverName = latestReceiptPayment?.receiver
    ? [latestReceiptPayment.receiver.first_name, latestReceiptPayment.receiver.last_name]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' ')
        .trim()
    : '';
  const receiptReceiverRole = formatRoleLabel(latestReceiptPayment?.receiver?.role);
  const receiptReceivedBy = receiptReceiverName || selectedReceipt?.received_by || 'N/A';

  function printPaymentReceipt() {
    if (!selectedReceipt) return;

    const receiptNo = selectedReceipt.payment_code || `PAY-${selectedReceipt.payment_id}`;
    const popup = window.open('', '_blank', 'width=760,height=900');
    if (!popup) return;

    popup.document.open();
    popup.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt ${receiptNo}</title>
          <style>
            body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; margin: 32px; color: #111827; }
            .header { margin-bottom: 24px; }
            .title { font-size: 24px; font-weight: 700; margin: 0 0 6px; }
            .subtitle { color: #4b5563; margin: 0; }
            .section { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
            .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
            .value { font-size: 14px; font-weight: 600; }
            .summary { margin-top: 20px; border-top: 2px solid #d1d5db; padding-top: 14px; }
            .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
            .summary-row.total { font-size: 16px; font-weight: 700; }
            .footer { margin-top: 28px; font-size: 12px; color: #6b7280; text-align: center; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <p class="title">CliniKaPlus</p>
            <p class="subtitle">OFFICIAL RECEIPT</p>
          </div>

          <div class="section">
            <div class="meta">
              <div>
                <div class="label">Receipt No.</div>
                <div class="value">${receiptNo}</div>
              </div>
              <div>
                <div class="label">Date & Time</div>
                <div class="value">${formatDateTime(selectedReceipt.date)}</div>
              </div>
              <div>
                <div class="label">Patient</div>
                <div class="value">${selectedReceipt.patient_name}</div>
              </div>
              <div>
                <div class="label">Bill Code</div>
                <div class="value">${selectedReceipt.bill_code}</div>
              </div>
              <div>
                <div class="label">Payment Method</div>
                <div class="value">${selectedReceipt.method || 'N/A'}</div>
              </div>
              <div>
                <div class="label">Reference Number</div>
                <div class="value">${paymentReferenceFor(selectedReceipt)}</div>
              </div>
              <div>
                <div class="label">Received By</div>
                <div class="value">${receiptReceivedBy}</div>
              </div>
              <div>
                <div class="label">Bill Status</div>
                <div class="value">${receiptBillStatus}</div>
              </div>
            </div>

            <div class="summary">
              <div class="summary-row"><span>Bill Net Amount</span><strong>${formatPeso(receiptNetAmount)}</strong></div>
              <div class="summary-row"><span>Total Paid</span><strong>${formatPeso(receiptTotalPaid)}</strong></div>
              <div class="summary-row"><span>Remaining Balance</span><strong>${formatPeso(receiptRemainingBalance)}</strong></div>
              <div class="summary-row total"><span>Amount Paid</span><span>${formatPeso(selectedReceipt.amount)}</span></div>
            </div>
          </div>

          <div class="footer">
            This payment receipt was generated from CliniKaPlus.
          </div>
          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () { window.close(); };
            };
          </script>
        </body>
      </html>`);
    popup.document.close();
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col pb-4">
        <section className="flex flex-1 min-h-0 flex-col rounded-2xl bg-gray-300/80 p-5">
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-gray-100 px-3 py-4 md:px-4 md:py-5">
            <div>
              {shouldShowLoading ? (
                <>
                  <SkeletonBlock className="h-8 w-40" />
                  <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <SkeletonBlock className="h-10 w-full lg:max-w-[540px]" />
                    <SkeletonBlock className="h-10 w-[168px]" />
                  </div>
                </>
              ) : (
                <SectionToolbar
                  icon={Eye}
                  title="Transactions"
                  searchValue={searchTerm}
                  onSearchChange={setSearchTerm}
                  searchPlaceholder="Search bill, patient, receipt, method"
                  rightControls={(
                    <select
                      value={methodFilter}
                      onChange={(event) => setMethodFilter(event.target.value as TransactionMethodFilter)}
                      className="h-10 rounded-lg border border-gray-300 bg-gray-100 px-3 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="all">All methods</option>
                      <option value="Cash">Cash</option>
                      <option value="GCash">GCash</option>
                      <option value="Maya">Maya</option>
                      <option value="Other">Other</option>
                    </select>
                  )}
                />
              )}
            </div>

            <div ref={tableCardRef} className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {shouldShowLoading ? (
                <TransactionsTableSkeleton rowCount={Math.max(5, Math.min(effectivePageSize, 10))} />
              ) : (
                <div ref={tableViewportRef} className="min-h-0 flex-1 overflow-hidden">
                  <table className="w-full table-fixed text-xs lg:text-sm">
                    <thead className="bg-gray-200/90 text-gray-700">
                      <tr>
                        <th className="w-[12%] px-2 py-2 text-left font-semibold whitespace-nowrap lg:px-3">Payment Code</th>
                        <th className="w-[10%] px-2 py-2 text-left font-semibold whitespace-nowrap lg:px-3">Bill Code</th>
                        <th className="w-[16%] px-2 py-2 text-left font-semibold whitespace-nowrap lg:px-3">Patient</th>
                        <th className="w-[7%] px-2 py-2 text-left font-semibold whitespace-nowrap lg:px-3">Method</th>
                        <th className="w-[11%] px-2 py-2 text-left font-semibold whitespace-nowrap lg:px-3">Payment Date</th>
                        <th className="w-[13%] px-2 py-2 text-right font-semibold whitespace-nowrap lg:px-3">Amount Paid</th>
                        <th className="w-[10%] px-2 py-2 text-center font-semibold whitespace-nowrap lg:px-3">Status</th>
                        <th className="w-[9%] px-2 py-2 text-left font-semibold whitespace-nowrap lg:px-3">Reference No.</th>
                        <th className="w-[13%] px-2 py-2 text-center font-semibold whitespace-nowrap lg:px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedTransactions.length > 0 ? (
                        pagedTransactions.map((row) => (
                          <tr key={row.payment_id} className="border-t border-gray-200 text-gray-800 hover:bg-gray-200/40">
                            <td className="px-2 py-2 font-semibold whitespace-nowrap lg:px-3">{row.payment_code || `PAY-${row.payment_id}`}</td>
                            <td className="px-2 py-2 whitespace-nowrap truncate lg:px-3" title={row.bill_code || `BILL-${row.bill_id}`}>{row.bill_code || `BILL-${row.bill_id}`}</td>
                            <td className="px-2 py-2 whitespace-nowrap truncate lg:px-3" title={row.patient_name}>{row.patient_name}</td>
                            <td className="px-2 py-2 whitespace-nowrap lg:px-3">{row.method || '-'}</td>
                            <td className="px-2 py-2 whitespace-nowrap lg:px-3">{formatDate(row.date)}</td>
                            <td className="px-2 py-2 text-right font-semibold whitespace-nowrap lg:px-3">{formatPeso(row.amount)}</td>
                            <td className="px-2 py-2 text-center whitespace-nowrap lg:px-3">
                              <span className={`inline-flex min-w-[76px] items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold lg:min-w-[84px] lg:text-xs ${statusBadgeClass(row.bill_status || row.status || 'Paid')}`}>
                                {row.bill_status || row.status || 'Paid'}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap truncate lg:px-4" title={paymentReferenceFor(row)}>{paymentReferenceFor(row)}</td>
                            <td className="px-2 py-2 text-center whitespace-nowrap lg:px-3">
                              <button
                                type="button"
                                onClick={() => setSelectedReceipt(row)}
                                className="inline-flex items-center justify-center font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
                              >
                                View Receipt
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="px-3 py-10 text-center text-sm text-gray-500">
                            {loadError || 'No transactions match your current filters.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2.5 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
              {shouldShowLoading ? <SkeletonBlock className="h-4 w-52" /> : <p>Showing <span className="rounded-md bg-gray-300 px-2">{pagedTransactions.length}</span> out of {filteredTransactions.length}</p>}
              {shouldShowLoading ? (
                <BillingPaginationSkeleton />
              ) : (
                usePagination ? <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /> : null
              )}
            </div>
          </div>
        </section>
      </div>

      {selectedReceipt && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">CliniKaPlus</p>
                  <h3 className="mt-1 text-3xl font-bold text-gray-900">OFFICIAL RECEIPT</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200"
                  aria-label="Close receipt"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-400">Receipt No.</p>
                  <p className="font-bold text-gray-800">{selectedReceipt.payment_code || `PAY-${selectedReceipt.payment_id}`}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Date & Time</p>
                  <p className="font-bold text-gray-800">{formatDateTime(selectedReceipt.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Patient Info</p>
                  <p className="font-bold text-gray-800">{selectedReceipt.patient_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Received by</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-gray-800">{receiptReceivedBy}</p>
                    {receiptReceiverRole && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700">
                        {receiptReceiverRole}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-xs text-gray-500">
                      <th className="px-4 py-3 text-left font-medium">Description</th>
                      <th className="px-4 py-3 text-center font-medium">Quantity</th>
                      <th className="px-4 py-3 text-right font-medium">Price</th>
                      <th className="px-4 py-3 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isReceiptLoading ? (
                      <tr className="border-t border-gray-100 text-gray-800">
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-500">Loading billed items...</td>
                      </tr>
                    ) : receiptItems.length > 0 ? (
                      receiptItems.map((item, index) => (
                        <tr key={item.bill_item_id ?? `${item.description ?? 'item'}-${index}`} className="border-t border-gray-100 text-gray-800">
                          <td className="px-4 py-3">{item.description || item.service_type || 'N/A'}</td>
                          <td className="px-4 py-3 text-center">{Number(item.quantity ?? 0)}</td>
                          <td className="px-4 py-3 text-right">{formatPeso(Number(item.unit_price ?? 0))}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatPeso(Number(item.subtotal ?? 0))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-gray-100 text-gray-800">
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-500">{receiptLoadError || 'No billed items found.'}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Bill Details</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between"><span>Bill Code</span><span className="font-semibold">{selectedReceipt.bill_code}</span></div>
                    <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{formatPeso(receiptSubtotal)}</span></div>
                    <div className="flex justify-between"><span>Discount</span><span className="font-semibold">{formatPeso(Number(receiptBill?.less_amount ?? 0))}</span></div>
                    <div className="flex justify-between"><span>Discount Type</span><span className="font-semibold">{receiptBill?.discount_type || 'None'}</span></div>
                    <div className="flex justify-between"><span>Bill Status</span><span className="font-semibold">{receiptBillStatus}</span></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Payment Details</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between"><span>Payment Method</span><span className="font-semibold">{selectedReceipt.method || 'N/A'}</span></div>
                    <div className="flex justify-between"><span>Reference Number</span><span className="font-semibold">{paymentReferenceFor(selectedReceipt)}</span></div>
                    <div className="flex items-start justify-between gap-4">
                      <span>Received by</span>
                      <span className="flex flex-wrap items-center justify-end gap-2 text-right">
                        <span className="font-semibold">{receiptReceivedBy}</span>
                        {receiptReceiverRole && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700">
                            {receiptReceiverRole}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between"><span>Amount Paid</span><span className="font-semibold">{formatPeso(selectedReceipt.amount)}</span></div>
                    <div className="flex justify-between"><span>Total Paid</span><span className="font-semibold">{formatPeso(receiptTotalPaid)}</span></div>
                    <div className="flex justify-between"><span>Remaining Balance</span><span className="font-semibold">{formatPeso(receiptRemainingBalance)}</span></div>
                    <div className="flex justify-between border-t border-gray-300 pt-2"><span className="font-semibold">Bill Net Amount</span><span className="font-semibold">{formatPeso(receiptNetAmount)}</span></div>
                  </div>
                </div>
              </div>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={printPaymentReceipt}
                  className="h-10 rounded-xl border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
