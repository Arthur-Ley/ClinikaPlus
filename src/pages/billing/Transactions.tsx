import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  } | null;
  items?: ReceiptBillItem[];
  payments?: ReceiptBillPayment[];
  total_paid?: number;
  remaining_balance?: number;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TRANSACTIONS_PAGE_SIZE = 9;

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

export default function Transactions() {
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
  const effectivePageSize = TRANSACTIONS_PAGE_SIZE;

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
        const response = await fetch(`${API_BASE_URL}/billing/bills/${selectedReceipt.bill_id}`);
        if (!response.ok) {
          throw new Error('Failed to load receipt details.');
        }
        const payload = (await response.json()) as ReceiptBillDetails;
        if (!active) return;
        setReceiptDetails(payload);
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
  const receiptRemainingBalance = Number(receiptDetails?.remaining_balance ?? 0);
  const receiptNetAmount = Number(receiptBill?.net_amount ?? receiptBill?.total_amount ?? selectedReceipt?.amount ?? 0);
  const receiptSubtotal = Number(
    (receiptBill?.subtotal_medications ?? 0) +
    (receiptBill?.subtotal_laboratory ?? 0) +
    (receiptBill?.subtotal_miscellaneous ?? 0) +
    (receiptBill?.subtotal_room_charge ?? 0) +
    (receiptBill?.subtotal_professional_fee ?? 0)
  );
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
                <div class="value">${receiptBill?.status || selectedReceipt.bill_status || selectedReceipt.status}</div>
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

            <div className="mt-4 min-h-0 flex-1 rounded-2xl border border-gray-200 bg-white">
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
                  rowCount={effectivePageSize}
                />
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-200/90 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Payment Code</th>
                      <th className="px-3 py-2 text-left font-semibold">Bill Code</th>
                      <th className="px-3 py-2 text-left font-semibold">Patient</th>
                      <th className="px-3 py-2 text-left font-semibold">Method</th>
                      <th className="px-3 py-2 text-left font-semibold">Payment Date</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount Paid</th>
                      <th className="px-3 py-2 text-center font-semibold">Status</th>
                      <th className="px-3 py-2 text-left font-semibold">Reference No.</th>
                      <th className="px-3 py-2 text-center font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTransactions.length > 0 ? (
                      pagedTransactions.map((row) => (
                        <tr key={row.payment_id} className="border-t border-gray-200 text-gray-800 hover:bg-gray-200/40">
                          <td className="px-3 py-2 font-semibold">{row.payment_code || `PAY-${row.payment_id}`}</td>
                          <td className="px-3 py-2">{row.bill_code || `BILL-${row.bill_id}`}</td>
                          <td className="px-3 py-2">{row.patient_name}</td>
                          <td className="px-3 py-2">{row.method || '-'}</td>
                          <td className="px-3 py-2">{formatDate(row.date)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatPeso(row.amount)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex min-w-[90px] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(row.bill_status || row.status || 'Paid')}`}>
                              {row.bill_status || row.status || 'Paid'}
                            </span>
                          </td>
                          <td className="px-3 py-2">{paymentReferenceFor(row)}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(row)}
                              className="font-semibold text-blue-600 hover:text-blue-700"
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
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2.5 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
              {isLoading ? <SkeletonBlock className="h-4 w-52" /> : <p>Showing <span className="rounded-md bg-gray-300 px-2">{pagedTransactions.length}</span> out of {filteredTransactions.length}</p>}
              {isLoading ? (
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
                    <div className="flex justify-between"><span>Bill Status</span><span className="font-semibold">{receiptBill?.status || selectedReceipt.bill_status || selectedReceipt.status}</span></div>
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
