import { useContext } from 'react';
import { BillingPaymentsContext } from './BillingPaymentsContextObject.ts';

export function useBillingPayments() {
  const context = useContext(BillingPaymentsContext);
  if (!context) {
    throw new Error('useBillingPayments must be used within BillingPaymentsProvider');
  }
  return context;
}
