import { useEffect, useRef, useState, type RefObject } from 'react';
import { CheckCircle2, CircleGauge, PlusCircle, Search, User, X, Pill, Clock, Calendar, DollarSign, History } from 'lucide-react';

type Props = {
  isCreatingBill: boolean;
  isSubmitting: boolean;
  step: 'build' | 'payment' | 'success';
  setStep: (value: 'build' | 'payment' | 'success') => void;
  close: () => void;
  patientPickerRef: RefObject<HTMLDivElement | null>;
  patientSearchInput: string;
  setPatientSearchInput: (value: string) => void;
  resetPatientDraft: () => void;
  showPatientDropdown: boolean;
  setShowPatientDropdown: (value: boolean) => void;
  setShowAddPatientForm: (value: boolean) => void;
  isPatientLoading: boolean;
  patientOptions: Array<{ patient_id: number; full_name: string }>;
  selectPatientOption: (patient: any) => void;
  patientNameInput: string;
  patientAgeInput: string;
  patientGenderInput: string;
  medicationSearch: string;
  setMedicationSearch: (value: string) => void;
  selectedMedication: { medication_id?: number; medication_name: string; total_stock: number; unit?: string; expiry_date?: string; batch_number?: string; unit_price?: number | null } | null;
  setSelectedMedication: (value: any) => void;
  showMedicationDropdown: boolean;
  setShowMedicationDropdown: (value: boolean) => void;
  filteredMedicationOptions: Array<any>;
  resolveMedicationUnitPrice: (name: string) => number;
  quantity: number;
  setQuantity: (value: number) => void;
  unitPrice: number;
  setUnitPrice: (value: number) => void;
  subtotal: number;
  addItem: () => void;
  items: Array<{ name: string; quantity: number; unitPrice: number; logId?: number | null }>;
  total: number;
  feedback: string;
  updateItemQuantity: (index: number, value: string) => void;
  changeItemQuantity: (index: number, delta: number) => void;
  updateItemPrice: (index: number, value: string) => void;
  removeItem: (index: number) => void;
  openCalculatorForDraft: () => void;
  openCalculatorForRow: (index: number) => void;
  checkoutMode: 'pending' | 'payNow';
  setCheckoutMode: (value: 'pending' | 'payNow') => void;
  submit: (mode: 'pending' | 'payNow') => void;
  createdBill: { id: string; patient: string; total: string; status: string } | null;
  selectedMethod: 'Cash' | 'GCash' | 'Maya';
  setSelectedMethod: (value: 'Cash' | 'GCash' | 'Maya') => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  paymentReferenceInput: string;
  setPaymentReferenceInput: (value: string) => void;
  paymentNotes: string;
  setPaymentNotes: (value: string) => void;
  paymentErrors: { payment_method?: string; amount_paid?: string; reference_number?: string };
  confirmPayment: () => void;
  resetCreateForm: () => void;
  resetMedicineOnlyFlow: () => void;
  showAddPatientForm: boolean;
  patientForm: { first: string; last: string; dob: string; gender: string; contact: string; email: string };
  setPatientForm: (field: 'first' | 'last' | 'dob' | 'gender' | 'contact' | 'email', value: string) => void;
  handleCreatePatientOption: () => void;
  isCreatingPatient: boolean;
  showCalculator: boolean;
  setShowCalculator: (value: boolean) => void;
  calculator: { unitsPerIntake: string; frequencyPerDay: string; numberOfDays: string; pricePerUnit: string; alreadyTaken: string };
  setCalculator: (field: 'unitsPerIntake' | 'frequencyPerDay' | 'numberOfDays' | 'pricePerUnit' | 'alreadyTaken', value: string) => void;
  calculatorPreview: { isValid: boolean; warning: string; totalQuantity: number; remainingQuantity: number; totalCost: number };
  applyCalculator: () => void;
  calculatorReferenceMedication: { medication_id: number; medication_name: string; form?: string; strength?: string; unit?: string } | null;
  calculatorReferenceSearch: string;
  setCalculatorReferenceSearch: (value: string) => void;
  calculatorReferenceOptions: Array<{ medication_id: number; medication_name: string; form?: string; strength?: string; unit?: string }>;
  selectCalculatorReferenceMedication: (medication: { medication_id: number; medication_name: string; form?: string; strength?: string; unit?: string }) => void;
  clearCalculatorReferenceMedication: () => void;
  toPeso: (value: number) => string;
  formatDateMed: (value: string) => string;
};

