import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';

// Pages
import Dashboard from './pages/Dashboard';
import CurrentStocks from './pages/inventory/CurrentStocks';
import InventoryAlerts from './pages/inventory/InventoryAlerts';
import RestockSuppliers from './pages/inventory/RestockSuppliers';
import BillingRecords from './pages/billing/BillingRecords';
import Payments from './pages/billing/Payments';
import RevenueReports from './pages/reports/RevenueReports';
import InsuranceClaims from './pages/reports/InsuranceClaims';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'inventory/current-stocks', element: <CurrentStocks /> },
      { path: 'inventory', element: <CurrentStocks /> },
      { path: 'inventory/alerts', element: <InventoryAlerts /> },
      { path: 'alerts', element: <InventoryAlerts /> },
      { path: 'inventory/restock', element: <RestockSuppliers /> },
      { path: 'restock', element: <RestockSuppliers /> },
      { path: 'suppliers', element: <RestockSuppliers /> },
      { path: 'billing/records', element: <BillingRecords /> },
      { path: 'billing', element: <BillingRecords /> },
      { path: 'billing/payments', element: <Payments /> },
      { path: 'payments', element: <Payments /> },
      { path: 'reports/revenue', element: <RevenueReports /> },
      { path: 'revenue', element: <RevenueReports /> },
      { path: 'reports/claims', element: <InsuranceClaims /> },
      { path: 'insurance-claims', element: <InsuranceClaims /> },
    ],
  },
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
