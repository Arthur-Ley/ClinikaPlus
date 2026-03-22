import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  HeartPulse,
  Boxes,
  Truck,
  FileText,
  ArrowLeftRight,
} from 'lucide-react';
import { RESTOCK_REQUESTS_CHANGED_EVENT } from '../pages/pharmacy/restockRequestsStore';

type LinkIcon = React.ComponentType<{ size?: number; className?: string }>;
type BadgeCount = number;

type InventoryAlertApiItem = {
  medication_id: number;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

function CountBadge({ count, active }: { count: BadgeCount; active?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-5 ${
        active ? 'bg-white text-blue-700' : 'bg-red-500 text-white'
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function TopLink({ to, label, icon: Icon }: { to: string; label: string; icon: LinkIcon }) {
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
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function SubLink({
  to,
  label,
  icon: Icon,
  badgeCount = 0,
  end = false,
}: {
  to: string;
  label: string;
  icon: LinkIcon;
  badgeCount?: BadgeCount;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 text-sm font-semibold transition ${
          isActive ? 'bg-white/15 text-white' : 'text-blue-100 hover:bg-white/10'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} />
          <span className="truncate">{label}</span>
          <span className="ml-auto">
            <CountBadge count={badgeCount} active={isActive} />
          </span>
        </>
      )}
    </NavLink>
  );
}

function Group({
  to,
  active,
  icon: Icon,
  label,
  badgeCount,
  children,
}: {
  to: string;
  active: boolean;
  icon: LinkIcon;
  label: string;
  badgeCount?: BadgeCount;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg transition-colors duration-300 ${
        active ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-800'
      }`}
    >
      <NavLink
        to={to}
        className={`flex items-center gap-2.5 px-3 py-2 text-base font-semibold transition-colors duration-300 ${
          active ? 'hover:bg-white/10' : 'hover:bg-gray-200'
        }`}
      >
        <Icon size={18} />
        <span className="truncate">{label}</span>
        <span className="ml-auto">
          <CountBadge count={badgeCount || 0} active={active} />
        </span>
      </NavLink>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          active ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pb-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [inventoryAlertCount, setInventoryAlertCount] = useState(0);

  const matchesRoute = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  const pharmacyActive = ['/pharmacy', '/inventory', '/restock', '/suppliers'].some(matchesRoute);
  const billingActive = matchesRoute('/billing') || pathname === '/reports' || pathname === '/transactions';

  useEffect(() => {
    let isMounted = true;

    async function loadInventoryAlertCount() {
      try {
        const response = await fetch(`${API_BASE_URL}/inventory-alerts`);
        if (!response.ok) throw new Error('Failed to load inventory alerts counter.');
        const json = (await response.json()) as { items: InventoryAlertApiItem[] };
        const nextCount = (json.items || []).length;
        if (isMounted) setInventoryAlertCount(nextCount);
      } catch {
        if (isMounted) setInventoryAlertCount(0);
      }
    }

    loadInventoryAlertCount();

    function handleRequestChange() {
      loadInventoryAlertCount();
    }

    window.addEventListener(RESTOCK_REQUESTS_CHANGED_EVENT, handleRequestChange);
    return () => {
      isMounted = false;
      window.removeEventListener(RESTOCK_REQUESTS_CHANGED_EVENT, handleRequestChange);
    };
  }, [pathname]);

  function handleOpenSettings() {
    navigate('/settings');
  }

  function handleLogout() {
    try {
      window.sessionStorage.clear();
      window.localStorage.removeItem('auth');
      window.localStorage.removeItem('token');
    } catch {
      // No-op
    }
    navigate('/dashboard');
  }

  return (
    <aside className="relative z-30 flex h-full w-[250px] flex-col overflow-hidden bg-[#F5F7FA] px-5 pt-5">
      <div className="flex items-center gap-2.5 text-blue-600 mb-7">
        <HeartPulse size={30} />
        <span className="text-xl font-bold tracking-tight">CLINIKA+</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="text-lg font-bold text-gray-500 mb-2">Main Menu</div>
        <nav className="space-y-2 overflow-y-auto pb-4">
          <TopLink to="/dashboard" label="Overview" icon={LayoutDashboard} />

          <Group
            to="/pharmacy/inventory"
            active={pharmacyActive}
            label="Pharmacy"
            icon={Package}
            badgeCount={inventoryAlertCount}
          >
            <SubLink to="/pharmacy/inventory" label="Inventory & Alerts" icon={Boxes} badgeCount={inventoryAlertCount} />
            <SubLink to="/pharmacy/restock" label="Restock & Suppliers" icon={Truck} />
          </Group>

          <Group to="/billing" active={billingActive} label="Billing & Reports" icon={Receipt}>
            <SubLink to="/billing" label="Billing & Payments" icon={FileText} end />
            <SubLink to="/billing/transactions" label="Transactions" icon={ArrowLeftRight} />
            <SubLink to="/billing/reports" label="Reports" icon={BarChart3} />
          </Group>
        </nav>

        <div className="mt-auto border-t border-gray-200 pt-4 pb-4">
          <div className="text-lg font-bold text-gray-500 mb-2">Others</div>
          <div className="space-y-2">
            <button type="button" onClick={handleOpenSettings} className="w-full flex items-center gap-2.5 px-3 py-2 text-base font-semibold text-gray-800 text-left rounded-lg hover:bg-gray-200 transition">
              <Settings size={18} />
              Settings
            </button>
            <button type="button" onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-base font-semibold text-gray-800 text-left rounded-lg hover:bg-gray-200 transition">
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
