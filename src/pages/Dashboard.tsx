import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, Truck, HandCoins, Boxes, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type Tone = 'critical' | 'warning';
type InventoryStatus = 'Adequate' | 'Low' | 'Critical';

type OverviewResponse = {
  summary: {
    overall_system_risk: string;
    high_priority_issues: number;
    inventory_stability: string;
    cash_flow_condition: string;
    outstanding_balance: number;
  };
  alerts: Array<{
    title: string;
    message: string;
    tone: Tone;
    medication_key?: string;
  }>;
  inventory_highlights: Array<{
    medication_key: string;
    medication_name: string;
    stock: number;
    unit: string;
    status: InventoryStatus;
    expiry_label: string;
  }>;
  near_expiry_batches: number;
  near_expiry_items: Array<{
    medication_key: string;
    medication_name: string;
    expiry_label: string;
  }>;
  restocking_overview: {
    suggested_orders: Array<{
      medication_name: string;
      quantity: number;
      unit: string;
    }>;
    next_supply_delivery: {
      supplier_name: string;
      date: string | null;
    } | null;
  };
  financial_summary: {
    revenue_today: number;
    pending_payments: number;
    total_transactions: number;
    insurance_claims_in_progress: number;
  };
};

function toPeso(value: number) {
  return `P${Math.round(value).toLocaleString()}`;
}

function formatDeliveryDate(value: string | null) {
  if (!value) return 'No schedule';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No schedule';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function riskBarColor(risk: string) {
  if (risk === 'Critical') return 'bg-red-500';
  if (risk === 'Warning') return 'bg-amber-500';
  return 'bg-green-500';
}

function statusToneColor(status: string) {
  if (status === 'Critical') return 'bg-red-500';
  if (status === 'Warning' || status === 'At Risk') return 'bg-amber-500';
  return 'bg-green-500';
}

function cashToneColor(status: string) {
  if (status === 'Critical') return 'bg-red-500';
  if (status === 'Warning' || status === 'At Risk') return 'bg-amber-500';
  return 'bg-green-500';
}

function OverviewSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 animate-pulse">
        {[1, 2, 3].map((card) => (
          <div key={card} className="rounded-2xl border border-gray-200 bg-gray-100 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="h-5 w-44 rounded bg-gray-300" />
              <div className="h-8 w-8 rounded-xl bg-gray-300" />
            </div>
            <div className="h-10 w-28 rounded bg-gray-300" />
            <div className="my-4 h-2 w-full rounded bg-gray-300" />
            <div className="h-4 w-40 rounded bg-gray-300" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr] rounded-2xl bg-gray-100 p-5 animate-pulse">
        <div className="mx-auto flex w-full max-w-[220px] flex-col items-start gap-3 pt-4">
          <div className="h-9 w-9 rounded-full bg-gray-300" />
          <div className="h-6 w-44 rounded bg-gray-300" />
          <div className="h-5 w-24 rounded bg-gray-300" />
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="rounded-xl border border-gray-300 bg-gray-50 p-3">
              <div className="h-4 w-24 rounded bg-gray-300" />
              <div className="mt-2 h-3 w-full rounded bg-gray-300" />
              <div className="mt-1 h-3 w-5/6 rounded bg-gray-300" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr] animate-pulse">
        <div className="rounded-2xl bg-gray-100 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="h-6 w-56 rounded bg-gray-300" />
            <div className="h-4 w-16 rounded bg-gray-300" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-8 w-full rounded-xl bg-gray-300" />
            ))}
          </div>
          <div className="mt-2 h-9 w-full rounded-xl bg-gray-300" />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-gray-100 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[140px_1fr_1fr]">
              <div className="h-20 rounded bg-gray-300" />
              <div className="h-20 rounded bg-gray-300" />
              <div className="h-20 rounded bg-gray-300" />
            </div>
          </div>
          <div className="rounded-2xl bg-gray-100 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[140px_1fr]">
              <div className="h-20 rounded bg-gray-300" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-16 rounded bg-gray-300" />
                <div className="h-16 rounded bg-gray-300" />
                <div className="h-16 rounded bg-gray-300" />
                <div className="h-16 rounded bg-gray-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      setIsLoading(true);
      setLoadError('');
      try {
        const response = await fetch(`${API_BASE_URL}/overview`);
        if (!response.ok) {
          throw new Error('Failed to load overview data.');
        }
        const data = (await response.json()) as OverviewResponse;
        if (isMounted) setOverview(data);
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load overview data.');
          setOverview(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadOverview();
    return () => {
      isMounted = false;
    };
  }, []);

  const alerts = overview?.alerts || [];
  const inventoryRows = overview?.inventory_highlights || [];
  const suggestedOrders = overview?.restocking_overview?.suggested_orders || [];
  const nextSupply = overview?.restocking_overview?.next_supply_delivery || null;
  const visibleSuggestedOrders = suggestedOrders.slice(0, 2);
  const visibleNextSupply = nextSupply ? [nextSupply].slice(0, 2) : [];
  const nearExpiryItems = overview?.near_expiry_items || [];

  const summary = useMemo(() => {
    return {
      overallRisk: overview?.summary.overall_system_risk || 'Stable',
      highPriorityIssues: overview?.summary.high_priority_issues || 0,
      inventoryStability: overview?.summary.inventory_stability || 'Stable',
      cashFlowCondition: overview?.summary.cash_flow_condition || 'Stable',
      outstandingBalance: overview?.summary.outstanding_balance || 0,
      nearExpiryBatches: overview?.near_expiry_batches || 0,
      revenueToday: overview?.financial_summary.revenue_today || 0,
      pendingPayments: overview?.financial_summary.pending_payments || 0,
      totalTransactions: overview?.financial_summary.total_transactions || 0,
      insuranceInProgress: overview?.financial_summary.insurance_claims_in_progress || 0,
    };
  }, [overview]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        {isLoading && !overview && <OverviewSkeleton />}
        {!isLoading && loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>
        )}

        {!isLoading && (
        <>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="group rounded-2xl border border-gray-200 bg-gray-100 p-5 transition-all duration-200 hover:border-amber-200 hover:bg-white hover:shadow-xl hover:ring-1 hover:ring-inset hover:ring-amber-200">
            <div className="flex items-start justify-between mb-4">
              <p className="text-lg font-semibold text-gray-500">Overall System Risk</p>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white transition-transform duration-200 group-hover:scale-105">
                <AlertTriangle size={17} />
              </span>
            </div>
            <p className="text-4xl font-bold text-gray-800">{summary.overallRisk}</p>
            <div className={`my-4 h-2 rounded-full ${riskBarColor(summary.overallRisk)}`} />
            <p className="text-base font-semibold text-gray-700">{summary.highPriorityIssues} high-priority issues</p>
          </div>

          <div className="group rounded-2xl border border-gray-200 bg-gray-100 p-5 transition-all duration-200 hover:border-blue-200 hover:bg-white hover:shadow-xl hover:ring-1 hover:ring-inset hover:ring-blue-200">
            <div className="flex items-start justify-between mb-4">
              <p className="text-lg font-semibold text-gray-500">Inventory Stability</p>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500 text-white transition-transform duration-200 group-hover:scale-105">
                <Boxes size={17} />
              </span>
            </div>
            <p className="text-4xl font-bold text-gray-800">{summary.inventoryStability}</p>
            <div className={`my-4 h-2 rounded-full ${statusToneColor(summary.inventoryStability)}`} />
            <p className="text-base font-semibold text-gray-700">Near-expiry & low-stock risks tracked</p>
          </div>

          <div className="group rounded-2xl border border-gray-200 bg-gray-100 p-5 transition-all duration-200 hover:border-green-200 hover:bg-white hover:shadow-xl hover:ring-1 hover:ring-inset hover:ring-green-200">
            <div className="flex items-start justify-between mb-4">
              <p className="text-lg font-semibold text-gray-500">Cash Flow Condition</p>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-green-500 text-white transition-transform duration-200 group-hover:scale-105">
                <HandCoins size={17} />
              </span>
            </div>
            <p className="text-4xl font-bold text-gray-800">{summary.cashFlowCondition}</p>
            <div className={`my-4 h-2 rounded-full ${cashToneColor(summary.cashFlowCondition)}`} />
            <p className="text-base font-semibold text-gray-700">{toPeso(summary.outstandingBalance)} outstanding</p>
          </div>
        </div>

        <div className="rounded-2xl bg-gray-100 p-5 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <div className="mx-auto flex w-full max-w-[220px] flex-col items-start gap-3 pt-4">
            <BellRing size={36} className="text-red-500" />
            <h2 className="text-2xl leading-tight font-semibold text-gray-500">Alerts & Operational Risks</h2>
            <button
              type="button"
              onClick={() => navigate('/inventory/alerts')}
              className="inline-flex items-center px-0 py-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              View Alerts
            </button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {alerts.length === 0 && (
              <div className="p-3 text-center text-base font-semibold text-gray-600 xl:col-span-2">No active alerts.</div>
            )}
            {alerts.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  const focusQuery = item.message || item.title;
                  if (item.medication_key) {
                    navigate(`/inventory/alerts?focusAlertMedicationId=${encodeURIComponent(item.medication_key)}&focusAlertName=${encodeURIComponent(item.title)}&focusAlertQuery=${encodeURIComponent(focusQuery)}`);
                    return;
                  }
                  navigate(`/inventory/alerts?focusAlertName=${encodeURIComponent(item.title)}&focusAlertQuery=${encodeURIComponent(focusQuery)}`);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    const focusQuery = item.message || item.title;
                    if (item.medication_key) {
                      navigate(`/inventory/alerts?focusAlertMedicationId=${encodeURIComponent(item.medication_key)}&focusAlertName=${encodeURIComponent(item.title)}&focusAlertQuery=${encodeURIComponent(focusQuery)}`);
                      return;
                    }
                    navigate(`/inventory/alerts?focusAlertName=${encodeURIComponent(item.title)}&focusAlertQuery=${encodeURIComponent(focusQuery)}`);
                  }
                }}
                className={`rounded-xl border p-3 ${item.tone === 'critical' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'} cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}
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
              <button
                type="button"
                onClick={() => navigate('/inventory')}
                className="text-blue-600 text-base font-semibold"
              >
                See All
              </button>
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
                {inventoryRows.length === 0 && (
                  <tr className="bg-gray-300/70 text-gray-700">
                    <td className="px-3 py-2 rounded-xl" colSpan={4}>No inventory records available.</td>
                  </tr>
                )}
                {inventoryRows.map((row) => (
                  <tr
                    key={row.medication_name}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      navigate(`/inventory?focusMedicationId=${encodeURIComponent(row.medication_key)}&openMedicationId=${encodeURIComponent(row.medication_key)}`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/inventory?focusMedicationId=${encodeURIComponent(row.medication_key)}&openMedicationId=${encodeURIComponent(row.medication_key)}`);
                      }
                    }}
                    className="bg-gray-300/70 text-gray-800 cursor-pointer transition hover:bg-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <td className="px-3 py-2 rounded-l-xl font-semibold text-[#2B2F33]">{row.medication_name}</td>
                    <td className="px-3 py-2 font-semibold">{row.stock} {row.unit}</td>
                    <td
                      className={`px-3 py-2 font-semibold ${
                        row.status === 'Adequate' ? 'text-green-500' : row.status === 'Low' ? 'text-amber-500' : 'text-red-500'
                      }`}
                    >
                      {row.status}
                    </td>
                    <td className="px-3 py-2 rounded-r-xl font-semibold">{row.expiry_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              type="button"
              onClick={() => {
                const target = nearExpiryItems[0];
                if (!target) {
                  navigate('/inventory');
                  return;
                }
                navigate(`/inventory?focusMedicationId=${encodeURIComponent(target.medication_key)}&openMedicationId=${encodeURIComponent(target.medication_key)}`);
              }}
              className="mt-2 w-full rounded-xl bg-gray-300 px-3 py-2 text-sm font-semibold text-gray-500 flex justify-between items-center cursor-pointer transition hover:bg-gray-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <span>Near-expiry batches:</span>
              <span>{summary.nearExpiryBatches} batches</span>
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-gray-100 p-5 grid grid-cols-[140px_1fr_1fr] gap-4 items-start">
              <div className="text-gray-500">
                <Truck size={44} className="text-blue-600 mb-2" />
                <h3 className="text-xl leading-tight font-semibold">Restocking Overview</h3>
                <button
                  type="button"
                  onClick={() => navigate('/restock')}
                  className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  View Restocking
                </button>
              </div>
              <div>
                <div className="inline-block rounded-full bg-blue-600 px-3 py-1 text-white text-xs mb-2">Suggested Orders</div>
                <div className="space-y-1 text-sm">
                  {visibleSuggestedOrders.length === 0 && <p>No suggested orders</p>}
                  {visibleSuggestedOrders.map((order) => (
                    <p key={order.medication_name}>{order.medication_name} {order.quantity} {order.unit}</p>
                  ))}
                </div>
              </div>
              <div>
                <div className="inline-block rounded-full bg-blue-600 px-3 py-1 text-white text-xs mb-2">Next Supply Delivery</div>
                <div className="space-y-1 text-sm">
                  {visibleNextSupply.length > 0 ? (
                    visibleNextSupply.map((supply) => (
                      <div key={supply.supplier_name}>
                        <p>{supply.supplier_name}</p>
                        <p>{formatDeliveryDate(supply.date)}</p>
                      </div>
                    ))
                  ) : (
                    <p>Pending supplier confirmation</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-gray-100 p-5 grid grid-cols-[140px_1fr] gap-4 items-start">
              <div className="text-gray-500">
                <TrendingUp size={44} className="text-green-500 mb-2" />
                <h3 className="text-xl leading-tight font-semibold">Financial Summary</h3>
                <button
                  type="button"
                  onClick={() => navigate('/reports')}
                  className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  View Reports
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-gray-700">
                <div>
                  <p className="text-gray-500">Revenue Today</p>
                  <p className="text-xl text-gray-800">{toPeso(summary.revenueToday)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Pending Payments</p>
                  <p className="text-xl text-gray-800">{summary.pendingPayments}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Transactions</p>
                  <p className="text-xl text-gray-800">{summary.totalTransactions}</p>
                </div>
                <div>
                  <p className="text-gray-500">Insurance Claims in Progress</p>
                  <p className="text-xl text-gray-800">{summary.insuranceInProgress} records</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </section>
    </div>
  );
}

