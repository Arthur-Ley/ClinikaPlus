import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Eye, ReceiptText, Search, Wallet, X } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';

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
    page?: number;
    total_pages?: number;
  };
  summary?: {
    total_transactions?: number;
    total_revenue?: number;
    cash_count?: number;
    digital_count?: number;
  };
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const PAGE_SIZE = 5;

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

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  chipClass,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  chipClass: string;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500">{title}</p>
          <p className="mt-4 text-3xl font-bold text-gray-800">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-white ${chipClass}`}>
          <Icon size={18} />
        </span>
      </div>
    </article>
  );
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
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({
    total_transactions: 0,
    total_revenue: 0,
    cash_count: 0,
    digital_count: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(currentPage),
      page_size: String(PAGE_SIZE),
    });

    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    }

    if (methodFilter !== 'all') {
      params.set('method', methodFilter);
    }

    (async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/billing/transactions?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to load transactions.');

        const payload = (await response.json()) as TransactionsResponse;
        if (!active) return;

        setTransactions(payload.items || []);
        setTotalPages(Math.max(1, payload.pagination?.total_pages || 1));
        setSummary({
          total_transactions: payload.summary?.total_transactions || 0,
          total_revenue: payload.summary?.total_revenue || 0,
          cash_count: payload.summary?.cash_count || 0,
          digital_count: payload.summary?.digital_count || 0,
        });
      } catch {
        if (!active) return;
        setTransactions([]);
        setTotalPages(1);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [currentPage, methodFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [methodFilter, searchTerm]);

  const paymentMix = useMemo(
    () => `${summary.cash_count} / ${summary.digital_count}`,
    [summary.cash_count, summary.digital_count],
  );

  return (
    <>
      <div className="space-y-5">
        <section className="rounded-2xl bg-gray-300/80 p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              title="Paid Transactions"
              value={String(summary.total_transactions)}
              subtitle="Completed payment records available for review."
              icon={ReceiptText}
              chipClass="bg-blue-600"
            />
            <SummaryCard
              title="Collected Revenue"
              value={formatPeso(summary.total_revenue)}
              subtitle="Total from paid items in the transaction history."
              icon={Wallet}
              chipClass="bg-green-500"
            />
            <SummaryCard
              title="Payment Mix"
              value={paymentMix}
              subtitle="Cash transactions versus GCash and Maya combined."
              icon={CreditCard}
              chipClass="bg-amber-500"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Transactions</h2>
                <p className="mt-1 text-sm text-gray-500">Browse completed payments, check receipt numbers, and open a receipt preview.</p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search bill, patient, receipt, method"
                    className="h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-300 md:w-80"
                  />
                </label>

                <select
                  value={methodFilter}
                  onChange={(event) => setMethodFilter(event.target.value as TransactionMethodFilter)}
                  className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="all">All methods</option>
                  <option value="Cash">Cash</option>
                  <option value="GCash">GCash</option>
                  <option value="Maya">Maya</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
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
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={`transaction-skeleton-${index}`} className="border-t border-gray-100">
                        <td className="px-4 py-4" colSpan={8}>
                          <div className="h-5 animate-pulse rounded bg-gray-100" />
                        </td>
                      </tr>
                    ))
                  ) : transactions.length > 0 ? (
                    transactions.map((row) => (
                      <tr key={row.payment_id} className="border-t border-gray-100 text-gray-800">
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
            </div>

            <div className="mt-4 flex justify-end">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
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
