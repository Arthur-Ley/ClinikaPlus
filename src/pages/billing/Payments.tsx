import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  ChevronDown,
  Clock3,
  FileText,
  Wallet,
  CircleDollarSign,
  Info,
  ReceiptText,
  Coins,
  XCircle,
  CheckCircle2,
  CreditCard,
  Hash,
  MinusCircle,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination.tsx';
import { useBillingPayments } from '../../context/useBillingPayments.ts';
import { useNavigate } from 'react-router-dom';

type PaymentStatus = 'Pending' | 'Paid' | 'Processing';

type PaymentRow = {
  id: string;
  patient: string;
  amount: number;
  method: string;
  date: string;
  status: PaymentStatus;
};

type PaymentMethod = 'Cash' | 'GCash' | 'Maya';
type PaymentFilter = 'all' | 'paid' | 'unpaid';
type PaymentModal =
  | 'none'
  | 'method'
  | 'cash'
  | 'cancelConfirm'
  | 'cancelled'
  | 'gcash'
  | 'confirm'
  | 'success'
  | 'receipt';

const PAGE_SIZE = 5;

function formatMoney(value: number) {
  return `₱${value.toLocaleString()}`;
}

function formatDateForTable(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

export default function Payments() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const { paymentQueue, markPaymentPaid, setPaymentProcessing } = useBillingPayments();
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [modal, setModal] = useState<PaymentModal>('none');
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('Cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [gcashReference, setGcashReference] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredRows = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return paymentQueue.filter((row) => {
      const matchesSearch =
        !normalized || row.id.toLowerCase().includes(normalized) || row.patient.toLowerCase().includes(normalized);
      const matchesFilter =
        paymentFilter === 'all' || (paymentFilter === 'paid' ? row.status === 'Paid' : row.status !== 'Paid');
      return matchesSearch && matchesFilter;
    });
  }, [paymentQueue, searchTerm, paymentFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const summaryCards = useMemo(() => {
    const pendingRows = filteredRows.filter((row) => row.status === 'Pending' || row.status === 'Processing');
    const paidRows = filteredRows.filter((row) => row.status === 'Paid');
    const totalPendingAmount = pendingRows.reduce((sum, row) => sum + row.amount, 0);
    const totalPaidAmount = paidRows.reduce((sum, row) => sum + row.amount, 0);
    const avgPending = pendingRows.length ? Math.round(totalPendingAmount / pendingRows.length) : 0;
    const avgPaid = paidRows.length ? Math.round(totalPaidAmount / paidRows.length) : 0;

    const methodCounts = filteredRows.reduce<Record<string, number>>((acc, row) => {
      if (row.method !== '-') {
        acc[row.method] = (acc[row.method] || 0) + 1;
      }
      return acc;
    }, {});
    const topMethodEntry = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0];
    const topMethodLabel = topMethodEntry ? topMethodEntry[0] : 'N/A';
    const topMethodCount = topMethodEntry ? topMethodEntry[1] : 0;

    return [
      {
        title: 'Pending Payments',
        value: `${pendingRows.length} bills`,
        lines: [`${formatMoney(totalPendingAmount)} Total`, `Avg Pending: ${formatMoney(avgPending)}`],
        accent: 'text-amber-500',
        chip: 'bg-amber-500',
        icon: Clock3,
      },
      {
        title: 'Paid Payments',
        value: formatMoney(totalPaidAmount),
        lines: [`${paidRows.length} Transactions`, `Avg Paid: ${formatMoney(avgPaid)}`],
        accent: 'text-green-500',
        chip: 'bg-green-500',
        icon: FileText,
      },
      {
        title: 'Primary Payment Channel',
        value: topMethodLabel,
        lines: [`${topMethodCount} transaction(s)`, 'Within current table results'],
        accent: 'text-blue-600',
        chip: 'bg-blue-600',
        icon: Wallet,
      },
    ];
  }, [filteredRows]);

  const changeAmount = useMemo(() => {
    if (!selectedRow) return 0;
    const received = Number(amountReceived || 0);
    if (Number.isNaN(received)) return 0;
    return Math.max(0, received - selectedRow.amount);
  }, [amountReceived, selectedRow]);

  function openMethodModal(row: PaymentRow) {
    setSelectedRow(row);
    setSelectedMethod('Cash');
    setAmountReceived('');
    setGcashReference('');
    setModal('method');
  }

  function openReceiptModal(row: PaymentRow) {
    setSelectedRow(row);
    setModal('receipt');
  }

  function openProcessingView(row: PaymentRow) {
    setSelectedRow(row);
    const mappedMethod: PaymentMethod =
      row.method === 'GCash' || row.method === 'Maya' || row.method === 'Cash' ? row.method : 'Cash';
    setSelectedMethod(mappedMethod);
    if (mappedMethod === 'Cash') {
      setModal('cash');
      return;
    }
    setModal('gcash');
  }

  function closeAllModals() {
    setModal('none');
    setSelectedRow(null);
    setAmountReceived('');
    setGcashReference('');
    setSelectedMethod('Cash');
  }

  function handleProceedFromMethod() {
    if (selectedRow) {
      void setPaymentProcessing({
        id: selectedRow.id,
        method: selectedMethod,
      });
    }

    if (selectedMethod === 'Cash') {
      setModal('cash');
      return;
    }
    setModal('gcash');
  }

  const isWalletMethod = selectedMethod === 'GCash' || selectedMethod === 'Maya';
  const paymentMethodLabel =
    selectedMethod === 'Cash' ? 'Cash' : selectedMethod === 'Maya' ? 'E-Wallet (Maya)' : 'E-Wallet (GCash)';
  const paymentReference = isWalletMethod ? gcashReference || selectedRow?.id || 'N/A' : 'N/A';

  async function handleConfirmPayment() {
    if (!selectedRow || isSubmitting) return;

    if (selectedMethod === 'Cash') {
      const received = Number(amountReceived || 0);
      if (Number.isNaN(received) || received < selectedRow.amount) {
        window.alert('Amount received is not enough.');
        return;
      }
    }

    if (isWalletMethod && !gcashReference.trim()) {
      window.alert('Reference number is required for GCash/Maya payments.');
      return;
    }

    const paidDate = new Date().toISOString();
    const reference = isWalletMethod ? gcashReference.trim() : undefined;

    try {
      setIsSubmitting(true);
      await markPaymentPaid({
        id: selectedRow.id,
        method: selectedMethod,
        reference,
        paidDate,
      });
      setSelectedRow((prev) =>
        prev
          ? {
              ...prev,
              method: selectedMethod,
              status: 'Paid',
              date: paidDate.slice(0, 10),
            }
          : prev,
      );
      setModal('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to record payment.';
      window.alert(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Billing & Payments | Payments</h1>

      <section className="space-y-5 rounded-2xl bg-gray-300/80 p-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <p className="text-xl font-semibold text-gray-500">{card.title}</p>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-white ${card.chip}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className={`mt-3 text-5xl font-bold ${card.accent}`}>{card.value}</p>
                <div className="mt-2 space-y-1 text-gray-800">
                  {card.lines.map((line) => (
                    <p key={line} className="text-3.5 font-semibold">
                      {line}
                    </p>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
          <h2 className="mb-3 text-3xl font-bold text-gray-800 md:text-4xl">Payment Queue</h2>

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                placeholder="Search Patient, Bill ID, or Payment ID"
                className="h-10 w-full rounded-xl border border-gray-300 bg-gray-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
                  className="h-10 appearance-none rounded-xl border border-gray-300 bg-gray-100 pl-3 pr-9 text-sm font-medium text-gray-600 outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-gray-200/90 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Patient Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold">Method</th>
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-200 text-gray-800 hover:bg-gray-200/40">
                    <td className="px-3 py-2 font-semibold">{row.id}</td>
                    <td className="px-3 py-2 font-semibold">{row.patient}</td>
                    <td className="px-3 py-2 font-semibold">{formatMoney(row.amount)}</td>
                    <td className="px-3 py-2 font-semibold">{row.method}</td>
                    <td className="px-3 py-2 font-semibold">{formatDateForTable(row.date)}</td>
                    <td className="px-3 py-2 font-semibold">{row.status}</td>
                    <td className="px-3 py-2">
                      {row.status === 'Pending' && (
                        <button type="button" onClick={() => openMethodModal(row)} className="font-semibold text-blue-600 hover:text-blue-700">
                          Pay
                        </button>
                      )}
                      {row.status === 'Paid' && (
                        <button type="button" onClick={() => openReceiptModal(row)} className="font-semibold text-blue-600 hover:text-blue-700">
                          Receipt
                        </button>
                      )}
                      {row.status === 'Processing' && (
                        <button type="button" onClick={() => openProcessingView(row)} className="font-semibold text-blue-500">
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-2.5 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
            <p>
              Showing <span className="rounded-md bg-gray-300 px-2">{pagedRows.length}</span> out of {filteredRows.length}
            </p>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>
      </section>

      {modal !== 'none' &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]" onClick={closeAllModals}>
          {modal === 'method' && selectedRow && (
            <div className="w-full max-w-2xl rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3 border-r border-gray-300 pr-4">
                  <h3 className="flex items-center gap-2 text-4xl font-bold text-gray-800">
                    <Info size={20} />
                    Patient Information
                  </h3>

                  <div className="space-y-4 text-sm text-gray-800">
                    <div>
                      <p className="font-bold">{selectedRow.patient}</p>
                      <p className="font-semibold text-gray-600">Patient Name</p>
                    </div>
                    <div>
                      <p className="font-bold">{selectedRow.id}</p>
                      <p className="font-semibold text-gray-600">Bill ID</p>
                      <button type="button" onClick={() => navigate('/billing/records')} className="font-semibold text-blue-600">View Bill</button>
                    </div>
                    <div>
                      <p className="font-bold">{formatMoney(selectedRow.amount)}</p>
                      <p className="font-semibold text-gray-600">Total Amount</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-4xl font-bold text-gray-800">
                    <Wallet size={20} />
                    Payment Method
                  </h3>

                  <p className="text-sm font-semibold text-gray-500">Select Payment Method:</p>
                  <div className="space-y-2 text-sm font-semibold text-gray-800">
                    {(['Cash', 'GCash', 'Maya'] as PaymentMethod[]).map((method) => (
                      <button key={method} type="button" className="flex items-center gap-2" onClick={() => setSelectedMethod(method)}>
                        <span className={`h-4 w-4 rounded-full ${selectedMethod === method ? 'bg-blue-600' : 'bg-gray-300'}`} />
                        {method}
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 flex gap-2">
                    <button type="button" onClick={handleProceedFromMethod} className="h-9 flex-1 rounded-lg bg-blue-600 text-sm font-semibold text-white">
                      Proceed
                    </button>
                    <button type="button" onClick={closeAllModals} className="h-9 flex-1 rounded-lg bg-gray-300 text-sm font-semibold text-gray-600">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {modal === 'cash' && selectedRow && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="flex items-center gap-2 text-4xl font-bold text-gray-800">
                <CircleDollarSign className="text-green-500" size={22} />
                Cash Payment
              </h3>

              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Coins size={18} className="mt-0.5 text-gray-800" />
                  <div>
                    <p className="font-bold text-gray-800">{formatMoney(selectedRow.amount)}</p>
                    <p className="font-semibold text-gray-600">Total Amount</p>
                  </div>
                </div>

                <div>
                  <p className="mb-1 font-bold text-gray-800">Amount Received</p>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">₱</span>
                    <input
                      type="number"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      className="h-8 flex-1 rounded-md border border-gray-400 bg-transparent px-2"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-1 font-bold text-gray-800">Change</p>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">₱</span>
                    <input value={changeAmount} readOnly className="h-8 flex-1 rounded-md border border-gray-400 bg-transparent px-2" />
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <button type="button" onClick={() => setModal('confirm')} className="h-9 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white">
                  Confirm Payment
                </button>
                <button type="button" onClick={() => setModal('cancelConfirm')} className="h-9 w-full rounded-lg bg-gray-300 text-sm font-semibold text-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {modal === 'cancelConfirm' && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
              <MinusCircle className="mx-auto h-12 w-12 text-red-500" />
              <h3 className="mt-4 text-4xl font-bold text-gray-800">Cancel your payment?</h3>
              <p className="mt-2 text-sm text-gray-600">Once canceled, the payment will not be sent.</p>

              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => setModal('cash')} className="h-9 flex-1 rounded-lg bg-gray-300 text-sm font-semibold text-gray-600">
                  Not Now
                </button>
                <button type="button" onClick={() => setModal('cancelled')} className="h-9 flex-1 rounded-lg bg-red-500 text-sm font-semibold text-white">
                  Cancel Payment
                </button>
              </div>
            </div>
          )}

          {modal === 'cancelled' && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
              <XCircle className="mx-auto h-14 w-14 text-red-500" strokeWidth={2} />
              <h3 className="mt-3 text-4xl font-bold text-gray-800">Payment Cancelled</h3>
              <p className="mt-2 text-sm text-gray-600">Your payment has been cancelled successfully.</p>
              <button type="button" onClick={closeAllModals} className="mt-6 h-9 w-32 rounded-lg bg-blue-600 text-sm font-semibold text-white">
                Done
              </button>
            </div>
          )}

          {modal === 'gcash' && selectedRow && (
            <div className="w-full max-w-4xl rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-xl md:p-6" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[330px_1fr]">
                <div>
                  <h3 className="mb-1 text-3.5 font-bold text-blue-700">{selectedMethod}</h3>
                  <p className="text-sm text-gray-600">Kindly scan this QR using your {selectedMethod} app:</p>
                  <div className="mt-4 rounded-xl bg-blue-600 p-4">
                    <div className="h-[270px] rounded-lg bg-white flex items-center justify-center text-center text-gray-400 text-sm">
                      QR Code
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 text-4xl font-bold text-gray-800">
                    <CreditCard size={20} />
                    Payment Details
                  </h3>

                  <div className="grid grid-cols-2 gap-6 text-sm text-gray-800">
                    <div className="flex items-start gap-2">
                      <Coins size={18} />
                      <div>
                        <p className="font-bold">{formatMoney(selectedRow.amount)}</p>
                        <p className="font-semibold text-gray-600">Amount Due</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <ReceiptText size={18} />
                      <div>
                        <p className="font-bold">{selectedRow.id}</p>
                        <p className="font-semibold text-gray-600">Reference Code</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-800">After payment, enter:</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Hash size={18} className="text-gray-700" />
                      <p className="font-medium text-gray-700">{selectedMethod} Reference Number</p>
                    </div>
                    <input
                      value={gcashReference}
                      onChange={(e) => setGcashReference(e.target.value)}
                      className="mt-2 h-8 w-full max-w-sm rounded-md border border-gray-400 bg-transparent px-2"
                    />
                  </div>

                  <div className="flex items-start gap-2 text-sm text-gray-800">
                    <Coins size={18} />
                    <div>
                      <p className="font-bold">{formatMoney(selectedRow.amount)}</p>
                      <p className="font-semibold text-gray-600">Amount Paid</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setModal('confirm')} className="h-9 w-44 rounded-lg bg-blue-600 text-sm font-semibold text-white">
                      Confirm Payment
                    </button>
                    <button type="button" onClick={() => setModal('method')} className="h-9 w-40 rounded-lg bg-gray-300 text-sm font-semibold text-gray-600">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {modal === 'confirm' && selectedRow && (
            <div className="w-full max-w-md rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-4xl font-bold text-gray-800">Confirm your payment</h3>
              <p className="mt-1 text-sm text-gray-600">Please confirm to securely process your payment.</p>

              <div className="mt-4 rounded-xl bg-gray-300 p-4 text-sm">
                <div className="space-y-2 text-gray-800">
                  <div className="flex justify-between">
                    <span>Date</span>
                    <span>{selectedRow.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Patient Name</span>
                    <span>{selectedRow.patient}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Method</span>
                    <span>{paymentMethodLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reference Number</span>
                    <span>{paymentReference}</span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-gray-400 pt-3 font-bold">
                    <span>Total Amount</span>
                    <span>{formatMoney(selectedRow.amount)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={closeAllModals} className="h-9 flex-1 rounded-lg bg-gray-300 text-sm font-semibold text-gray-600">
                  Cancel
                </button>
                <button type="button" onClick={handleConfirmPayment} className="h-9 flex-1 rounded-lg bg-blue-600 text-sm font-semibold text-white">
                  Confirm Payment
                </button>
              </div>
            </div>
          )}

          {modal === 'success' && selectedRow && (
            <div className="w-full max-w-sm rounded-2xl border border-gray-300 bg-gray-100 p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" strokeWidth={2} />
              <h3 className="mt-3 text-4xl font-bold text-gray-800">Payment Successful!</h3>
              <p className="mt-2 text-sm text-gray-600">Your payment has been completed successfully.</p>

              <div className="mt-4 border-t border-gray-300 pt-3 text-sm text-gray-700 space-y-1">
                <div className="flex justify-between">
                  <span>Amount Paid</span>
                  <span className="font-semibold">{formatMoney(selectedRow.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Method</span>
                  <span className="font-semibold">{paymentMethodLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date & Time</span>
                  <span className="font-semibold">{selectedRow.date}</span>
                </div>
              </div>

              <button type="button" onClick={closeAllModals} className="mt-6 h-9 w-32 rounded-lg bg-blue-600 text-sm font-semibold text-white">
                Done
              </button>
            </div>
          )}

          {modal === 'receipt' && selectedRow && (
            <div className="w-full max-w-md rounded-2xl border border-gray-300 bg-gray-100 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 text-3xl font-bold text-gray-800">
                <ReceiptText size={20} />
                Payment Receipt
              </div>
              <p className="mt-1 text-sm text-gray-600">Official payment summary for this transaction.</p>

              <div className="mt-4 rounded-xl bg-gray-300 p-4 text-sm text-gray-800">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Receipt No.</span>
                    <span className="font-semibold">{`RCT-${selectedRow.id}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bill ID</span>
                    <span className="font-semibold">{selectedRow.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Patient</span>
                    <span className="font-semibold">{selectedRow.patient}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date</span>
                    <span className="font-semibold">{formatDateForTable(selectedRow.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Method</span>
                    <span className="font-semibold">{selectedRow.method}</span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-gray-400 pt-3 font-bold">
                    <span>Total Paid</span>
                    <span>{formatMoney(selectedRow.amount)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={closeAllModals} className="h-9 flex-1 rounded-lg bg-blue-600 text-sm font-semibold text-white">
                  Done
                </button>
              </div>
            </div>
          )}
          </div>,
          document.body,
        )}
    </div>
  );
}

