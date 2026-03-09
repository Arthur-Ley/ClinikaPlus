import { createContext } from 'react';
import type { BillingPaymentsContextValue } from './BillingPaymentsContext.tsx';

export const BillingPaymentsContext = createContext<BillingPaymentsContextValue | undefined>(undefined);
