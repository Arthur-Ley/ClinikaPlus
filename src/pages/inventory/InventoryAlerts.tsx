import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search, ChevronDown } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, inventoryAlerts } from '../../data/mockData';

const alerts = inventoryAlerts;

const severityColors = {
  critical: 'border-red-300 bg-red-50',
  warning: 'border-amber-300 bg-amber-50',
};

export default function InventoryAlerts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      return (
        alert.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (severityFilter === '' || alert.severity === severityFilter) &&
        (categoryFilter === '' || alert.category.toLowerCase().includes(categoryFilter.toLowerCase()))
      );
    });
  }, [searchTerm, severityFilter, categoryFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, severityFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / DEFAULT_PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * DEFAULT_PAGE_SIZE;
  const pagedAlerts = filteredAlerts.slice(startIndex, startIndex + DEFAULT_PAGE_SIZE);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Inventory | Inventory Alerts</h1>

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg text-gray-500 font-semibold">Critical Medications</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-red-500">1 Medications</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Needs Immediate Restock</p>
            <p className="mt-3 text-sm text-gray-600">Categories: Diabetes, Antibiotics</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg text-gray-500 font-semibold">High-Risk Medications</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-amber-500">5 Medications</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Expiring Soon / Low Stock</p>
            <p className="mt-3 text-sm text-gray-600">Categories: Allergy Meds, Respiratory, Pain Relievers</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg text-gray-500 font-semibold">Most Affected Category</p>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-blue-600">Diabetes Care</p>
            <p className="mt-2 text-base font-semibold text-gray-800">Critical &amp; High Risks: 1</p>
          </div>
        </div>

        <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-5">
            <div className="w-full md:max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search Medication"
                className="w-full pl-9 pr-4 h-10 border border-gray-300 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <div className="relative">
                <select
                  className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                >
                  <option value="">Severity</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  className="appearance-none h-10 pl-3 pr-8 border border-gray-300 rounded-lg bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">Category</option>
                  <option value="Diabetes">Diabetes</option>
                  <option value="Antibiotic">Antibiotic</option>
                  <option value="Respiratory">Respiratory</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pagedAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl border p-4 ${severityColors[alert.severity as keyof typeof severityColors] || 'border-gray-300 bg-gray-50'}`}
              >
                <p className={`text-sm font-semibold ${alert.severity === 'critical' ? 'text-red-500' : 'text-amber-600'}`}>
                  {alert.name} - {alert.category}
                </p>
                <div className="mt-2 text-sm text-gray-800 leading-6">
                  <p>Low Stock: {alert.lowStock} units</p>
                  <p>Expiry: {alert.expiry}</p>
                  <p>Suggested Restock: {alert.suggestedRestock} units</p>
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <button className="text-blue-600 hover:text-blue-700">View</button>
                  <button className="text-blue-600 hover:text-blue-700">Create Restock Request</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <p className="text-sm text-gray-600">Showing {pagedAlerts.length} out of {filteredAlerts.length}</p>
            <div className="flex items-center gap-2 text-sm">
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-6 h-6 rounded-md ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
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
