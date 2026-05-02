import type { RefObject } from 'react';
import { CheckCircle2, CircleGauge, PlusCircle, Search, User, X } from 'lucide-react';

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
  selectedMedication: { medication_name: string; total_stock: number; unit?: string; expiry_date?: string; batch_number?: string } | null;
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
  toPeso: (value: number) => string;
  formatDateMed: (value: string) => string;
};

export default function MedicineOnlyBillModal(props: Props) {
  const p = props;
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
            <div className="relative mt-4">
              <input value={p.patientSearchInput} onChange={(e) => { p.setPatientSearchInput(e.target.value); p.resetPatientDraft(); p.setShowPatientDropdown(true); }} onFocus={() => p.setShowPatientDropdown(true)} placeholder="Search patient..." className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm" />
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
                <button type="button" onClick={p.openCalculatorForDraft} disabled={!p.selectedMedication} className="inline-flex h-10 items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"><CircleGauge size={15} />Need help calculating?</button>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1.7fr_0.7fr_0.7fr_auto]">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={p.medicationSearch} onChange={(e) => { p.setMedicationSearch(e.target.value); p.setSelectedMedication(null); p.setUnitPrice(0); p.setQuantity(1); p.setShowMedicationDropdown(true); }} onFocus={() => p.setShowMedicationDropdown(true)} placeholder="Search medication" className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm" />
                  {p.showMedicationDropdown && p.filteredMedicationOptions.length > 0 && (
                    <div className="absolute left-0 top-12 z-20 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                      <div className="max-h-48 overflow-auto">
                        {p.filteredMedicationOptions.map((med) => (
                          <button key={med.medication_id} type="button" onClick={() => { p.setSelectedMedication(med); p.setMedicationSearch(med.medication_name); p.setUnitPrice(p.resolveMedicationUnitPrice(med.medication_name)); p.setQuantity(1); p.setShowMedicationDropdown(false); }} className="block w-full px-3 py-2.5 text-left text-sm hover:bg-green-50">
                            <p className="font-semibold text-gray-900">{med.medication_name}</p>
                            <p className="text-xs text-gray-500">Stock: {med.total_stock} {med.unit || 'pcs'} · Batch: {med.batch_number || 'N/A'}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <input type="number" min={1} value={p.quantity} onChange={(e) => p.setQuantity(Math.max(1, Number(e.target.value) || 1))} className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-center text-sm" />
                <input type="number" min={0} value={p.unitPrice} onChange={(e) => p.setUnitPrice(Math.max(0, Number(e.target.value) || 0))} className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" />
                <button type="button" onClick={p.addItem} disabled={!p.selectedMedication} className="h-11 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">Add</button>
              </div>
              {p.selectedMedication && <p className="mt-3 text-xs text-gray-500">Available: {p.selectedMedication.total_stock} {p.selectedMedication.unit || 'pcs'} · Expiry: {p.selectedMedication.expiry_date ? p.formatDateMed(p.selectedMedication.expiry_date) : 'N/A'} · Draft subtotal: <span className="font-semibold text-gray-800">{p.toPeso(p.subtotal)}</span></p>}
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
        <div className="space-y-5 overflow-y-auto p-6">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-xl font-bold text-gray-900">Complete Payment</h4>
            <p className="mt-1 text-sm text-gray-600">The bill has already been created in the backend. You can complete payment here or leave it pending.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm">
              <div className="flex justify-between"><span>Bill Code</span><span className="font-semibold">{p.createdBill.id}</span></div>
              <div className="mt-2 flex justify-between"><span>Patient</span><span className="font-semibold">{p.createdBill.patient}</span></div>
              <div className="mt-2 flex justify-between"><span>Amount Due</span><span className="font-semibold text-blue-700">{p.toPeso(p.total)}</span></div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
              <select value={p.selectedMethod} onChange={(e) => p.setSelectedMethod(e.target.value as 'Cash' | 'GCash' | 'Maya')} className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm"><option value="Cash">Cash</option><option value="GCash">GCash</option><option value="Maya">Maya</option></select>
              {p.paymentErrors.payment_method && <p className="text-xs text-red-500">{p.paymentErrors.payment_method}</p>}
              <input value={p.paymentAmount} onChange={(e) => p.setPaymentAmount(e.target.value)} placeholder="Amount paid" className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" />
              {p.paymentErrors.amount_paid && <p className="text-xs text-red-500">{p.paymentErrors.amount_paid}</p>}
              {(p.selectedMethod === 'GCash' || p.selectedMethod === 'Maya') && <>
                <input value={p.paymentReferenceInput} onChange={(e) => p.setPaymentReferenceInput(e.target.value)} placeholder="Reference number" className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" />
                {p.paymentErrors.reference_number && <p className="text-xs text-red-500">{p.paymentErrors.reference_number}</p>}
              </>}
              <textarea value={p.paymentNotes} onChange={(e) => p.setPaymentNotes(e.target.value)} rows={3} placeholder="Notes" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
            </div>
          </div>
          {p.feedback && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{p.feedback}</div>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => p.setStep('success')} className="h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700">Skip Payment</button>
            <button type="button" onClick={p.confirmPayment} disabled={p.isSubmitting} className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{p.isSubmitting ? 'Processing Payment...' : 'Confirm Payment'}</button>
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
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4" onClick={() => p.setShowAddPatientForm(false)}>
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm font-bold text-gray-700">Add New Patient</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={p.patientForm.first} onChange={(e) => p.setPatientForm('first', e.target.value)} placeholder="First Name" className="h-9 rounded-lg border border-gray-200 px-2 text-sm" />
              <input value={p.patientForm.last} onChange={(e) => p.setPatientForm('last', e.target.value)} placeholder="Last Name" className="h-9 rounded-lg border border-gray-200 px-2 text-sm" />
              <input type="date" value={p.patientForm.dob} onChange={(e) => p.setPatientForm('dob', e.target.value)} className="h-9 rounded-lg border border-gray-200 px-2 text-sm" />
              <select value={p.patientForm.gender} onChange={(e) => p.setPatientForm('gender', e.target.value)} className="h-9 rounded-lg border border-gray-200 px-2 text-sm"><option value="">Gender</option><option value="Male">Male</option><option value="Female">Female</option></select>
              <input value={p.patientForm.contact} onChange={(e) => p.setPatientForm('contact', e.target.value)} placeholder="Contact Number" className="h-9 rounded-lg border border-gray-200 px-2 text-sm" />
              <input value={p.patientForm.email} onChange={(e) => p.setPatientForm('email', e.target.value)} placeholder="Email Address" className="h-9 rounded-lg border border-gray-200 px-2 text-sm" />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => p.setShowAddPatientForm(false)} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700">Cancel</button>
              <button type="button" onClick={p.handleCreatePatientOption} disabled={p.isCreatingPatient} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-60">{p.isCreatingPatient ? 'Saving...' : 'Save Patient'}</button>
            </div>
          </div>
        </div>
      )}

      {p.showCalculator && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4" onClick={() => p.setShowCalculator(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Calculator</p>
                <h4 className="mt-1 text-xl font-bold text-gray-900">Medication Quantity Helper</h4>
                <p className="mt-1 text-sm text-gray-600">This computes using units only, never mg-based direct dispensing.</p>
              </div>
              <button type="button" onClick={() => p.setShowCalculator(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={15} /></button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input type="number" min={1} value={p.calculator.unitsPerIntake} onChange={(e) => p.setCalculator('unitsPerIntake', e.target.value)} placeholder="Units per intake" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" />
              <input type="number" min={1} value={p.calculator.frequencyPerDay} onChange={(e) => p.setCalculator('frequencyPerDay', e.target.value)} placeholder="Frequency per day" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" />
              <input type="number" min={1} value={p.calculator.numberOfDays} onChange={(e) => p.setCalculator('numberOfDays', e.target.value)} placeholder="Number of days" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" />
              <input type="number" min={0} value={p.calculator.pricePerUnit} onChange={(e) => p.setCalculator('pricePerUnit', e.target.value)} placeholder="Price per unit" className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" />
              <input type="number" min={0} value={p.calculator.alreadyTaken} onChange={(e) => p.setCalculator('alreadyTaken', e.target.value)} placeholder="Quantity already taken" className="sm:col-span-2 h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" />
            </div>
            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm">
              <div className="flex justify-between"><span>Total quantity required</span><span className="font-semibold">{p.calculatorPreview.totalQuantity}</span></div>
              <div className="mt-2 flex justify-between"><span>Remaining quantity to dispense</span><span className="font-semibold">{p.calculatorPreview.remainingQuantity}</span></div>
              <div className="mt-2 flex justify-between"><span>Estimated total cost</span><span className="font-semibold">{p.toPeso(p.calculatorPreview.totalCost)}</span></div>
              {p.calculatorPreview.warning && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{p.calculatorPreview.warning}</p>}
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => p.setShowCalculator(false)} className="h-10 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700">Cancel</button>
              <button type="button" onClick={p.applyCalculator} disabled={!p.calculatorPreview.isValid} className="h-10 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Use this result</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
