import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { DatePicker } from '@comps/common/DatePicker';
import CustomSelect from '@comps/common/CustomSelect';

export interface PhcFamilyAllocation {
  id: string;
  personName: string;
  amount: number;
  utilizedAmount: number;
  bookingDate: string;
  appointmentDate: string;
  centreName: string;
  centreCity: string;
  reimbursementCashless: string;
  reportReceivedDate: string;
  reportBillReceivedDate: string;
  reportBillSubmittedDate: string;
  settlementDate: string;
  phcStage: string;
  claimSettled: boolean;
  children: PhcFamilyAllocation[];
}

interface Props {
  allocations: PhcFamilyAllocation[];
  onChange: (allocations: PhcFamilyAllocation[]) => void;
  availableAmount: number;
  stageOptions: { value: string; label: string }[];
  familyMemberOptions: { value: string; label: string; sublabel?: string }[];
}

const createAllocation = (amount: number): PhcFamilyAllocation => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  personName: '',
  amount,
  utilizedAmount: 0,
  bookingDate: '',
  appointmentDate: '',
  centreName: '',
  centreCity: '',
  reimbursementCashless: 'CASHLESS',
  reportReceivedDate: '',
  reportBillReceivedDate: '',
  reportBillSubmittedDate: '',
  settlementDate: '',
  phcStage: 'TO_CONTACT',
  claimSettled: false,
  children: [],
});

const updateAllocation = (
  allocations: PhcFamilyAllocation[],
  id: string,
  update: (allocation: PhcFamilyAllocation) => PhcFamilyAllocation,
): PhcFamilyAllocation[] =>
  allocations.map(allocation => ({
    ...(allocation.id === id ? update(allocation) : allocation),
    children: updateAllocation(allocation.children, id, update),
  }));

const removeAllocation = (allocations: PhcFamilyAllocation[], id: string): PhcFamilyAllocation[] =>
  allocations
    .filter(allocation => allocation.id !== id)
    .map(allocation => ({ ...allocation, children: removeAllocation(allocation.children, id) }));

export const sumPhcFamilyAllocations = (allocations: PhcFamilyAllocation[]) =>
  allocations.reduce((sum, allocation) => sum + Math.max(0, Number(allocation.amount) || 0), 0);

interface AddButtonProps {
  allocations: PhcFamilyAllocation[];
  onChange: (allocations: PhcFamilyAllocation[]) => void;
  availableAmount: number;
}

export function PhcFamilyAllocationButton({ allocations, onChange, availableAmount }: AddButtonProps) {
  const remainingAmount = Math.max(0, availableAmount - sumPhcFamilyAllocations(allocations));
  return (
    <div className="md:col-span-3 rounded-xl border border-dashed border-blue-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-800">
          Family PHC allocations · Available: ₹{remainingAmount}
        </div>
        <button
          type="button"
          disabled={remainingAmount <= 0}
          onClick={() => onChange([...allocations, createAllocation(remainingAmount)])}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} />
          Add family member
        </button>
      </div>
    </div>
  );
}

