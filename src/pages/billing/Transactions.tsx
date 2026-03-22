import { useEffect, useRef, useState } from 'react';
import { Eye, X } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import SectionToolbar from '../../components/ui/SectionToolbar';
import {
  BillingPaginationSkeleton,
  BillingTableSkeleton,
  BillingToolbarSkeleton,
  SkeletonBlock,
} from './BillingSkeletonParts';

type TransactionMethodFilter = 'all' | 'Cash' | 'GCash' | 'Maya' | 'Other';
type ReceiptTransaction = {
  payment_id: number;
  payment_code: string;
  bill_id: number;
  bill_code: string;
  patient_id: number | null;
  patient_name: string;
  amount: number;
  method: string;
  date: string | null;
  status: 'Paid';
  reference_number: string | null;
  received_by: string | null;
};

type TransactionsResponse = {
  items?: ReceiptTransaction[];
  pagination?: {
    total_pages?: number;
  };
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const MIN_TABLE_ROWS = 1;
const MAX_TABLE_ROWS = 100;

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
  return transaction.reference_number || `REF-${transaction.bill_code}`;
}

function processedByFor(transaction: ReceiptTransaction) {
  return transaction.received_by || 'Staff';
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex min-w-[74px] justify-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
      {label}
    </span>
  );
}

