import { AlertTriangle, BellRing, Truck, HandCoins, Boxes, TrendingUp } from 'lucide-react';

const alerts = [
  {
    title: 'Critical:',
    message: 'Insulin stock at 3 units, immediate restocking required to avoid treatment disruption.',
    tone: 'critical',
  },
  {
    title: 'Warning:',
    message: 'Amoxicillin batch expiring in 7 days, prioritize dispensing or initiate supplier return.',
    tone: 'warning',
  },
  {
    title: 'Warning:',
    message: 'Amoxicillin batch expiring in 7 days, prioritize dispensing or initiate supplier return.',
    tone: 'warning',
  },
  {
    title: 'Warning:',
    message: 'Amoxicillin batch expiring in 7 days, prioritize dispensing or initiate supplier return.',
    tone: 'warning',
  },
];

const inventoryRows = [
  ['Paracetamol', '90 units', 'Adequate', '----'],
  ['Amoxicillin', '12 units', 'Low', '7 days'],
  ['Insulin', '3 units', 'Critical', '30 days'],
  ['Buscopan', '5 units', 'Critical', '15 days'],
  ['Multivitamin', '2 units', 'Critical', '10 days'],
];

export default function Dashboard() {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Overview</h1>

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-100 p-5">
            <div className="flex items-start justify-between mb-4">
              <p className="text-lg font-semibold text-gray-500">Overall System Risk</p>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white">
                <AlertTriangle size={17} />
              </span>
            </div>
            <p className="text-4xl font-bold text-gray-800">Critical</p>
            <div className="my-4 h-2 rounded-full bg-red-500" />
            <p className="text-base font-semibold text-gray-700">3 high-priority issues</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-100 p-5">
            <div className="flex items-start justify-between mb-4">
              <p className="text-lg font-semibold text-gray-500">Inventory Stability</p>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500 text-white">
                <Boxes size={17} />
              </span>
            </div>
            <p className="text-4xl font-bold text-gray-800">At Risk</p>
            <div className="my-4 h-2 rounded-full bg-amber-500" />
            <p className="text-base font-semibold text-gray-700">Recurrent low stock</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-100 p-5">
            <div className="flex items-start justify-between mb-4">
              <p className="text-lg font-semibold text-gray-500">Cash Flow Condition</p>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-green-500 text-white">
                <HandCoins size={17} />
              </span>
            </div>
            <p className="text-4xl font-bold text-gray-800">Stable</p>
            <div className="my-4 h-2 rounded-full bg-green-500" />
            <p className="text-base font-semibold text-gray-700">P8,400 outstanding</p>
          </div>
        </div>

        <div className="rounded-2xl bg-gray-100 p-5 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <div className="flex items-center justify-center gap-3">
            <BellRing size={52} className="text-red-500" />
            <h2 className="text-2xl leading-tight font-semibold text-gray-500">Alerts & Operational Risks</h2>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {alerts.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className={`rounded-xl border p-3 ${item.tone === 'critical' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}
              >
                <p className={`text-base font-bold ${item.tone === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>{item.title}</p>
                <p className="text-sm text-gray-700">{item.message}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-4">
          <div className="rounded-2xl bg-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-500 flex items-center gap-2">
                <Boxes size={21} />
                Inventory Highlights
              </h3>
              <button className="text-blue-600 text-base font-semibold">See All</button>
            </div>

            <table className="w-full text-sm border-separate border-spacing-y-2">
              <thead>
                <tr className="bg-gray-300 text-gray-700">
                  <th className="text-left px-3 py-2 rounded-l-xl">Medication Name</th>
                  <th className="text-left px-3 py-2">Stock</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2 rounded-r-xl">Expiry</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRows.map((row) => (
                  <tr key={row[0]} className="bg-gray-300/70 text-gray-800">
                    <td className="px-3 py-2 rounded-l-xl font-semibold">{row[0]}</td>
                    <td className="px-3 py-2 font-semibold">{row[1]}</td>
                    <td
                      className={`px-3 py-2 font-semibold ${
                        row[2] === 'Adequate' ? 'text-green-500' : row[2] === 'Low' ? 'text-amber-500' : 'text-red-500'
                      }`}
                    >
                      {row[2]}
                    </td>
                    <td className="px-3 py-2 rounded-r-xl font-semibold">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-2 rounded-xl bg-gray-300 px-3 py-2 text-sm font-semibold text-gray-500 flex justify-between">
              <span>Near-expiry batches:</span>
              <span>2 batches</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-gray-100 p-5 grid grid-cols-[140px_1fr_1fr] gap-4 items-start">
              <div className="text-gray-500">
                <Truck size={44} className="text-blue-600 mb-2" />
                <h3 className="text-xl leading-tight font-semibold">Restocking Overview</h3>
              </div>
              <div>
                <div className="inline-block rounded-full bg-blue-600 px-3 py-1 text-white text-xs mb-2">Suggested Orders</div>
                <div className="space-y-1 text-sm">
                  <p>Amoxicillin 50 units</p>
                  <p>Insulin 20 units</p>
                  <p>Buscopan 20 units</p>
                  <p>Multivitamin 20 units</p>
                </div>
              </div>
              <div>
                <div className="inline-block rounded-full bg-blue-600 px-3 py-1 text-white text-xs mb-2">Next Supply Delivery</div>
                <div className="space-y-1 text-sm">
                  <p>MedSupplyCo - Jan 12</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-gray-100 p-5 grid grid-cols-[140px_1fr] gap-4 items-start">
              <div className="text-gray-500">
                <TrendingUp size={44} className="text-green-500 mb-2" />
                <h3 className="text-xl leading-tight font-semibold">Financial Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-gray-700">
                <div>
                  <p className="text-gray-500">Revenue Today</p>
                  <p className="text-xl text-gray-800">P25,000</p>
                </div>
                <div>
                  <p className="text-gray-500">Pending Payments</p>
                  <p className="text-xl text-gray-800">3</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Transactions</p>
                  <p className="text-xl text-gray-800">47</p>
                </div>
                <div>
                  <p className="text-gray-500">Insurance Claims in Progress</p>
                  <p className="text-xl text-gray-800">6 records</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
