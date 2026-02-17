import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  HeartPulse,
  Boxes,
  TriangleAlert,
  Truck,
  FileText,
  CreditCard,
  LineChart,
  Shield,
} from 'lucide-react';

function TopLink({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-base font-semibold transition ${
          isActive ? 'bg-blue-600 text-white' : 'text-gray-800 hover:bg-gray-200'
        }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

function SubLink({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 text-sm font-semibold transition ${
          isActive ? 'bg-white/15 text-white' : 'text-blue-100 hover:bg-white/10'
        }`
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );
}

function Group({
  to,
  active,
  icon: Icon,
  label,
  children,
}: {
  to: string;
  active: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  children?: React.ReactNode;
}) {
  if (!active) {
    return (
      <NavLink
        to={to}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-base font-semibold text-gray-800 hover:bg-gray-200 transition"
      >
        <Icon size={18} />
        {label}
      </NavLink>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-blue-600 text-white">
      <NavLink to={to} className="flex items-center gap-2.5 px-3 py-2 text-base font-semibold hover:bg-white/10 transition">
        <Icon size={18} />
        {label}
      </NavLink>
      <div>{children}</div>
    </div>
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();

  const inventoryActive = pathname.startsWith('/inventory');
  const billingActive = pathname.startsWith('/billing');
  const reportsActive = pathname.startsWith('/reports');

  return (
    <aside className="relative z-30 w-[250px] bg-[#F5F7FA] flex flex-col h-full px-5 py-5">
      <div className="flex items-center gap-2.5 text-blue-600 mb-7">
        <HeartPulse size={30} />
        <span className="text-xl font-bold tracking-tight">CLINIKA+</span>
      </div>

      <div className="text-lg font-bold text-gray-500 mb-2">Main Menu</div>
      <nav className="space-y-2">
        <TopLink to="/dashboard" label="Overview" icon={LayoutDashboard} />

        <Group to="/inventory/current-stocks" active={inventoryActive} label="Inventory" icon={Package}>
          <SubLink to="/inventory/current-stocks" label="Current Stocks" icon={Boxes} />
          <SubLink to="/inventory/alerts" label="Inventory Alerts" icon={TriangleAlert} />
          <SubLink to="/inventory/restock" label="Restock & Suppliers" icon={Truck} />
        </Group>

        <Group to="/billing/records" active={billingActive} label="Billing & Payments" icon={Receipt}>
          <SubLink to="/billing/records" label="Billing Records" icon={FileText} />
          <SubLink to="/billing/payments" label="Payments" icon={CreditCard} />
        </Group>

        <Group to="/reports/revenue" active={reportsActive} label="Reports & Insurance" icon={BarChart3}>
          <SubLink to="/reports/revenue" label="Revenue Reports" icon={LineChart} />
          <SubLink to="/reports/claims" label="Insurance Claims" icon={Shield} />
        </Group>
      </nav>

      <div className="mt-auto pt-6">
        <div className="text-lg font-bold text-gray-500 mb-2">Others</div>
        <div className="space-y-2">
          <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-base font-semibold text-gray-800 text-left rounded-lg hover:bg-gray-200 transition">
            <Settings size={18} />
            Settings
          </button>
          <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-base font-semibold text-gray-800 text-left rounded-lg hover:bg-gray-200 transition">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
