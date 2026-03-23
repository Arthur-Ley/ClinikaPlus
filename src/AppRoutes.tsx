import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import CurrentStocks from './pages/pharmacy/CurrentStocks';
import RestockSuppliers from './pages/pharmacy/RestockSuppliers';
import BillingAndPayments from './pages/billing/BillingandPayments';
import Transactions from './pages/billing/Transactions';
import RevenueReports from './pages/billing/RevenueReports';
import Settings from './pages/Settings';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';

const router = createBrowserRouter([
  { path: '/', element: <SignInPage /> },
  { path: '/signin', element: <SignInPage /> },
  { path: '/signup', element: <SignUpPage /> },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      // Pharmacy — Inventory & Alerts
      { path: 'pharmacy/inventory', element: <CurrentStocks /> },
      { path: 'inventory', element: <CurrentStocks /> },
      { path: 'inventory/alerts', element: <CurrentStocks /> },
      // Pharmacy — Restock & Suppliers
      { path: 'pharmacy/restock', element: <RestockSuppliers /> },
      { path: 'restock', element: <RestockSuppliers /> },
      { path: 'suppliers', element: <RestockSuppliers /> },
      // Billing & Reports
      { path: 'billing', element: <BillingAndPayments /> },
      { path: 'billing/records', element: <BillingAndPayments /> },
      { path: 'billing/payments', element: <BillingAndPayments /> },
      { path: 'billing/transactions', element: <Transactions /> },
      { path: 'billing/reports', element: <RevenueReports /> },
      { path: 'transactions', element: <Transactions /> },
      { path: 'reports', element: <RevenueReports /> },
      // Settings
      { path: 'settings', element: <Settings /> },
    ],
  },
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
