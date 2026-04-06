import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute } from "./components/AuthGuards";
import { BillingPaymentsProvider } from "./context/BillingPaymentsContext";
import { GlobalSearchDataProvider } from "./context/GlobalSearchDataContext";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";
import BillingAndPayments from "./pages/billing/BillingandPayments";
import RevenueReports from "./pages/billing/RevenueReports";
import Transactions from "./pages/billing/Transactions";
import LoginPage from "./pages/login and register/LoginPage";
import RegisterPage from "./pages/login and register/RegisterPage";
import CurrentStocks from "./pages/pharmacy/CurrentStocks";
import RestockSuppliers from "./pages/pharmacy/RestockSuppliers";
import Settings from "./pages/Settings";

function ProtectedAppProviders() {
  return (
    <BillingPaymentsProvider>
      <GlobalSearchDataProvider>
        <Outlet />
      </GlobalSearchDataProvider>
    </BillingPaymentsProvider>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <ProtectedAppProviders />,
        children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { path: "dashboard", element: <Dashboard /> },
          { path: "overview", element: <Dashboard /> },
          { path: "pharmacy/inventory", element: <CurrentStocks /> },
          { path: "inventory", element: <CurrentStocks /> },
          { path: "inventory/alerts", element: <CurrentStocks /> },
          { path: "pharmacy/restock", element: <RestockSuppliers /> },
          { path: "restock", element: <RestockSuppliers /> },
          { path: "suppliers", element: <RestockSuppliers /> },
          { path: "billing", element: <BillingAndPayments /> },
          { path: "billing/records", element: <BillingAndPayments /> },
          { path: "billing/payments", element: <BillingAndPayments /> },
          { path: "billing/transactions", element: <Transactions /> },
          { path: "billing/reports", element: <RevenueReports /> },
          { path: "transactions", element: <Transactions /> },
          { path: "reports", element: <RevenueReports /> },
          { path: "settings", element: <Settings /> },
        ],
      },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <LandingPage />,
  },
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
