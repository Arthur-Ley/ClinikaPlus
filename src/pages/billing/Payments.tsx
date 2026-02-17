import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, Plus, Wallet, BadgeInfo, ReceiptText, Coins, Hash } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, paymentQueue } from '../../data/mockData';

type PaymentRow = {
  id: string;
  patient: string;
  amount: number;
  method: string;
  date: string;
  status: 'Pending' | 'Paid' | 'Processing';
};

type ModalState = 'none' | 'method' | 'cash' | 'gcash' | 'loading';

const summaryCards = [
  {
    title: 'Pending Payments',
    value: '6 bills',
    lines: ['P32,300 Total', 'Avg Pending: P5,383'],
    accent: 'text-amber-400',
    chip: 'bg-amber-400',
  },
  {
    title: 'Paid Today',
    value: 'P18,450',
    lines: ['8 Transactions', 'Avg: P2,306'],
    accent: 'text-green-400',
    chip: 'bg-green-400',
  },
  {
    title: 'Primary Payment Channel',
    value: 'E-Wallet',
    lines: ['52% of Total Payments This Month', '^ 8% vs Last Month'],
    accent: 'text-blue-500',
    chip: 'bg-blue-500',
  },
];

const rows = paymentQueue as PaymentRow[];

function formatMoney(value: number) {
  return `P${value.toLocaleString()}`;
}

