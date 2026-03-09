import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  ChevronDown,
  PlusCircle,
  MoreVertical,
  CircleDashed,
  FileCheck2,
  WalletCards,
  UserRound,
  ShieldPlus,
  FileText,
  Link2,
  X,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination.tsx';

type ClaimStatus = 'Pending' | 'Submitted' | 'Approved' | 'Paid' | 'Rejected';

type InsuranceClaim = {
  claimDbId: number | null;
  claimId: string;
  patientName: string;
  insuranceProvider: string;
  policyNo: string;
  amount: number;
  status: ClaimStatus;
  dateFiled: string;
};

type PeriodFilter = 'all' | 'thisMonth' | 'last30Days' | 'thisYear';

type ClaimDetailData = {
  dateOfService?: string;
  summaryStatus?: string;
  patientId?: string;
  contact?: string;
  email?: string;
  coverage?: string;
  diagnosis?: string;
  treatment?: string;
  physician?: string;
  documents?: string[];
  statusHistory: string[];
  rejectionReason?: string;
  paymentInfo?: {
    method: string;
    referenceNo: string;
    amountPaid: number;
    paymentDate: string;
    verifiedBy: string;
  };
};

type ClaimApiRow = {
  claim_id: number;
  claim_code?: string;
  claimed_amount?: number | string;
  status?: string;
  claim_date?: string;
  patient_name?: string;
  insurance_provider?: string;
  policy_no?: string;
};

type CreateClaimForm = {
  patientName: string;
  insuranceProvider: string;
  policyNumber: string;
  claimAmount: string;
  dateOfService: string;
  diagnosis: string;
  treatmentProvided: string;
  supportingDocuments: string;
};

const initialCreateClaimForm: CreateClaimForm = {
  patientName: '',
  insuranceProvider: '',
  policyNumber: '',
  claimAmount: '',
  dateOfService: '',
  diagnosis: '',
  treatmentProvided: '',
  supportingDocuments: '',
};
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const claimDetails: Record<string, ClaimDetailData> = {
  'CLM-0012': {
    dateOfService: '2026-02-09',
    summaryStatus: 'Pending Review',
    patientId: 'PT-00032',
    contact: '0918-222-3344',
    email: 'maria@email.com',
    coverage: 'Outpatient',
    diagnosis: 'Upper Respiratory Infection',
    treatment: 'Consultation + Antibiotics',
    physician: 'Dr. Ramon Cruz',
    documents: ['Medical Certificate.pdf', 'Official Receipt.jpg'],
    statusHistory: ['Feb 10, 2026 - Claim Submitted'],
  },
  'CLM-0013': {
    summaryStatus: 'Approved',
    patientId: 'PT-00045',
    diagnosis: 'Acute Gastroenteritis',
    statusHistory: ['Feb 11 - Submitted', 'Feb 12 - Under Review', 'Feb 13 - Approved'],
  },
  'CLM-0014': {
    summaryStatus: 'Paid',
    patientId: 'PT-00041',
    paymentInfo: {
      method: 'GCash QR',
      referenceNo: '9876543210',
      amountPaid: 6800,
      paymentDate: 'Feb 12, 2026',
      verifiedBy: 'Admin User',
    },
    statusHistory: ['Feb 09 - Submitted', 'Feb 10 - Approved', 'Feb 12 - Payment Recorded'],
  },
  'CLM-0015': {
    summaryStatus: 'Rejected',
    patientId: 'PT-00052',
    diagnosis: 'Hypertension',
    rejectionReason: 'Incomplete supporting documents.',
    statusHistory: ['Feb 08 - Submitted', 'Feb 09 - Rejected'],
  },
  'CLM-0019': {
    summaryStatus: 'Under Verification',
    patientId: 'PT-00061',
    diagnosis: 'Minor Fracture',
    treatment: 'X-Ray + Casting',
    statusHistory: ['Feb 14 - Submitted', 'Feb 15 - Under Verification'],
  },
};

function statusPill(status: ClaimStatus) {
  switch (status) {
    case 'Pending':
      return 'bg-amber-200 text-amber-600';
    case 'Submitted':
      return 'bg-indigo-200 text-indigo-700';
    case 'Approved':
      return 'bg-green-200 text-green-600';
    case 'Paid':
      return 'bg-blue-200 text-blue-600';
    case 'Rejected':
      return 'bg-red-200 text-red-600';
    default:
      return 'bg-gray-200 text-gray-700';
  }
}

