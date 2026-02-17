import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button.tsx';
import { Plus, X, Search, ChevronDown, Boxes, AlertTriangle, PackageX } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, inventoryItems } from '../../data/mockData';

const items = inventoryItems;

export default function CurrentStocks() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<typeof items[0] | null>(null);
  const [filterCategory, setFilterCategory] = useState('All Categories');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [filterMonth, setFilterMonth] = useState('This Month');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'All Status' || item.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, filterStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / DEFAULT_PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * DEFAULT_PAGE_SIZE;
  const pagedItems = filteredItems.slice(startIndex, startIndex + DEFAULT_PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-800">Inventory | Current Stocks</h1>
      </div>

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Inventory Health</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/90 text-white">
                <Boxes className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-blue-600">128 Products</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Tracked in active inventory</p>
            <p className="mt-2 text-sm text-gray-700">Low Stock: 6 | Out of Stock: 2</p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Critical Items</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/90 text-white">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-amber-500">6 Medications</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Below reorder threshold</p>
            <p className="mt-2 text-sm text-gray-700">Most Affected: Diabetes Care</p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Out of Stock</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-white">
                <PackageX className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-red-500">2 Medications</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Unavailable for dispensing</p>
            <p className="mt-2 text-sm text-gray-700">Immediate restock required</p>
          </article>
        </div>

        <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-5">
            <div className="flex w-full md:w-auto items-center gap-2">
              <div className="w-full md:w-72 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search Medication"
                  className="w-full h-10 pl-9 pr-4 border border-gray-300 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button className="inline-flex h-10 items-center gap-2 whitespace-nowrap bg-green-600 pl-3 pr-4 py-1.5 text-sm text-white hover:bg-green-700">
                <Plus size={16} className="shrink-0" />
                Add Medication
              </Button>

              <div className="relative">
                <select
                  className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option>All Categories</option>
                  <option>Pain Relievers</option>
                  <option>Antibiotics</option>
                  <option>Antivirals</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option>All Status</option>
                  <option>Adequate</option>
                  <option>Low</option>
                  <option>Critical</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                >
                  <option>This Month</option>
                  <option>Last Month</option>
                  <option>Last 3 Months</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-200/90 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Medication Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                  <th className="px-3 py-2 text-left font-semibold">Batch</th>
                  <th className="px-3 py-2 text-left font-semibold">Stock</th>
                  <th className="px-3 py-2 text-left font-semibold">Threshold</th>
                  <th className="px-3 py-2 text-left font-semibold">Expiry Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item, idx) => (
                  <tr key={item.id} className="border-t border-gray-200 hover:bg-gray-200/40">
                    <td className="px-3 py-2 font-semibold text-gray-800">#{String(startIndex + idx + 1).padStart(3, '0')}</td>
                    <td className="px-3 py-2 text-gray-800">{item.name}</td>
                    <td className="px-3 py-2 text-gray-700">Diabetes Care</td>
                    <td className="px-3 py-2 text-gray-700">I-4432</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{item.stock}</td>
                    <td className="px-3 py-2 text-gray-700">{item.reorder}</td>
                    <td className="px-3 py-2 text-gray-800">{item.expiry}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'Critical'
                            ? 'bg-red-100 text-red-700'
                            : item.status === 'Low'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => setSelectedItem(item)} className="text-blue-600 hover:text-blue-700 font-semibold">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-gray-600">
            <p>
              Showing <span className="rounded-md bg-gray-300 px-2">{pagedItems.length}</span> out of {filteredItems.length}
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

      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedItem(null)}>
          <div className="bg-gray-100 border border-gray-300 rounded-2xl p-6 shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Medication Details</h2>
              <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">Medication Name</p>
                <p className="font-semibold text-gray-900">{selectedItem.name} (Rapid)</p>
              </div>
              <div>
                <p className="text-gray-600">Batch</p>
                <p className="font-semibold text-gray-900">I-4432</p>
              </div>
              <div>
                <p className="text-gray-600">Category</p>
                <p className="font-semibold text-gray-900">Diabetes Care</p>
              </div>
              <div>
                <p className="text-gray-600">Stock</p>
                <p className="font-semibold text-gray-900">{selectedItem.stock} units</p>
              </div>
              <div>
                <p className="text-gray-600">Threshold</p>
                <p className="font-semibold text-gray-900">{selectedItem.reorder} units</p>
              </div>
              <div>
                <p className="text-gray-600">Expiry</p>
                <p className="font-semibold text-gray-900">{selectedItem.expiry}</p>
              </div>
              <div>
                <p className="text-gray-600">Status</p>
                <p
                  className={`font-semibold ${
                    selectedItem.status === 'Critical'
                      ? 'text-red-700'
                      : selectedItem.status === 'Low'
                        ? 'text-amber-700'
                        : 'text-green-700'
                  }`}
                >
                  {selectedItem.status}
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button className="flex-1" onClick={() => setSelectedItem(null)}>
                Edit
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setSelectedItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