export default function MedicineOnlyBillModal(props: Props) {
  const p = props;
  const patientSearchWrapRef = useRef<HTMLDivElement | null>(null);
  const medicationSearchWrapRef = useRef<HTMLDivElement | null>(null);
  const calculatorReferenceWrapRef = useRef<HTMLDivElement | null>(null);
  const [showCalculatorReferenceResults, setShowCalculatorReferenceResults] = useState(true);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node;
      if (patientSearchWrapRef.current && !patientSearchWrapRef.current.contains(target)) {
        p.setShowPatientDropdown(false);
      }
      if (medicationSearchWrapRef.current && !medicationSearchWrapRef.current.contains(target)) {
        p.setShowMedicationDropdown(false);
      }
      if (calculatorReferenceWrapRef.current && !calculatorReferenceWrapRef.current.contains(target)) {
        setShowCalculatorReferenceResults(false);
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      p.setShowPatientDropdown(false);
      p.setShowMedicationDropdown(false);
      setShowCalculatorReferenceResults(false);
    }

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [p]);

  useEffect(() => {
    if (!p.showCalculator) return;
    setShowCalculatorReferenceResults(true);
  }, [p.showCalculator]);

  useEffect(() => {
    if (p.medicationSearch.trim() !== '') return;
    p.setSelectedMedication(null);
    p.setUnitPrice(0);
    p.setQuantity(1);
  }, [p.medicationSearch, p]);

  return (
    <div className="relative flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Pharmacy Billing</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-bold text-gray-900"><PlusCircle size={18} className="text-green-600" />Medicine Only</h3>
        </div>
        <button type="button" onClick={p.close} disabled={p.isCreatingBill || p.isSubmitting} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50"><X size={15} /></button>
      </div>

      {p.step === 'build' && (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[280px_1fr]">
          <div className="border-r border-gray-200 bg-gray-50 p-5" ref={p.patientPickerRef}>
            <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700"><User size={15} className="text-gray-400" />Patient</h4>
            <p className="mt-1 text-xs text-gray-500">This quick sale still creates a normal backend bill record.</p>
            <div className="relative mt-4" ref={patientSearchWrapRef}>
              <input value={p.patientSearchInput} onChange={(e) => { p.setPatientSearchInput(e.target.value); p.resetPatientDraft(); p.setShowPatientDropdown(true); }} onFocus={() => p.setShowPatientDropdown(true)} placeholder="Search patient..." className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              {p.showPatientDropdown && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  <button type="button" onClick={() => { p.setShowAddPatientForm(true); p.setShowPatientDropdown(false); }} className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50">Add New Patient</button>
                  {p.isPatientLoading && <p className="px-3 py-2 text-xs text-gray-500">Searching...</p>}
                  {!p.isPatientLoading && p.patientOptions.map((patient) => (
                    <button key={patient.patient_id} type="button" onClick={() => p.selectPatientOption(patient)} className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">{patient.full_name}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 text-sm">
              <p className="text-xs text-gray-400">Selected Patient</p>
              <p className="mt-1 font-semibold text-gray-900">{p.patientNameInput || 'No patient selected'}</p>
              <p className="mt-1 text-xs text-gray-500">{[p.patientAgeInput, p.patientGenderInput].filter(Boolean).join(' / ') || 'Age and gender appear here.'}</p>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-800">Add Medication</h4>
                  <p className="mt-1 text-xs text-gray-500">Search a medication, set quantity and price, then add it to this bill.</p>
                </div>
                <button type="button" onClick={p.openCalculatorForDraft} className="inline-flex h-10 items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 text-sm font-semibold text-green-700 hover:bg-green-100"><CircleGauge size={15} />Need help calculating?</button>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1.7fr_0.7fr_0.7fr_auto]">
                <div className="relative" ref={medicationSearchWrapRef}>
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={p.medicationSearch} onChange={(e) => { const nextValue = e.target.value; p.setMedicationSearch(nextValue); if (!nextValue.trim()) { p.setSelectedMedication(null); p.setUnitPrice(0); p.setQuantity(1); p.setShowMedicationDropdown(false); return; } p.setSelectedMedication(null); p.setUnitPrice(0); p.setQuantity(1); p.setShowMedicationDropdown(true); }} onFocus={() => p.setShowMedicationDropdown(true)} placeholder="Search medication" className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                  {p.showMedicationDropdown && p.filteredMedicationOptions.length > 0 && (
                    <div className="absolute left-0 top-12 z-20 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                      <div className="max-h-48 overflow-auto">
                        {p.filteredMedicationOptions.map((med) => (
                          <button key={med.medication_id} type="button" onClick={() => { p.setSelectedMedication(med); p.setMedicationSearch(med.medication_name); p.setUnitPrice(Number(Number(med.unit_price ?? p.resolveMedicationUnitPrice(med.medication_name)).toFixed(2))); p.setQuantity(1); p.setShowMedicationDropdown(false); }} className="block w-full px-3 py-2.5 text-left text-sm hover:bg-green-50">
                            <p className="font-semibold text-gray-900">{med.medication_name}</p>
                            <p className="text-xs text-gray-500">Stock: {med.total_stock} {med.unit || 'pcs'} · Batch: {med.batch_number || 'N/A'}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <input type="number" min={1} value={p.quantity} onChange={(e) => p.setQuantity(Math.max(1, Number(e.target.value) || 1))} className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <input type="number" min={0} step="0.01" value={Number.isFinite(p.unitPrice) ? p.unitPrice.toFixed(2) : '0.00'} onChange={(e) => p.setUnitPrice(Math.max(0, Number(e.target.value) || 0))} className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <button type="button" onClick={p.addItem} disabled={!p.selectedMedication} className="h-11 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">Add</button>
              </div>
              {p.selectedMedication && (
                <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-gray-600">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">Selected medication: {p.selectedMedication.medication_name}</p>
                    <button
                      type="button"
                      onClick={() => { p.setSelectedMedication(null); p.setMedicationSearch(''); p.setUnitPrice(0); p.setQuantity(1); p.setShowMedicationDropdown(false); }}
                      className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                    >
                      Remove selected
                    </button>
                  </div>
                  <p className="mt-1">Available: {p.selectedMedication.total_stock} {p.selectedMedication.unit || 'pcs'} · Expiry: {p.selectedMedication.expiry_date ? p.formatDateMed(p.selectedMedication.expiry_date) : 'N/A'} · Draft subtotal: <span className="font-semibold text-gray-800">{p.toPeso(p.subtotal)}</span></p>
                </div>
              )}
              {p.feedback && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{p.feedback}</div>}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-800">Current Medications</h4>
                  <p className="mt-1 text-xs text-gray-500">Multiple medications are allowed in one bill.</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900">{p.toPeso(p.total)}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 text-xs text-gray-500"><th className="pb-2 text-left font-medium">Medication</th><th className="pb-2 text-center font-medium">Qty</th><th className="pb-2 text-right font-medium">Price</th><th className="pb-2 text-right font-medium">Subtotal</th><th className="pb-2 text-right font-medium">Actions</th></tr></thead>
                  <tbody>
                    {p.items.map((item, index) => (
                      <tr key={`${item.logId ?? item.name}-${index}`} className="border-b border-gray-100 text-gray-800">
                        <td className="py-3 font-semibold">{item.name}</td>
                        <td className="py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button type="button" onClick={() => p.changeItemQuantity(index, -1)} className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-gray-100">-</button>
                            <input type="number" min={1} value={item.quantity} onChange={(e) => p.updateItemQuantity(index, e.target.value)} className="h-8 w-14 rounded border border-gray-300 px-1 text-center text-xs" />
                            <button type="button" onClick={() => p.changeItemQuantity(index, 1)} className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-gray-100">+</button>
                          </div>
                        </td>
                        <td className="py-3 text-right"><input type="number" min={0} value={item.unitPrice} onChange={(e) => p.updateItemPrice(index, e.target.value)} className="h-8 w-24 rounded border border-gray-300 px-2 text-right text-xs" /></td>
                        <td className="py-3 text-right font-semibold">{p.toPeso(item.quantity * item.unitPrice)}</td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => p.openCalculatorForRow(index)} className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700">Calculator</button>
                            <button type="button" onClick={() => p.removeItem(index)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700">Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {p.items.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-500">No medication added yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { p.setCheckoutMode('pending'); p.submit('pending'); }} disabled={p.isCreatingBill} className="h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 disabled:opacity-50">{p.isCreatingBill && p.checkoutMode === 'pending' ? 'Saving...' : 'Save as Pending'}</button>
              <button type="button" onClick={() => { p.setCheckoutMode('payNow'); p.submit('payNow'); }} disabled={p.isCreatingBill} className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{p.isCreatingBill && p.checkoutMode === 'payNow' ? 'Preparing Payment...' : 'Pay Now'}</button>
            </div>
          </div>
        </div>
      )}

      {p.step === 'payment' && p.createdBill && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-gray-50 p-8 text-center">
            <div className="h-14 w-14 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-blue-400 border-t-blue-600 rounded-full animate-spin" />
            </div>
            <h4 className="mt-4 text-xl font-bold text-gray-900">Preparing Payment</h4>
            <p className="mt-2 text-sm text-gray-600">Your bill is being prepared for payment processing. Redirecting to payment gateway...</p>
          </div>
        </div>
      )}

      {p.step === 'success' && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-gray-50 p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" strokeWidth={2} />
            <h4 className="mt-4 text-2xl font-bold text-gray-900">Medicine Bill Saved</h4>
            <p className="mt-2 text-sm text-gray-600">{p.checkoutMode === 'payNow' ? 'The payment step has been processed without leaving this workflow.' : 'The bill has been created and saved to the backend as a normal billing record.'}</p>
            {p.createdBill && <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 text-left text-sm text-gray-700"><div className="flex justify-between"><span>Bill Code</span><span className="font-semibold">{p.createdBill.id}</span></div><div className="mt-2 flex justify-between"><span>Patient</span><span className="font-semibold">{p.createdBill.patient}</span></div><div className="mt-2 flex justify-between"><span>Status</span><span className="font-semibold">{p.createdBill.status}</span></div><div className="mt-2 flex justify-between"><span>Total</span><span className="font-semibold">{p.createdBill.total.replace('P', '₱')}</span></div></div>}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button type="button" onClick={() => { p.resetCreateForm(); p.resetMedicineOnlyFlow(); }} className="h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700">New Medicine Sale</button>
              <button type="button" onClick={p.close} className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">Done</button>
            </div>
          </div>
        </div>
      )}

      {p.showAddPatientForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-md p-4" onClick={() => p.setShowAddPatientForm(false)}>
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm font-bold text-gray-700">Add New Patient</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={p.patientForm.first} onChange={(e) => p.setPatientForm('first', e.target.value)} placeholder="First Name" className="h-9 rounded-lg border border-gray-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <input value={p.patientForm.last} onChange={(e) => p.setPatientForm('last', e.target.value)} placeholder="Last Name" className="h-9 rounded-lg border border-gray-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <input type="date" value={p.patientForm.dob} onChange={(e) => p.setPatientForm('dob', e.target.value)} className="h-9 rounded-lg border border-gray-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <select value={p.patientForm.gender} onChange={(e) => p.setPatientForm('gender', e.target.value)} className="h-9 rounded-lg border border-gray-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"><option value="">Gender</option><option value="Male">Male</option><option value="Female">Female</option></select>
              <input value={p.patientForm.contact} onChange={(e) => p.setPatientForm('contact', e.target.value)} placeholder="Contact Number" className="h-9 rounded-lg border border-gray-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <input value={p.patientForm.email} onChange={(e) => p.setPatientForm('email', e.target.value)} placeholder="Email Address" className="h-9 rounded-lg border border-gray-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => p.setShowAddPatientForm(false)} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700">Cancel</button>
              <button type="button" onClick={p.handleCreatePatientOption} disabled={p.isCreatingPatient} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-60">{p.isCreatingPatient ? 'Saving...' : 'Save Patient'}</button>
            </div>
          </div>
        </div>
      )}

      {p.showCalculator && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-md p-4" onClick={() => p.setShowCalculator(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Calculator</p>
                <h4 className="mt-1 text-xl font-bold text-gray-900">Medication Quantity Helper</h4>
                <p className="mt-1 text-sm text-gray-600">This computes using units only, never mg-based direct dispensing.</p>
              </div>
              <button type="button" onClick={() => p.setShowCalculator(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={15} /></button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1.05fr_1.2fr] md:items-start">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Medication Reference</p>
                <div className="relative mt-2" ref={calculatorReferenceWrapRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={p.calculatorReferenceSearch}
                      onChange={(e) => {
                        p.setCalculatorReferenceSearch(e.target.value);
                        setShowCalculatorReferenceResults(true);
                      }}
                      onFocus={() => setShowCalculatorReferenceResults(true)}
                      placeholder="Search medication reference"
                      className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </div>
                  {p.calculatorReferenceMedication && (
                    <div className="mt-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">{p.calculatorReferenceMedication.medication_name}</p>
                        <button
                          type="button"
                          onClick={() => {
                            p.clearCalculatorReferenceMedication();
                            setShowCalculatorReferenceResults(true);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          aria-label="Remove selected medication"
                          title="Remove selected"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {[p.calculatorReferenceMedication.form, p.calculatorReferenceMedication.strength, p.calculatorReferenceMedication.unit].filter(Boolean).join(' · ') || 'No additional details'}
                      </p>
                    </div>
                  )}
                  {showCalculatorReferenceResults && (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-44 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    {p.calculatorReferenceOptions.map((med) => (
                      <button
                        key={med.medication_id}
                        type="button"
                        onClick={() => {
                          p.selectCalculatorReferenceMedication(med);
                          setShowCalculatorReferenceResults(false);
                        }}
                        className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-green-50"
                      >
                          <p className="font-semibold text-gray-900">{med.medication_name}</p>
                          <p className="text-xs text-gray-500">{[med.form, med.strength, med.unit].filter(Boolean).join(' · ') || 'No additional details'}</p>
                        </button>
                      ))}
                    {p.calculatorReferenceOptions.length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-500">No medications found.</p>
                    )}
                    </div>
                  )}
                </div>
            </div>
              <div className="grid gap-4 sm:grid-cols-2">
              {/* Units per intake */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Pill size={16} className="text-blue-600" />
                  Units per intake
                </label>
                <input type="number" min={1} value={p.calculator.unitsPerIntake} onChange={(e) => p.setCalculator('unitsPerIntake', e.target.value)} placeholder="e.g., 1 or 2" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              
              {/* Frequency per day */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Clock size={16} className="text-orange-600" />
                  Frequency per day
                </label>
                <input type="number" min={1} value={p.calculator.frequencyPerDay} onChange={(e) => p.setCalculator('frequencyPerDay', e.target.value)} placeholder="e.g., 3 times" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              
              {/* Number of days */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Calendar size={16} className="text-purple-600" />
                  Number of days
                </label>
                <input type="number" min={1} value={p.calculator.numberOfDays} onChange={(e) => p.setCalculator('numberOfDays', e.target.value)} placeholder="e.g., 7 days" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>
              
              {/* Price per unit */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <DollarSign size={16} className="text-green-600" />
                  Price per unit
                </label>
                <input type="number" min={0} value={p.calculator.pricePerUnit} onChange={(e) => p.setCalculator('pricePerUnit', e.target.value)} placeholder="e.g., 10.50" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              
              {/* Quantity already taken */}
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <History size={16} className="text-red-600" />
                  Quantity already taken
                </label>
                <input type="number" min={0} value={p.calculator.alreadyTaken} onChange={(e) => p.setCalculator('alreadyTaken', e.target.value)} placeholder="e.g., 5 units" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm">
              <div className="flex justify-between"><span>Total quantity required</span><span className="font-semibold">{p.calculatorPreview.totalQuantity}</span></div>
              <div className="mt-2 flex justify-between"><span>Remaining quantity to dispense</span><span className="font-semibold">{p.calculatorPreview.remainingQuantity}</span></div>
              <div className="mt-2 flex justify-between"><span>Estimated total cost</span><span className="font-semibold">{p.toPeso(p.calculatorPreview.totalCost)}</span></div>
              {p.calculatorPreview.warning && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{p.calculatorPreview.warning}</p>}
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => p.setShowCalculator(false)} className="h-10 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700">Cancel</button>
              <button type="button" onClick={p.applyCalculator} disabled={!p.calculatorPreview.isValid || p.calculatorPreview.remainingQuantity === 0} className="h-10 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Use this result</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