export default function Transactions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<TransactionMethodFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptTransaction | null>(null);
  const [transactions, setTransactions] = useState<ReceiptTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tablePageSize, setTablePageSize] = useState(8);
  const tableCardRef = useRef<HTMLDivElement | null>(null);
  const tableToolbarRef = useRef<HTMLDivElement | null>(null);
  const tableFooterRef = useRef<HTMLDivElement | null>(null);
  const tableHeadRef = useRef<HTMLTableSectionElement | null>(null);
  const effectivePageSize = Math.max(MIN_TABLE_ROWS, tablePageSize);

  useEffect(() => {
    function measureRowsThatFit() {
      const card = tableCardRef.current;
      const toolbar = tableToolbarRef.current;
      const footer = tableFooterRef.current;
      const tableHead = tableHeadRef.current;
      if (!card || !toolbar) return;

      const cardHeight = card.clientHeight;
      if (!cardHeight) return;

      const toolbarHeight = toolbar.offsetHeight;
      const footerHeight = footer?.offsetHeight ?? 0;
      const headerHeight = tableHead?.getBoundingClientRect().height || 44;
      const rowNode = card.querySelector<HTMLTableRowElement>('tbody tr[data-transaction-row="true"]');
      const rowHeight = rowNode?.getBoundingClientRect().height || 52;
      const bottomReserve = 28;
      const availableBodyHeight = cardHeight - toolbarHeight - footerHeight - headerHeight - bottomReserve;
      const nextPageSize = Math.max(MIN_TABLE_ROWS, Math.min(MAX_TABLE_ROWS, Math.floor(availableBodyHeight / Math.max(rowHeight, 1))));
      setTablePageSize((prev) => (prev === nextPageSize ? prev : nextPageSize));
    }

    measureRowsThatFit();
    const frame = window.requestAnimationFrame(() => measureRowsThatFit());
    const settleTimer = window.setTimeout(() => measureRowsThatFit(), 120);
    const observer = new ResizeObserver(() => measureRowsThatFit());
    const mutationObserver = new MutationObserver(() => measureRowsThatFit());
    if (tableCardRef.current) observer.observe(tableCardRef.current);
    if (tableToolbarRef.current) observer.observe(tableToolbarRef.current);
    if (tableFooterRef.current) observer.observe(tableFooterRef.current);
    if (tableCardRef.current) mutationObserver.observe(tableCardRef.current, { childList: true, subtree: true });
    window.addEventListener('resize', measureRowsThatFit);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', measureRowsThatFit);
    };
  }, [transactions.length, isLoading]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setIsLoading(true);
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
        setTransactions(allRows);
      } catch {
        if (!active) return;
        setTransactions([]);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [methodFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [methodFilter, searchTerm, effectivePageSize]);

  const usePagination = transactions.length > effectivePageSize;
  const totalPages = usePagination ? Math.max(1, Math.ceil(transactions.length / effectivePageSize)) : 1;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const pagedTransactions = usePagination
    ? transactions.slice(startIndex, startIndex + effectivePageSize)
    : transactions;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <>
      <div className="flex min-h-full flex-col">
        <section className="flex flex-1 min-h-0 flex-col rounded-2xl bg-gray-300/80 p-5">
          <div ref={tableCardRef} className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-gray-100 p-4 md:p-5">
            <div ref={tableToolbarRef}>
              {isLoading ? (
                <>
                  <SkeletonBlock className="h-8 w-40" />
                  <SkeletonBlock className="mt-1 h-4 w-80" />
                  <div className="mt-3">
                    <BillingToolbarSkeleton showPrimaryAction={false} trailingControlCount={1} />
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

            <div className="mt-4 min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-2xl border border-gray-200 bg-white">
              {isLoading ? (
                <BillingTableSkeleton
                  columns={[
                    { headerWidthClass: 'w-14', cellWidthClass: 'w-24' },
                    { headerWidthClass: 'w-20', cellWidthClass: 'w-24' },
                    { headerWidthClass: 'w-20', cellWidthClass: 'w-36' },
                    { headerWidthClass: 'w-16', cellWidthClass: 'w-20' },
                    { headerWidthClass: 'w-14', cellWidthClass: 'w-20' },
                    { headerWidthClass: 'w-16', cellWidthClass: 'w-20', align: 'right' },
                    { headerWidthClass: 'w-16', cellWidthClass: 'w-16', align: 'center' },
                    { headerWidthClass: 'w-16', cellWidthClass: 'w-24', align: 'right' },
                  ]}
                  rowCount={Math.max(5, Math.min(effectivePageSize, 12))}
                />
              ) : (
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead ref={tableHeadRef} className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Bill ID</th>
                      <th className="px-4 py-3 font-semibold">Receipt No.</th>
                      <th className="px-4 py-3 font-semibold">Patient</th>
                      <th className="px-4 py-3 font-semibold">Method</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold text-right">Amount</th>
                      <th className="px-4 py-3 font-semibold text-center">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTransactions.length > 0 ? (
                      pagedTransactions.map((row) => (
                        <tr key={row.payment_id} data-transaction-row="true" className="border-t border-gray-100 text-gray-800">
                          <td className="px-4 py-4 font-semibold">{row.bill_code}</td>
                          <td className="px-4 py-4">{`RCT-${row.bill_code}`}</td>
                          <td className="px-4 py-4">{row.patient_name}</td>
                          <td className="px-4 py-4">{row.method || '-'}</td>
                          <td className="px-4 py-4">{formatDate(row.date)}</td>
                          <td className="px-4 py-4 text-right font-semibold">{formatPeso(row.amount)}</td>
                          <td className="px-4 py-4 text-center">
                            <StatusPill label="Paid" />
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(row)}
                              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                            >
                              <Eye size={16} />
                              View Receipt
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-gray-100">
                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">
                          No transactions match your current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div ref={tableFooterRef} className="mt-4 flex items-center justify-between text-sm text-gray-600">
              {isLoading ? <SkeletonBlock className="h-4 w-52" /> : <p>Showing <span className="rounded-md bg-gray-200 px-2">{pagedTransactions.length}</span> out of {transactions.length}</p>}
              {isLoading ? (
                <BillingPaginationSkeleton />
              ) : (
                usePagination ? <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /> : null
              )}
            </div>
          </div>
        </section>
      </div>

      {selectedReceipt && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-5">
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

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-400">Receipt No.</p>
                  <p className="font-bold text-gray-800">{`RCT-${selectedReceipt.bill_code}`}</p>
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
                  <p className="text-xs text-gray-400">Processed by</p>
                  <p className="font-bold text-gray-800">{processedByFor(selectedReceipt)}</p>
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
                    <tr className="border-t border-gray-100 text-gray-800">
                      <td className="px-4 py-3">Billing Payment</td>
                      <td className="px-4 py-3 text-center">1</td>
                      <td className="px-4 py-3 text-right">{formatPeso(selectedReceipt.amount)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatPeso(selectedReceipt.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Payment Details</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between"><span>Payment Method</span><span className="font-semibold">{selectedReceipt.method || 'N/A'}</span></div>
                    <div className="flex justify-between"><span>Reference Number</span><span className="font-semibold">{paymentReferenceFor(selectedReceipt)}</span></div>
                    <div className="flex justify-between"><span>Processed by</span><span className="font-semibold">{processedByFor(selectedReceipt)}</span></div>
                    <div className="flex justify-between"><span>Bill ID</span><span className="font-semibold">{selectedReceipt.bill_code}</span></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Payment Summary</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between"><span>Status</span><span className="font-semibold">{selectedReceipt.status}</span></div>
                    <div className="flex justify-between"><span>Amount Paid</span><span className="font-semibold">{formatPeso(selectedReceipt.amount)}</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4">
              <div className="flex justify-end">
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
      )}
    </>
  );
}
