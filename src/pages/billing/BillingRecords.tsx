import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, Plus, Clock3, FileText, Wallet } from 'lucide-react';
import { billingRecords, DEFAULT_PAGE_SIZE } from '../../data/mockData';

const summaryCards = [
  {
    title: 'Pending Bills',
    value: '6 bills',
    lines: ['Average Bill: P3,200', 'Oldest Bill: 3 days'],
    accent: 'text-amber-500',
    chip: 'bg-amber-500/90',
    icon: Clock3,
  },
  {
    title: 'Generated Today',
    value: '18 bills',
    lines: ['Average Payment per Bill: P2,350', 'Most Common Service: Consultation'],
    accent: 'text-blue-600',
    chip: 'bg-blue-600/90',
    icon: FileText,
  },
  {
    title: 'Awaiting Payment',
    value: 'P42,350',
    lines: ['Overdue: 2 bills', 'Highest Bill: P7,500'],
    accent: 'text-green-500',
    chip: 'bg-green-500/90',
    icon: Wallet,
  },
];

export default function BillingRecords() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredBills = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return billingRecords;
    return billingRecords.filter((bill) => {
      return bill.patient.toLowerCase().includes(normalized) || bill.id.toLowerCase().includes(normalized);
    });
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / DEFAULT_PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * DEFAULT_PAGE_SIZE;
  const pagedBills = filteredBills.slice(startIndex, startIndex + DEFAULT_PAGE_SIZE);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Billing & Payments | Billing Records</h1>

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <p className="text-lg font-semibold text-gray-500">{card.title}</p>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-white ${card.chip}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className={`mt-3 text-4xl font-bold ${card.accent}`}>{card.value}</p>
                <div className="mt-2 space-y-1 text-sm text-gray-700">
                  {card.lines.map((line) => (
                    <p key={line} className="font-semibold">{line}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Billing Queue</h2>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
            <div className="relative w-full lg:max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              <input
                placeholder="Search Patient"
                className="w-full h-10 rounded-lg border border-gray-300 bg-gray-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" className="h-10 rounded-lg bg-green-500 px-3.5 text-sm font-semibold text-white flex items-center gap-1.5">
                <Plus size={16} />
                Create New Bill
              </button>
              <button type="button" className="h-10 rounded-lg border border-gray-300 bg-gray-100 px-3.5 text-sm font-medium text-gray-600 flex items-center gap-1.5">
                <ChevronDown size={16} />
                Filter
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-200/90 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Patient Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Total</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedBills.map((bill) => (
                  <tr key={bill.id} className="border-t border-gray-200 hover:bg-gray-200/40 text-gray-800">
                    <td className="px-3 py-2 font-semibold">{bill.id}</td>
                    <td className="px-3 py-2">{bill.patient}</td>
                    <td className="px-3 py-2">{bill.date}</td>
                    <td className="px-3 py-2 font-semibold">{bill.total}</td>
                    <td className="px-3 py-2">{bill.status}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="text-blue-600 font-semibold hover:text-blue-700">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 text-sm text-gray-600">
            <p>
              Showing <span className="rounded-md bg-gray-300 px-2">{pagedBills.length}</span> out of {filteredBills.length}
            </p>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => (
                <button
                  key={page}
                  type="button"
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
    </div>
  );
}