export default function Payments() {
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'Cash' | 'GCash' | 'Maya'>('Cash');
  const [modal, setModal] = useState<ModalState>('none');
  const [amountReceived, setAmountReceived] = useState('');
  const [gcashRef, setGcashRef] = useState('');
  const [nextModal, setNextModal] = useState<'cash' | 'gcash'>('cash');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const change = useMemo(() => {
    if (!selectedRow) return 0;
    const parsed = Number(amountReceived || 0);
    return Math.max(parsed - selectedRow.amount, 0);
  }, [amountReceived, selectedRow]);

  const filteredRows = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => {
      return row.patient.toLowerCase().includes(normalized) || row.id.toLowerCase().includes(normalized);
    });
  }, [searchTerm]);

  useEffect(() => {
    if (modal !== 'loading') return;
    const timer = setTimeout(() => setModal(nextModal), 650);
    return () => clearTimeout(timer);
  }, [modal, nextModal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / DEFAULT_PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * DEFAULT_PAGE_SIZE;
  const pagedRows = filteredRows.slice(startIndex, startIndex + DEFAULT_PAGE_SIZE);

  function closeModal() {
    setModal('none');
    setGcashRef('');
    setAmountReceived('');
  }

  function openMethodModal(row: PaymentRow) {
    setSelectedRow(row);
    setSelectedMethod('Cash');
    setModal('method');
  }

  function proceedFromMethod() {
    setNextModal(selectedMethod === 'Cash' ? 'cash' : 'gcash');
    setModal('loading');
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Billing & Payments | Payments</h1>

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {summaryCards.map((card) => (
            <div key={card.title} className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
              <div className="flex items-start justify-between">
                <p className="text-lg font-semibold text-gray-500">{card.title}</p>
                <span className={`inline-block h-6 w-6 rounded-full ${card.chip}`} />
              </div>
              <p className={`text-4xl font-bold ${card.accent}`}>{card.value}</p>
              <div className="mt-2 space-y-1 text-sm font-semibold text-gray-700">
                {card.lines.map((line) => (
                  <p key={line} className={line.startsWith('^') ? 'text-blue-500' : ''}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Payment Queue</h2>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
            <div className="relative w-full lg:max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                placeholder="Search Patient, Bill ID, or Payment ID"
                className="w-full h-10 rounded-lg border border-gray-300 bg-gray-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button className="h-10 rounded-lg bg-green-500 px-3.5 text-sm font-semibold text-white flex items-center gap-1.5">
                <Plus size={16} />
                Create New Bill
              </button>
              <button className="h-10 rounded-lg border border-gray-300 bg-gray-100 px-3.5 text-sm font-medium text-gray-600 flex items-center gap-1.5">
                <ChevronDown size={16} />
                Filter
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl">
            <table className="w-full min-w-[960px] text-sm">
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
                  <tr key={row.id} className="border-t border-gray-200 hover:bg-gray-200/40 text-gray-800">
                    <td className="px-3 py-2 font-semibold">{row.id}</td>
                    <td className="px-3 py-2">{row.patient}</td>
                    <td className="px-3 py-2 font-semibold">{formatMoney(row.amount)}</td>
                    <td className="px-3 py-2">{row.method}</td>
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">
                      {row.status === 'Pending' && (
                        <button className="text-blue-600 font-semibold hover:text-blue-700" onClick={() => openMethodModal(row)}>
                          Pay
                        </button>
                      )}
                      {row.status === 'Paid' && <button className="text-blue-500 font-semibold">Receipt</button>}
                      {row.status === 'Processing' && <button className="text-blue-500 font-semibold">View</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 text-sm text-gray-600">
            <p>
              Showing <span className="rounded-md bg-gray-300 px-2">{pagedRows.length}</span> out of {filteredRows.length}
            </p>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-7 w-7 rounded-md text-xs font-semibold ${
                    currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {modal !== 'none' && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px] flex items-center justify-center p-4">
          {modal === 'loading' && <div className="h-[420px] w-[420px] rounded-2xl bg-gray-100 shadow-xl" />}

          {modal === 'method' && selectedRow && (
            <div className="w-full max-w-3xl rounded-2xl bg-gray-100 shadow-xl border border-gray-300 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 pr-2 md:border-r md:border-gray-300">
                  <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                    <BadgeInfo size={24} />
                    Patient Information
                  </h3>
                  <div className="space-y-3 text-sm text-gray-700">
                    <p className="font-semibold">{selectedRow.patient}</p>
                    <p className="font-semibold">{selectedRow.id}</p>
                    <p className="font-semibold">{formatMoney(selectedRow.amount)}</p>
                    <button className="text-blue-600 font-semibold">View Bill</button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                    <Wallet size={24} />
                    Payment Method
                  </h3>
                  <p className="text-sm text-gray-500 font-semibold">Select Payment Method:</p>
                  <div className="space-y-2 text-sm font-semibold text-gray-700">
                    <button onClick={() => setSelectedMethod('Cash')} className="flex items-center gap-2">
                      <span className={`h-4 w-4 rounded-full ${selectedMethod === 'Cash' ? 'bg-blue-600' : 'bg-gray-300'}`} />
                      Cash
                    </button>
                    <button onClick={() => setSelectedMethod('GCash')} className="flex items-center gap-2">
                      <span className={`h-4 w-4 rounded-full ${selectedMethod === 'GCash' ? 'bg-blue-600' : 'bg-gray-300'}`} />
                      GCash
                    </button>
                    <button onClick={() => setSelectedMethod('Maya')} className="flex items-center gap-2">
                      <span className={`h-4 w-4 rounded-full ${selectedMethod === 'Maya' ? 'bg-blue-600' : 'bg-gray-300'}`} />
                      Maya
                    </button>
                  </div>

                  <div className="pt-4 flex gap-2">
                    <button className="h-10 px-6 rounded-lg bg-blue-600 text-white font-semibold" onClick={proceedFromMethod}>
                      Proceed
                    </button>
                    <button className="h-10 px-6 rounded-lg bg-gray-300 text-gray-600 font-semibold" onClick={closeModal}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {modal === 'cash' && selectedRow && (
            <div className="w-full max-w-md rounded-2xl bg-gray-100 shadow-xl border border-gray-300 p-5 space-y-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Coins size={22} />
                Cash Payment
              </h3>
              <div className="text-sm font-semibold text-gray-700">{formatMoney(selectedRow.amount)} Total Amount</div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Amount Received</label>
                <input
                  type="number"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-full h-11 rounded-lg border border-gray-400 px-3 bg-transparent"
                />
              </div>

              <div className="text-sm font-semibold text-gray-700">Change: {formatMoney(change)}</div>

              <div className="flex gap-2">
                <button className="h-10 flex-1 rounded-lg bg-blue-600 text-white font-semibold">Confirm Payment</button>
                <button className="h-10 flex-1 rounded-lg bg-gray-300 text-gray-600 font-semibold" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {modal === 'gcash' && selectedRow && (
            <div className="w-full max-w-5xl rounded-2xl bg-gray-100 shadow-xl border border-gray-300 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-bold text-blue-700 mb-3">GCash</h3>
                  <p className="text-sm text-gray-600 mb-3">Scan this QR using your app:</p>
                  <div className="h-[320px] rounded-xl border-8 border-blue-600 bg-white flex items-center justify-center text-sm text-gray-400 font-semibold">
                    QR Placeholder
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <ReceiptText size={24} />
                    Payment Details
                  </h3>
                  <div className="text-sm font-semibold text-gray-700">Amount Due: {formatMoney(selectedRow.amount)}</div>
                  <div className="text-sm font-semibold text-gray-700">Reference Code: {selectedRow.id}</div>

                  <label className="block text-sm font-semibold text-gray-700">After payment, enter reference number:</label>
                  <div className="flex items-center gap-2">
                    <Hash size={18} className="text-gray-500" />
                    <input
                      value={gcashRef}
                      onChange={(e) => setGcashRef(e.target.value)}
                      className="h-11 w-full rounded-lg border border-gray-400 px-3 bg-transparent"
                      placeholder="GCash Reference Number"
                    />
                  </div>

                  <div className="text-sm font-semibold text-gray-700">Amount Paid: {formatMoney(selectedRow.amount)}</div>

                  <div className="pt-2 flex gap-2">
                    <button className="h-10 px-6 rounded-lg bg-blue-600 text-white font-semibold">Confirm Payment</button>
                    <button className="h-10 px-6 rounded-lg bg-gray-300 text-gray-600 font-semibold" onClick={closeModal}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
