// Shared data across the application

export const UNIVERSAL_MOCK_ROWS = 12;
export const DEFAULT_PAGE_SIZE = 5;

export const inventoryItems = [
  { id: 'I-001', name: 'Paracetamol', stock: 90, status: 'Adequate', expiry: '2027-01-12', reorder: 20 },
  { id: 'I-002', name: 'Amoxicillin', stock: 12, status: 'Low', expiry: '2026-04-03', reorder: 50 },
  { id: 'I-003', name: 'Insulin', stock: 3, status: 'Critical', expiry: '2026-03-21', reorder: 25 },
  { id: 'I-004', name: 'Ibuprofen', stock: 5, status: 'Critical', expiry: '2026-05-16', reorder: 40 },
  { id: 'I-005', name: 'Multivitamin', stock: 2, status: 'Critical', expiry: '2026-03-09', reorder: 30 },
  { id: 'I-006', name: 'Cetirizine', stock: 55, status: 'Adequate', expiry: '2027-07-04', reorder: 20 },
  { id: 'I-007', name: 'Losartan', stock: 16, status: 'Low', expiry: '2026-10-11', reorder: 35 },
  { id: 'I-008', name: 'Metformin', stock: 48, status: 'Adequate', expiry: '2027-02-08', reorder: 25 },
  { id: 'I-009', name: 'Amlodipine', stock: 7, status: 'Critical', expiry: '2026-06-12', reorder: 30 },
  { id: 'I-010', name: 'Omeprazole', stock: 22, status: 'Low', expiry: '2026-08-30', reorder: 30 },
  { id: 'I-011', name: 'Salbutamol', stock: 60, status: 'Adequate', expiry: '2027-03-02', reorder: 25 },
  { id: 'I-012', name: 'Azithromycin', stock: 10, status: 'Low', expiry: '2026-07-25', reorder: 40 },
];

export const inventoryAlerts = [
  { id: 1, name: 'Insulin (Rapid)', category: 'Diabetes', lowStock: 5, expiry: 'Dec 02, 2026', suggestedRestock: 50, severity: 'critical' },
  { id: 2, name: 'Amoxicillin 250mg', category: 'Antibiotic', lowStock: 12, expiry: 'Jan 15, 2027', suggestedRestock: 100, severity: 'warning' },
  { id: 3, name: 'Salbutamol Inhaler', category: 'Respiratory', lowStock: 3, expiry: 'Nov 20, 2026', suggestedRestock: 30, severity: 'critical' },
  { id: 4, name: 'Metformin 500mg', category: 'Diabetes', lowStock: 9, expiry: 'Feb 12, 2027', suggestedRestock: 60, severity: 'warning' },
  { id: 5, name: 'Amlodipine 10mg', category: 'Cardio', lowStock: 4, expiry: 'Oct 01, 2026', suggestedRestock: 45, severity: 'critical' },
  { id: 6, name: 'Losartan 50mg', category: 'Cardio', lowStock: 14, expiry: 'Mar 08, 2027', suggestedRestock: 50, severity: 'warning' },
  { id: 7, name: 'Cetirizine 10mg', category: 'Allergy', lowStock: 6, expiry: 'Dec 18, 2026', suggestedRestock: 40, severity: 'warning' },
  { id: 8, name: 'Omeprazole 20mg', category: 'Gastro', lowStock: 8, expiry: 'Sep 14, 2026', suggestedRestock: 55, severity: 'warning' },
  { id: 9, name: 'Azithromycin 500mg', category: 'Antibiotic', lowStock: 2, expiry: 'Aug 10, 2026', suggestedRestock: 70, severity: 'critical' },
  { id: 10, name: 'Hydrocortisone Cream', category: 'Dermatology', lowStock: 11, expiry: 'Apr 06, 2027', suggestedRestock: 35, severity: 'warning' },
  { id: 11, name: 'Prednisone 20mg', category: 'Immunology', lowStock: 5, expiry: 'Jul 24, 2026', suggestedRestock: 40, severity: 'critical' },
  { id: 12, name: 'Doxycycline 100mg', category: 'Antibiotic', lowStock: 13, expiry: 'May 29, 2027', suggestedRestock: 60, severity: 'warning' },
];

