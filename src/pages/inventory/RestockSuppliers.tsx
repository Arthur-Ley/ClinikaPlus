import { useMemo, useState } from 'react';
import {
  Boxes,
  ChevronDown,
  Clock3,
  PlusCircle,
  Search,
  ShieldCheck,
  Syringe,
  Truck,
} from 'lucide-react';
import Button from '../../components/ui/Button.tsx';

type RequestStatus = 'Pending' | 'Completed';

type RestockRequest = {
  id: string;
  medication: string;
  quantity: number;
  requestedOn: string;
  supplier: string;
  status: RequestStatus;
};

type SupplierStatus = 'Preferred' | 'Active' | 'Review';

type Supplier = {
  id: string;
  name: string;
  totalRequests: number;
  completed: number;
  cancelled: number;
  status: SupplierStatus;
};

const restockRequests: RestockRequest[] = [
  {
    id: 'RR-1023',
    medication: 'Insulin (Rapid)',
    quantity: 50,
    requestedOn: 'Feb 08, 2026',
    supplier: 'MedSupply Co.',
    status: 'Pending',
  },
  {
    id: 'RR-1023',
    medication: 'Insulin (Rapid)',
    quantity: 50,
    requestedOn: 'Feb 08, 2026',
    supplier: 'MedSupply Co.',
    status: 'Completed',
  },
];

const suppliers: Supplier[] = [
  { id: 'SUP-001', name: 'MedSupply Co.', totalRequests: 28, completed: 24, cancelled: 2, status: 'Preferred' },
  { id: 'SUP-002', name: 'PharmaPlus', totalRequests: 14, completed: 12, cancelled: 1, status: 'Active' },
  { id: 'SUP-003', name: 'HealthSource', totalRequests: 6, completed: 3, cancelled: 2, status: 'Review' },
];

function cardIconStyle(tone: 'blue' | 'amber') {
  return tone === 'blue'
    ? 'bg-blue-600/90 text-white'
    : 'bg-amber-500/90 text-white';
}

export default function RestockSuppliers() {
  const [medicationSearch, setMedicationSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const matchesSearch = supplier.name.toLowerCase().includes(supplierSearch.toLowerCase());
      const matchesStatus = statusFilter === 'All Status' || supplier.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [statusFilter, supplierSearch]);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Inventory | Restock and Suppliers</h1>

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Critical Needs</p>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${cardIconStyle('blue')}`}>
                <Syringe className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-blue-600">2 medications</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Require immediate restocking</p>
            <p className="mt-2 text-sm text-gray-700">Most Urgent: Insulin</p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Pending Requests</p>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${cardIconStyle('amber')}`}>
                <Clock3 className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-amber-500">4 stock requests</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Awaiting action</p>
            <p className="mt-2 text-sm text-gray-700">Oldest: Feb 08, 2026</p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <p className="text-lg font-semibold text-gray-500">Supplier Coverage</p>
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${cardIconStyle('blue')}`}>
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-blue-600">3 Active</p>
            <p className="mt-1 text-base font-semibold text-gray-800">Suppliers supplying key medicines</p>
            <p className="mt-2 text-sm text-gray-700">Preferred: MedSupply Co.</p>
          </article>
        </div>

        <div className="rounded-2xl bg-gray-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-w-[150px] items-center gap-3 pr-4 lg:border-r lg:border-gray-200">
              <Boxes className="h-7 w-7 text-gray-500" />
              <div>
                <p className="text-3xl font-semibold leading-tight text-gray-600">Restock</p>
                <p className="text-3xl font-semibold leading-tight text-gray-600">Requests</p>
                <button className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700">View All</button>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={medicationSearch}
                    onChange={(e) => setMedicationSearch(e.target.value)}
                    placeholder="Search Medication"
                    className="h-10 w-full rounded-lg border border-gray-300 bg-gray-100 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex h-10 items-center gap-1 rounded-lg border border-gray-300 bg-gray-100 px-3 text-sm text-gray-600">
                    <ChevronDown className="h-4 w-4" />
                    Severity
                  </button>
                  <button className="inline-flex h-10 items-center gap-1 rounded-lg border border-gray-300 bg-gray-100 px-3 text-sm text-gray-600">
                    <ChevronDown className="h-4 w-4" />
                    Category
                  </button>
                  <button className="inline-flex h-10 items-center gap-1 rounded-lg border border-gray-300 bg-gray-100 px-3 text-sm text-gray-600">
                    <ChevronDown className="h-4 w-4" />
                    Category
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {restockRequests.map((request, idx) => (
                  <article key={`${request.id}-${idx}`} className="rounded-xl border border-blue-300 bg-blue-100/70 p-4 text-sm">
                    <div className="flex items-center gap-1 text-blue-700">
                      <Truck className="h-3.5 w-3.5" />
                      <span className="font-semibold">Request ID: {request.id}</span>
                    </div>
                    <p className="text-gray-800">Medication: {request.medication}</p>
                    <p className="text-gray-800">Quantity: {request.quantity} units</p>
                    <p className="text-gray-800">Requested On: {request.requestedOn}</p>
                    <p className="text-gray-800">Supplier: {request.supplier}</p>
                    <p className={request.status === 'Pending' ? 'text-amber-600' : 'text-blue-600'}>Status: {request.status}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-blue-600">
                      <button className="hover:text-blue-700">View Stock Request</button>
                      {request.status === 'Pending' && <button className="hover:text-blue-700">Adjust Restock</button>}
                      {request.status === 'Pending' && <button className="hover:text-blue-700">Cancel</button>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gray-100 p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder="Search Supplier"
                className="h-10 w-full rounded-lg border border-gray-300 bg-gray-100 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button className="inline-flex h-10 items-center gap-2 whitespace-nowrap bg-green-500 pl-3 pr-4 py-1.5 text-sm hover:bg-green-600">
                <PlusCircle className="h-4 w-4 shrink-0" />
                Add Supplier
              </Button>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 appearance-none rounded-lg border border-gray-300 bg-gray-100 pl-3 pr-8 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option>All Status</option>
                  <option>Preferred</option>
                  <option>Active</option>
                  <option>Review</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-200/90 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Supplier Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Total Requests</th>
                  <th className="px-3 py-2 text-left font-semibold">Completed</th>
                  <th className="px-3 py-2 text-left font-semibold">Cancelled</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-t border-gray-200 hover:bg-gray-200/40">
                    <td className="px-3 py-2 font-semibold text-gray-800">{supplier.id}</td>
                    <td className="px-3 py-2 text-gray-800">{supplier.name}</td>
                    <td className="px-3 py-2 text-gray-700">{supplier.totalRequests}</td>
                    <td className="px-3 py-2 text-gray-700">{supplier.completed}</td>
                    <td className="px-3 py-2 text-gray-700">{supplier.cancelled}</td>
                    <td className="px-3 py-2 text-gray-800">{supplier.status}</td>
                    <td className="px-3 py-2">
                      <button className="font-semibold text-blue-600 hover:text-blue-700">View</button>
                    </td>
                  </tr>
                ))}
                {filteredSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-5 text-center text-sm text-gray-500">
                      No suppliers match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