function claimActions(status: ClaimStatus) {
  if (status === 'Pending') return ['View', 'Submit', 'Approve', 'Reject'];
  if (status === 'Approved') return ['View', 'Collect Payment'];
  if (status === 'Paid') return ['View'];
  if (status === 'Rejected') return ['View'];
  return ['View', 'Approve', 'Reject'];
}

function toPeso(amount: number) {
  return `\u20b1${amount.toLocaleString()}`;
}

function formatLongDate(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function isExternalDocumentLink(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function modalFooterActions(status: ClaimStatus) {
  if (status === 'Pending') return ['Close', 'Submit', 'Reject', 'Approve'];
  if (status === 'Submitted') return ['Close', 'Reject', 'Approve'];
  if (status === 'Approved') return ['Close', 'Collect Payment'];
  return ['Close'];
}

function matchesPeriod(dateFiled: string, period: PeriodFilter) {
  if (period === 'all') return true;
  const filedDate = new Date(dateFiled);
  if (Number.isNaN(filedDate.getTime())) return false;

  const now = new Date();
  if (period === 'thisMonth') {
    return filedDate.getFullYear() === now.getFullYear() && filedDate.getMonth() === now.getMonth();
  }
  if (period === 'thisYear') {
    return filedDate.getFullYear() === now.getFullYear();
  }

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  return filedDate >= thirtyDaysAgo && filedDate <= now;
}

export default function InsuranceClaims() {
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [claimsError, setClaimsError] = useState('');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [createClaimError, setCreateClaimError] = useState('');
  const [createClaimForm, setCreateClaimForm] = useState<CreateClaimForm>(initialCreateClaimForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeClaim, setActiveClaim] = useState<InsuranceClaim | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const loadClaims = useCallback(async () => {
    try {
      setClaimsError('');
      const response = await fetch(`${API_BASE_URL}/claims`);
      if (!response.ok) {
        throw new Error(`Failed to load claims (${response.status})`);
      }

      const raw = (await response.json()) as ClaimApiRow[];
      const mapped: InsuranceClaim[] = (Array.isArray(raw) ? raw : []).map((row) => ({
        claimDbId: Number.isInteger(row.claim_id) ? row.claim_id : null,
        claimId: row.claim_code || `CLM-${String(row.claim_id || '').padStart(4, '0')}`,
        patientName: row.patient_name || 'N/A',
        insuranceProvider: row.insurance_provider || 'N/A',
        policyNo: row.policy_no || 'N/A',
        amount: Number(row.claimed_amount || 0),
        status: (row.status as ClaimStatus) || 'Pending',
        dateFiled: row.claim_date || '',
      }));

      setClaims(mapped);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load claims';
      setClaimsError(message);
      setClaims([]);
    }
  }, []);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const filteredClaims = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return claims.filter((claim) => {
      const matchesSearch =
        !normalized ||
        claim.claimId.toLowerCase().includes(normalized) ||
        claim.patientName.toLowerCase().includes(normalized) ||
        claim.policyNo.toLowerCase().includes(normalized) ||
        claim.insuranceProvider.toLowerCase().includes(normalized);
      const matchesCategory =
        categoryFilter === 'all' || claim.insuranceProvider.toLowerCase() === categoryFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
      const matchesDate = matchesPeriod(claim.dateFiled, periodFilter);
      return matchesSearch && matchesCategory && matchesStatus && matchesDate;
    });
  }, [claims, searchTerm, categoryFilter, statusFilter, periodFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter, periodFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredClaims.length / 5));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visibleClaims = filteredClaims.slice((currentPage - 1) * 5, currentPage * 5);
  const providerOptions = useMemo(
    () => [...new Set(claims.map((claim) => claim.insuranceProvider).filter((name) => name && name !== 'N/A'))].sort(),
    [claims],
  );
  const activeClaimDetails = activeClaim ? claimDetails[activeClaim.claimId] : undefined;
  const summaryCards = useMemo(() => {
    const pendingClaims = filteredClaims.filter((claim) => claim.status === 'Pending');
    const approvedClaims = filteredClaims.filter((claim) => claim.status === 'Approved');
    const paidClaims = filteredClaims.filter((claim) => claim.status === 'Paid');
    const totalCollected = paidClaims.reduce((sum, claim) => sum + claim.amount, 0);

    return [
      {
        title: 'Pending Claims',
        value: `${pendingClaims.length} claims`,
        note: 'Claims awaiting review or verification',
        valueClass: 'text-amber-500',
        chipClass: 'bg-amber-500',
        icon: CircleDashed,
      },
      {
        title: 'Approved - Awaiting Payment',
        value: `${approvedClaims.length}`,
        note: 'Approved claims pending payment collection',
        valueClass: 'text-green-500',
        chipClass: 'bg-green-500',
        icon: FileCheck2,
      },
      {
        title: 'Total Collected',
        value: toPeso(totalCollected),
        note: 'Payments recorded from current table results',
        valueClass: 'text-blue-600',
        chipClass: 'bg-blue-600',
        icon: WalletCards,
      },
    ];
  }, [filteredClaims]);

  async function handleCreateClaimSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateClaimError('');

    const claimedAmount = Number(createClaimForm.claimAmount);

    if (!createClaimForm.patientName.trim()) {
      setCreateClaimError('Patient Name is required.');
      return;
    }
    if (!createClaimForm.insuranceProvider.trim()) {
      setCreateClaimError('Insurance Provider is required.');
      return;
    }
    if (!createClaimForm.policyNumber.trim()) {
      setCreateClaimError('Policy Number is required.');
      return;
    }
    if (!Number.isFinite(claimedAmount) || claimedAmount <= 0) {
      setCreateClaimError('Claim Amount must be greater than 0.');
      return;
    }

    try {
      setIsSubmittingClaim(true);
      const createResponse = await fetch(`${API_BASE_URL}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name: createClaimForm.patientName.trim(),
          insurance_provider: createClaimForm.insuranceProvider.trim(),
          policy_number: createClaimForm.policyNumber.trim(),
          claimed_amount: claimedAmount,
          date_of_service: createClaimForm.dateOfService || undefined,
          diagnosis: createClaimForm.diagnosis || undefined,
          treatment_provided: createClaimForm.treatmentProvided || undefined,
          remarks:
            [
              createClaimForm.diagnosis,
              createClaimForm.treatmentProvided,
              createClaimForm.supportingDocuments ? `Documents: ${createClaimForm.supportingDocuments}` : '',
            ]
              .filter(Boolean)
              .join(' | ') || undefined,
        }),
      });

      if (!createResponse.ok) {
        const errorBody = await createResponse.json().catch(() => null);
        throw new Error(errorBody?.error || errorBody?.message || `Create claim failed (${createResponse.status})`);
      }

      const created = (await createResponse.json()) as { claim_id?: number };
      if (!created?.claim_id) {
        throw new Error('Claim created but claim_id is missing in response.');
      }

      setCreateClaimForm(initialCreateClaimForm);
      setIsCreateModalOpen(false);
      await loadClaims();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create and submit claim.';
      setCreateClaimError(message);
    } finally {
      setIsSubmittingClaim(false);
    }
  }

  async function handleClaimDecision(claim: InsuranceClaim, decision: 'submit' | 'approve' | 'reject' | 'pay') {
    if (!claim.claimDbId) {
      setClaimsError('Claim ID is missing, cannot process this action.');
      return;
    }

    try {
      setClaimsError('');
      const endpoint = decision === 'submit' ? 'submit' : decision === 'approve' ? 'approve' : decision === 'pay' ? 'pay' : 'reject';
      const body =
        decision === 'submit'
          ? {}
          : decision === 'approve'
          ? { approved_amount: claim.amount }
          : decision === 'pay'
          ? { remarks: 'Payment collected from claims module' }
          : { remarks: 'Rejected from claims module' };
      const response = await fetch(`${API_BASE_URL}/claims/${claim.claimDbId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || errorBody?.message || `${decision} failed (${response.status})`);
      }

      setOpenMenuId(null);
      setActiveClaim(null);
      await loadClaims();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${decision} claim.`;
      setClaimsError(message);
    }
  }

  async function handleClaimAction(action: string, claim: InsuranceClaim) {
    if (action === 'Submit') {
      await handleClaimDecision(claim, 'submit');
      return;
    }
    if (action === 'Approve') {
      await handleClaimDecision(claim, 'approve');
      return;
    }
    if (action === 'Reject') {
      await handleClaimDecision(claim, 'reject');
      return;
    }
    if (action === 'Collect Payment') {
      await handleClaimDecision(claim, 'pay');
      return;
    }
    setOpenMenuId(null);
    setActiveClaim(claim);
  }

  function handleViewClaimDocument(documentLabel: string) {
    const trimmed = documentLabel.trim();
    if (isExternalDocumentLink(trimmed)) {
      window.open(trimmed, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Reports & Insurance | Insurance Claims</h1>

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <p className="text-lg font-semibold text-gray-500">{card.title}</p>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-white ${card.chipClass}`}>
                    <Icon size={15} />
                  </span>
                </div>
                <p className={`mt-3 text-5xl font-bold ${card.valueClass}`}>{card.value}</p>
                <p className="mt-2 text-sm leading-snug font-semibold text-gray-800">{card.note}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
          {claimsError && (
            <p className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{claimsError}</p>
          )}
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:min-w-0 xl:flex-1 xl:max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              <input
                placeholder="Search by Claim ID, Patient Name, Policy No."
                className="w-full h-10 rounded-lg border border-gray-300 bg-gray-100 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:overflow-visible xl:pb-0">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="h-10 shrink-0 whitespace-nowrap rounded-lg bg-green-500 px-3.5 text-sm font-semibold text-white flex items-center gap-1.5"
              >
                <PlusCircle size={16} />
                Create New Claim
              </button>

              <div className="relative shrink-0">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-10 appearance-none rounded-lg border border-gray-300 bg-gray-100 pl-3 pr-9 text-sm font-medium text-gray-600 outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="all">All Categories</option>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>

              <div className="relative shrink-0">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ClaimStatus | 'all')}
                  className="h-10 appearance-none rounded-lg border border-gray-300 bg-gray-100 pl-3 pr-9 text-sm font-medium text-gray-600 outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                  <option value="Paid">Paid</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>

              <div className="relative shrink-0">
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                  className="h-10 appearance-none rounded-lg border border-gray-300 bg-gray-100 pl-3 pr-9 text-sm font-medium text-gray-600 outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="thisMonth">This Month</option>
                  <option value="last30Days">Last 30 Days</option>
                  <option value="thisYear">This Year</option>
                  <option value="all">All Time</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-200/90 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Claim ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Patient Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Insurance Provider</th>
                  <th className="px-3 py-2 text-left font-semibold">Policy No.</th>
                  <th className="px-3 py-2 text-left font-semibold">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Date Filed</th>
                  <th className="px-3 py-2 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleClaims.map((claim) => (
                  <tr key={claim.claimId} className="border-t border-gray-200 hover:bg-gray-200/40 text-gray-800">
                    <td className="px-3 py-2 font-semibold">{claim.claimId}</td>
                    <td className="px-3 py-2 font-semibold">{claim.patientName}</td>
                    <td className="px-3 py-2 font-semibold">{claim.insuranceProvider}</td>
                    <td className="px-3 py-2 font-semibold">{claim.policyNo}</td>
                    <td className="px-3 py-2 font-semibold">{toPeso(claim.amount)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex min-w-[92px] justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill(claim.status)}`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold">{claim.dateFiled}</td>
                    <td className="px-3 py-2 relative">
                      <button
                        type="button"
                        className="h-7 w-7 rounded-md text-gray-600 hover:bg-gray-200 inline-flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId((prev) => (prev === claim.claimId ? null : claim.claimId));
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {openMenuId === claim.claimId && (
                        <div
                          className="absolute right-3 top-8 z-20 min-w-[118px] overflow-hidden rounded-md border border-gray-300 bg-white shadow-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {claimActions(claim.status).map((action, idx) => (
                            <button
                              key={action}
                              type="button"
                              className={`w-full px-3 py-1.5 text-right text-xs ${
                                idx === 0 ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                              onClick={() => {
                                handleClaimAction(action, claim);
                              }}
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 text-sm text-gray-600">
            <p>
              Showing <span className="rounded-md bg-gray-300 px-2">{visibleClaims.length}</span> out of {filteredClaims.length}
            </p>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>
      </section>

      {(activeClaim || isCreateModalOpen) &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
      {activeClaim && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-16 backdrop-blur-[1px]">
          <div className="flex w-full max-w-[780px] flex-col rounded-2xl border border-gray-300 bg-gray-100 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-300 px-4 py-3">
              <h2 className="text-xl font-bold text-gray-800">Claim Details - {activeClaim.claimId}</h2>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill(activeClaim.status)}`}>
                {activeClaim.status}
              </span>
            </div>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4 text-sm text-gray-800">
              <section>
                <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-600">CLAIM SUMMARY</h3>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <p><span className="font-semibold">Claim ID:</span> {activeClaim.claimId}</p>
                  <p><span className="font-semibold">Date Filed:</span> {formatLongDate(activeClaim.dateFiled)}</p>
                  {activeClaimDetails?.dateOfService && <p><span className="font-semibold">Date of Service:</span> {formatLongDate(activeClaimDetails.dateOfService)}</p>}
                  <p><span className="font-semibold">Claim Amount:</span> {toPeso(activeClaim.amount)}</p>
                  <p><span className="font-semibold">Status:</span> {activeClaimDetails?.summaryStatus || activeClaim.status}</p>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-600">PATIENT INFORMATION</h3>
                <p className="font-semibold">{activeClaim.patientName}{activeClaimDetails?.patientId ? ` (${activeClaimDetails.patientId})` : ''}</p>
                {(activeClaimDetails?.contact || activeClaimDetails?.email) && (
                  <p className="text-gray-700">
                    {activeClaimDetails?.contact || ''}{activeClaimDetails?.contact && activeClaimDetails?.email ? ' | ' : ''}{activeClaimDetails?.email || ''}
                  </p>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-600">INSURANCE INFORMATION</h3>
                <p><span className="font-semibold">Provider:</span> {activeClaim.insuranceProvider}</p>
                <p><span className="font-semibold">Policy No:</span> {activeClaim.policyNo}</p>
                {activeClaimDetails?.coverage && <p><span className="font-semibold">Coverage:</span> {activeClaimDetails.coverage}</p>}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-600">MEDICAL DETAILS</h3>
                {activeClaimDetails?.diagnosis && <p><span className="font-semibold">Diagnosis:</span> {activeClaimDetails.diagnosis}</p>}
                {activeClaimDetails?.treatment && <p><span className="font-semibold">Treatment:</span> {activeClaimDetails.treatment}</p>}
                {activeClaimDetails?.physician && <p><span className="font-semibold">Physician:</span> {activeClaimDetails.physician}</p>}
              </section>

              {activeClaimDetails?.documents && activeClaimDetails.documents.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-600">DOCUMENTS</h3>
                  <div className="space-y-1">
                    {activeClaimDetails.documents.map((doc) => (
                      <div key={doc} className="flex items-center justify-between rounded-md bg-gray-200 px-3 py-1.5">
                        <span>{doc}</span>
                        <button
                          type="button"
                          disabled={!isExternalDocumentLink(doc)}
                          onClick={() => handleViewClaimDocument(doc)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-gray-400"
                          title={isExternalDocumentLink(doc) ? 'Open document' : 'No linked document URL'}
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {activeClaim.status === 'Approved' && (
                <section>
                  <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-600">PAYMENT INFORMATION</h3>
                  <p>No payment recorded yet.</p>
                </section>
              )}

              {activeClaimDetails?.paymentInfo && (
                <section>
                  <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-600">PAYMENT INFORMATION</h3>
                  <p><span className="font-semibold">Method:</span> {activeClaimDetails.paymentInfo.method}</p>
                  <p><span className="font-semibold">Reference No:</span> {activeClaimDetails.paymentInfo.referenceNo}</p>
                  <p><span className="font-semibold">Amount Paid:</span> {toPeso(activeClaimDetails.paymentInfo.amountPaid)}</p>
                  <p><span className="font-semibold">Payment Date:</span> {activeClaimDetails.paymentInfo.paymentDate}</p>
                  <p><span className="font-semibold">Verified By:</span> {activeClaimDetails.paymentInfo.verifiedBy}</p>
                </section>
              )}

              {activeClaimDetails?.rejectionReason && (
                <section>
                  <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-600">REJECTION REASON</h3>
                  <p>{activeClaimDetails.rejectionReason}</p>
                </section>
              )}

              <section>
                <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-600">STATUS HISTORY</h3>
                <div className="space-y-1">
                  {(activeClaimDetails?.statusHistory || [`${formatLongDate(activeClaim.dateFiled)} - Claim Submitted`]).map((entry) => (
                    <p key={entry}>- {entry}</p>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-300 px-4 py-3">
              {modalFooterActions(activeClaim.status).map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={async () => {
                    if (!activeClaim) return;
                    if (action === 'Approve') {
                      await handleClaimDecision(activeClaim, 'approve');
                      return;
                    }
                    if (action === 'Submit') {
                      await handleClaimDecision(activeClaim, 'submit');
                      return;
                    }
                    if (action === 'Reject') {
                      await handleClaimDecision(activeClaim, 'reject');
                      return;
                    }
                    if (action === 'Collect Payment') {
                      await handleClaimDecision(activeClaim, 'pay');
                      return;
                    }
                    setActiveClaim(null);
                  }}
                  className={`h-9 rounded-lg px-4 text-sm font-semibold ${
                    action === 'Close'
                      ? 'bg-gray-300 text-gray-700'
                      : action === 'Reject'
                      ? 'bg-red-500 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/20 p-4 pb-6 pt-20 backdrop-blur-[1px]">
          <form onSubmit={handleCreateClaimSubmit} className="w-full max-w-3xl rounded-2xl bg-gray-100 shadow-xl border border-gray-300 p-5">
            <div className="flex items-center justify-between border-b border-gray-300 pb-3">
              <h2 className="text-2xl font-semibold text-gray-600">Create Insurance Claim</h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="h-7 w-7 rounded-full bg-gray-300 text-gray-600 inline-flex items-center justify-center"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                    <UserRound size={16} />
                    Patient Information
                  </h3>
                  <div className="space-y-2.5">
                    <label className="block text-xs font-medium text-gray-700">Patient Name</label>
                    <input
                      value={createClaimForm.patientName}
                      onChange={(e) => setCreateClaimForm((prev) => ({ ...prev, patientName: e.target.value }))}
                      className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-sm"
                    />
                    <label className="block text-xs font-medium text-gray-700">Contact Number</label>
                    <input className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-sm" />
                    <label className="block text-xs font-medium text-gray-700">Email Address</label>
                    <input className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-sm" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                    <ShieldPlus size={16} />
                    Insurance Details
                  </h3>
                  <div className="space-y-2.5">
                    <label className="block text-xs font-medium text-gray-700">Insurance Provider</label>
                    <input
                      value={createClaimForm.insuranceProvider}
                      onChange={(e) => setCreateClaimForm((prev) => ({ ...prev, insuranceProvider: e.target.value }))}
                      className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-sm"
                    />
                    <label className="block text-xs font-medium text-gray-700">Policy Number</label>
                    <input
                      value={createClaimForm.policyNumber}
                      onChange={(e) => setCreateClaimForm((prev) => ({ ...prev, policyNumber: e.target.value }))}
                      className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-sm"
                    />
                    <label className="block text-xs font-medium text-gray-700">Coverage Type</label>
                    <input className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-sm" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                    <FileText size={16} />
                    Claim Details
                  </h3>
                  <div className="space-y-2.5">
                    <label className="block text-xs font-medium text-gray-700">Diagnosis</label>
                    <input
                      value={createClaimForm.diagnosis}
                      onChange={(e) => setCreateClaimForm((prev) => ({ ...prev, diagnosis: e.target.value }))}
                      className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-sm"
                    />
                    <label className="block text-xs font-medium text-gray-700">Treatment Provided</label>
                    <input
                      value={createClaimForm.treatmentProvided}
                      onChange={(e) => setCreateClaimForm((prev) => ({ ...prev, treatmentProvided: e.target.value }))}
                      className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-sm"
                    />
                    <label className="block text-xs font-medium text-gray-700">Claim Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createClaimForm.claimAmount}
                      onChange={(e) => setCreateClaimForm((prev) => ({ ...prev, claimAmount: e.target.value }))}
                      className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-sm"
                    />
                    <label className="block text-xs font-medium text-gray-700">Date of Service</label>
                    <input
                      type="date"
                      value={createClaimForm.dateOfService}
                      onChange={(e) => setCreateClaimForm((prev) => ({ ...prev, dateOfService: e.target.value }))}
                      className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-sm"
                    />
                    <label className="block text-xs font-medium text-gray-700">Upload Supporting Documents</label>
                    <div className="flex items-center gap-2">
                      <Link2 size={16} className="text-gray-500" />
                      <input
                        value={createClaimForm.supportingDocuments}
                        onChange={(e) => setCreateClaimForm((prev) => ({ ...prev, supportingDocuments: e.target.value }))}
                        placeholder="N/A"
                        className="h-8 w-full rounded border border-gray-300 bg-transparent px-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {createClaimError && <p className="text-xs font-medium text-red-600">{createClaimError}</p>}
                <button
                  type="submit"
                  disabled={isSubmittingClaim}
                  className="h-9 w-full rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {isSubmittingClaim ? 'Creating...' : 'Create Claim'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
          </>,
          document.body,
        )}
    </div>
  );
}