export default function PhcFamilyAllocations({
  allocations,
  onChange,
  availableAmount,
  stageOptions,
  familyMemberOptions,
}: Props) {
  const renderAllocations = (
    items: PhcFamilyAllocation[],
    parentBalance: number,
    depth = 0,
  ): ReactNode => items.map(allocation => {
    const childAmount = sumPhcFamilyAllocations(allocation.children);
    const siblingAllocations = sumPhcFamilyAllocations(items) - allocation.amount;
    const maxUtilized = Math.max(0, parentBalance - siblingAllocations - childAmount);
    const personOptions = allocation.personName && !familyMemberOptions.some(option => option.value === allocation.personName)
      ? [...familyMemberOptions, { value: allocation.personName, label: allocation.personName }]
      : familyMemberOptions;

    return (
      <div key={allocation.id} className={`rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-3 ${depth > 0 ? 'ml-4' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-800">
            {allocation.personName || `Family member ${depth + 1}`} PHC allocation
          </div>
          <button
            type="button"
            title="Remove allocation"
            onClick={() => onChange(removeAllocation(allocations, allocation.id))}
            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
          <h5 className="text-[11px] font-black uppercase tracking-wider text-blue-700">PHC Booking & Centre Details</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Insured Person Name for PHC</label>
              <CustomSelect
                value={allocation.personName}
                onChange={value => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, personName: value })))}
                options={personOptions.length > 0
                  ? personOptions
                  : [{ value: '', label: 'No family members or connected persons added' }]}
                placeholder="Select family member..."
                searchable
              />
            </div>
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Booking Date</label>
              <DatePicker
                value={allocation.bookingDate || ''}
                onDateChange={value => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, bookingDate: value })))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Appointment Date</label>
              <DatePicker
                value={allocation.appointmentDate || ''}
                onDateChange={value => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, appointmentDate: value })))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Centre / Lab Name</label>
              <input
                type="text"
                value={allocation.centreName || ''}
                onChange={event => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, centreName: event.target.value })))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                placeholder="Centre / lab name"
              />
            </div>
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Centre / Lab City</label>
              <input
                type="text"
                value={allocation.centreCity || ''}
                onChange={event => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, centreCity: event.target.value })))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                placeholder="City"
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
          <h5 className="text-[11px] font-black uppercase tracking-wider text-emerald-700">PHC Claim & Settlement Details</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Utilized Amount (₹)</label>
              <input
                type="number"
                min={0}
                max={maxUtilized}
                value={allocation.utilizedAmount}
                onChange={event => {
                  const entered = Number(event.target.value) || 0;
                  const utilizedAmount = Math.max(0, Math.min(maxUtilized, entered));
                  onChange(updateAllocation(allocations, allocation.id, item => ({
                    ...item,
                    amount: utilizedAmount + childAmount,
                    utilizedAmount,
                  })));
                }}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                placeholder="Utilized Amount"
              />
            </div>
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Reimbursement / Cashless</label>
              <CustomSelect
                value={allocation.reimbursementCashless || 'CASHLESS'}
                onChange={value => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, reimbursementCashless: value })))}
                placeholder="Select Reimbursement / Cashless"
                options={[
                  { value: 'CASHLESS', label: 'Cashless Checkup' },
                  { value: 'REIMBURSEMENT', label: 'Reimbursement Claim' },
                ]}
              />
            </div>
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Report Received Date</label>
              <DatePicker
                value={allocation.reportReceivedDate || ''}
                onDateChange={value => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, reportReceivedDate: value })))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Report & Bill Received Date</label>
              <DatePicker
                value={allocation.reportBillReceivedDate || ''}
                onDateChange={value => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, reportBillReceivedDate: value })))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Report & Bill Submitted Date</label>
              <DatePicker
                value={allocation.reportBillSubmittedDate || ''}
                onDateChange={value => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, reportBillSubmittedDate: value })))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Settlement Date</label>
              <DatePicker
                value={allocation.settlementDate || ''}
                onDateChange={value => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, settlementDate: value })))}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Stage</label>
              <CustomSelect
                value={allocation.phcStage || 'TO_CONTACT'}
                onChange={value => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, phcStage: value })))}
                placeholder="Select Stage"
                options={stageOptions}
              />
            </div>
            <div>
              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Claim Settled?</label>
              <CustomSelect
                value={allocation.claimSettled ? 'yes' : 'no'}
                onChange={value => onChange(updateAllocation(allocations, allocation.id, item => ({ ...item, claimSettled: value === 'yes' })))}
                placeholder="Select Option"
                options={[
                  { value: 'no', label: 'No' },
                  { value: 'yes', label: 'Yes' },
                ]}
              />
            </div>
          </div>
        </section>

        <div className="space-y-3">
          {renderAllocations(allocation.children, Math.max(0, allocation.amount - allocation.utilizedAmount), depth + 1)}
        </div>
      </div>
    );
  });

  return (
    <div className="space-y-3 md:col-span-3">
      {renderAllocations(allocations, availableAmount)}
    </div>
  );
}
