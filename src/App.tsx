import AppRoutes from './AppRoutes.tsx';
import { BillingPaymentsProvider } from './context/BillingPaymentsContext.tsx';
import { GlobalSearchDataProvider } from './context/GlobalSearchDataContext.tsx';

function App() {
  return (
    <BillingPaymentsProvider>
      <GlobalSearchDataProvider>
        <AppRoutes />
      </GlobalSearchDataProvider>
    </BillingPaymentsProvider>
  );
}

export default App;