export const billingRecords = [
  { id: 'B-2041', patient: 'Jhon Carlo Millan', date: '2026-11-02', total: 'P2,500', status: 'Pending' },
  { id: 'B-2042', patient: 'John Lloyd Marigza', date: '2026-11-02', total: 'P1,200', status: 'Paid' },
  { id: 'B-2043', patient: 'Daryl Paquibulan', date: '2026-11-02', total: 'P135,200', status: 'Pending' },
  { id: 'B-2044', patient: 'Marc Anthony Petulan', date: '2026-11-02', total: 'P4,850', status: 'Cancelled' },
  { id: 'B-2045', patient: 'Karl Angelo Vergara', date: '2026-11-02', total: 'P3,600', status: 'Pending' },
  { id: 'B-2046', patient: 'Dominique Sarcia', date: '2026-10-02', total: 'P2,600', status: 'Pending' },
  { id: 'B-2047', patient: 'Arrianerose Flores', date: '2026-10-02', total: 'P1,700', status: 'Paid' },
  { id: 'B-2048', patient: 'Lois Jay Rimorin', date: '2026-09-02', total: 'P5,550', status: 'Cancelled' },
  { id: 'B-2049', patient: 'Jun Martin Lubong', date: '2026-09-02', total: 'P2,600', status: 'Cancelled' },
  { id: 'B-2050', patient: 'Katherine Dela Pena', date: '2026-09-04', total: 'P6,100', status: 'Pending' },
  { id: 'B-2051', patient: 'Jeric Cabanilla', date: '2026-09-06', total: 'P2,950', status: 'Paid' },
  { id: 'B-2052', patient: 'Yna Resurreccion', date: '2026-09-09', total: 'P7,500', status: 'Pending' },
];

export const paymentQueue = [
  { id: 'B-2041', patient: 'Jhon Carlo Millan', amount: 3500, method: '-', date: '2026-11-02', status: 'Pending' },
  { id: 'B-2042', patient: 'John Lloyd Marigza', amount: 1200, method: 'GCash', date: '2026-11-02', status: 'Paid' },
  { id: 'B-2043', patient: 'Daryl Paquibulan', amount: 550270, method: '-', date: '2026-11-02', status: 'Pending' },
  { id: 'B-2044', patient: 'Marc Anthony Petulan', amount: 5800, method: 'Maya', date: '2026-11-02', status: 'Paid' },
  { id: 'B-2045', patient: 'Karl Angelo Vergara', amount: 2800, method: '-', date: '2026-11-02', status: 'Pending' },
  { id: 'B-2046', patient: 'Dominique Sarcia', amount: 3400, method: 'GCash', date: '2026-11-02', status: 'Processing' },
  { id: 'B-2047', patient: 'Arrianerose Flores', amount: 15100, method: 'Cash', date: '2026-11-02', status: 'Paid' },
  { id: 'B-2048', patient: 'Lois Jay Rimorin', amount: 7250, method: 'Cash', date: '2026-11-02', status: 'Paid' },
  { id: 'B-2049', patient: 'Gusion Dela Cruz', amount: 5800, method: 'Cash', date: '2026-11-02', status: 'Pending' },
  { id: 'B-2050', patient: 'Katherine Dela Pena', amount: 4100, method: '-', date: '2026-11-03', status: 'Pending' },
  { id: 'B-2051', patient: 'Jeric Cabanilla', amount: 6300, method: 'Maya', date: '2026-11-03', status: 'Paid' },
  { id: 'B-2052', patient: 'Yna Resurreccion', amount: 4950, method: '-', date: '2026-11-03', status: 'Processing' },
];

export const alerts = [
  { id: 'A-1', type: 'Critical', title: 'Insulin stock at 3 units', message: 'Immediate restocking required', severity: 'critical' },
  { id: 'A-2', type: 'Warning', title: 'Amoxicillin batch expiring in 7 days', message: 'Prioritize dispensing or secure supplier reauth', severity: 'warning' },
  { id: 'A-3', type: 'Warning', title: 'Paracetamol batch due for recount', message: 'Reconcile stock count before next cycle', severity: 'warning' },
];

export const payments = [
  { id: 'P-1001', patient: 'Anna Santos', method: 'Cash', amount: 500, date: '2026-02-10', status: 'Completed' },
  { id: 'P-1002', patient: 'Mark Reyes', method: 'Card', amount: 1200, date: '2026-02-11', status: 'Pending' },
  { id: 'P-1003', patient: 'Maria Garcia', method: 'Online', amount: 800, date: '2026-02-15', status: 'Completed' },
];

export const restockingOrders = [
  { id: 'RO-001', item: 'Amoxicillin', qty: '50 units', supplier: 'MediSupply Co', status: 'Suggested Orders' },
  { id: 'RO-002', item: 'Insulin', qty: '30 units', supplier: 'HealthPro', status: 'Suggested Orders' },
];

export const nextSupplyDelivery = {
  item: 'Amoxicillin',
  qty: '30 units',
  supplier: 'MediSupply Co',
  date: 'Jan 12',
};

export const financialData = {
  revenueToday: 25000,
  pendingPayments: 3,
  totalTransactions: 47,
  insuranceClaimsInProgress: 6,
};
