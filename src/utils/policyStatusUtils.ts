export function getPolicyStatusDisplay(policy: any): { label: string; badgeClass: string } {
  if (!policy) return { label: 'Inforce', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };

  const rawStatus = String(policy.status || 'ACTIVE').toUpperCase();
  const lifecycleRaw = String(policy.lifecycleStatus || '').toUpperCase();

  if (rawStatus === 'CANCELLED' || lifecycleRaw === 'CANCELLED') {
    return { label: 'Cancelled', badgeClass: 'bg-red-100 text-red-800 border-red-300' };
  }
  if (rawStatus === 'INACTIVE_OLD' || lifecycleRaw === 'INACTIVE_OLD') {
    return { label: 'Inactive(Old)', badgeClass: 'bg-slate-100 text-slate-600 border-slate-300' };
  }
  if (rawStatus === 'SURRENDERED' || lifecycleRaw === 'SURRENDERED') {
    return { label: 'Surrendered', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300' };
  }
  if (rawStatus === 'EXPIRED' || lifecycleRaw === 'EXPIRED') {
    return { label: 'Expired', badgeClass: 'bg-slate-100 text-slate-600 border-slate-300' };
  }
  if (rawStatus === 'LAPSED' || lifecycleRaw === 'LAPSED') {
    return { label: 'Lapsed', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300' };
  }
  if (rawStatus === 'GRACE_PERIOD' || lifecycleRaw === 'GRACE_PERIOD') {
    let label = 'Grace Period';
    if (policy.displayStatus && String(policy.displayStatus).toLowerCase().includes('grace period')) {
      label = policy.displayStatus;
    } else if (policy.endDate) {
      const end = new Date(policy.endDate);
      const now = new Date();
      const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
      const diffDays = Math.round((todayMs - endMs) / (1000 * 60 * 60 * 24));
      if (diffDays >= 1 && diffDays <= 30) {
        label = `Grace Period - Day ${diffDays} of 30`;
      }
    }
    return { label, badgeClass: 'bg-orange-100 text-orange-800 border-orange-300' };
  }
  if (rawStatus === 'RENEWAL_DUE' || lifecycleRaw === 'RENEWAL_DUE') {
    return { label: 'Renewal Due', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' };
  }

  // If there's a backend-provided displayStatus for an active/inforce policy
  if (policy.displayStatus) {
    let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    const dispUpper = String(policy.displayStatus).toUpperCase();
    if (dispUpper.includes('RENEWAL')) badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    else if (dispUpper.includes('GRACE')) badgeClass = 'bg-orange-100 text-orange-800 border-orange-300';
    else if (dispUpper.includes('LAPSED')) badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
    else if (dispUpper.includes('CANCELLED')) badgeClass = 'bg-red-100 text-red-800 border-red-300';
    else if (dispUpper.includes('INACTIVE')) badgeClass = 'bg-slate-100 text-slate-600 border-slate-300';

    return { label: policy.displayStatus, badgeClass };
  }

  if (rawStatus === 'INFORCE' || rawStatus === 'ACTIVE') {
    if (!policy.endDate) return { label: 'Inforce', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };

    const end = new Date(policy.endDate);
    const now = new Date();
    const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const diffDays = Math.round((todayMs - endMs) / (1000 * 60 * 60 * 24));

    if (diffDays < -45) return { label: 'Inforce', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (diffDays >= -45 && diffDays <= 0) return { label: 'Renewal Due', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (diffDays >= 1 && diffDays <= 30) return { label: `Grace Period - Day ${diffDays} of 30`, badgeClass: 'bg-orange-100 text-orange-800 border-orange-300' };
    return { label: 'Lapsed', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300' };
  }

  const formattedRaw = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase().replace(/_/g, ' ');
  return { label: formattedRaw, badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' };
}

export function calculateLastInstallmentDate(
  firstDateStr: string | undefined | null,
  numInstallments: number | string | undefined | null,
  frequency: string | undefined | null = 'MONTHLY',
  installmentDay?: string | number | null
): string {
  if (!numInstallments) return '';
  const num = Number(numInstallments);
  if (isNaN(num) || num <= 0) return '';

  const rawDate = firstDateStr && String(firstDateStr).trim() ? String(firstDateStr).trim() : new Date().toISOString().split('T')[0];

  let d: Date;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
    const [dd, mm, yyyy] = rawDate.split('/').map(Number);
    d = new Date(yyyy, mm - 1, dd);
  } else if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
    const parts = rawDate.split('T')[0].split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(rawDate);
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  if (num === 1) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Determine months step per installment based on frequency
  let stepMonths = 1;
  const freqUpper = String(frequency || '').toUpperCase();
  if (freqUpper === 'QUARTERLY') stepMonths = 3;
  else if (freqUpper === 'HALF_YEARLY' || freqUpper === 'HALFYEARLY') stepMonths = 6;
  else if (freqUpper === 'YEARLY') {
    // For installment plans with multiple installments (e.g. 4 EMIs), installments are monthly
    stepMonths = num > 1 ? 1 : 12;
  }
  else if (freqUpper === 'SINGLE' || freqUpper.includes('ONE')) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // The last installment is installment #N, so (num - 1) intervals
  const totalMonthsToAdd = (num - 1) * stepMonths;

  const totalMonth = d.getMonth() + totalMonthsToAdd;
  const targetYear = d.getFullYear() + Math.floor(totalMonth / 12);
  const targetMonth = ((totalMonth % 12) + 12) % 12;

  // Prefer installmentDay if provided and valid, otherwise keep original day
  let targetDay = d.getDate();
  if (installmentDay) {
    const parsedDay = parseInt(String(installmentDay), 10);
    if (!isNaN(parsedDay) && parsedDay >= 1 && parsedDay <= 31) {
      targetDay = parsedDay;
    }
  }

  // Clamp to max days in target month
  const maxDaysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const finalDay = Math.min(targetDay, maxDaysInMonth);

  const mm = String(targetMonth + 1).padStart(2, '0');
  const dd = String(finalDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}
