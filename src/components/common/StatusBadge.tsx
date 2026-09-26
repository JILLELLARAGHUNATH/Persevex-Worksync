import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { bg: string; dot: string; label: string }> = {
  ACTIVE:               { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50', dot: 'bg-emerald-500', label: 'Active' },
  PRESENT:              { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50', dot: 'bg-emerald-500', label: 'Full Day' },
  APPROVED:             { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50', dot: 'bg-emerald-500', label: 'Approved' },
  ON_TIME:              { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50', dot: 'bg-emerald-500', label: 'On Time' },
  HIRED:                { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50', dot: 'bg-emerald-500', label: 'Hired' },
  PAID:                 { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50', dot: 'bg-emerald-500', label: 'Paid' },

  LATE:                 { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/50', dot: 'bg-amber-500', label: 'Late' },
  PENDING_TL:           { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/50', dot: 'bg-amber-500', label: 'Pending TL' },
  PENDING_HR:           { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/50', dot: 'bg-amber-500', label: 'Pending HR' },
  PENDING_MANAGER:      { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/50', dot: 'bg-amber-500', label: 'Pending Manager' },
  SCREENING:            { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/50', dot: 'bg-amber-500', label: 'Screening' },
  SHORTLISTED:          { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/50', dot: 'bg-amber-500', label: 'Shortlisted' },
  INTERVIEW_SCHEDULED:  { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/50', dot: 'bg-amber-500', label: 'Interview Scheduled' },
  PENDING:              { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/50', dot: 'bg-amber-500', label: 'Pending' },

  REJECTED:             { bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800/50', dot: 'bg-rose-500', label: 'Rejected' },
  ABSENT:               { bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800/50', dot: 'bg-rose-500', label: 'Absent' },
  INACTIVE:             { bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800/50', dot: 'bg-rose-500', label: 'Inactive' },
  SUSPENDED:            { bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800/50', dot: 'bg-rose-500', label: 'Suspended' },
  UNPAID:               { bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800/50', dot: 'bg-rose-500', label: 'Unpaid' },

  ON_LEAVE:             { bg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400 border-violet-200 dark:border-violet-800/50', dot: 'bg-violet-500', label: 'On Leave' },
  HALF_DAY:             { bg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400 border-violet-200 dark:border-violet-800/50', dot: 'bg-violet-500', label: 'Half Day' },

  WORK_FROM_HOME:       { bg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border-sky-200 dark:border-sky-800/50', dot: 'bg-sky-500', label: 'WFH' },
  ON_DUTY:              { bg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border-sky-200 dark:border-sky-800/50', dot: 'bg-sky-500', label: 'On Duty' },

  WORKING:              { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50', dot: 'bg-emerald-500', label: 'Working' },
  FINALIZED:            { bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50', dot: 'bg-indigo-500', label: 'Finalized' },
  DRAFT:                { bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-slate-200 dark:border-slate-700', dot: 'bg-slate-400', label: 'Draft' },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status?.toUpperCase() || '';
  const config = STATUS_CONFIG[key];

  const badgeBg = config?.bg ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  const dotColor = config?.dot ?? 'bg-slate-400';
  const label = config?.label ?? (status ? status.replace(/_/g, ' ') : 'Unknown');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border tracking-tight select-none',
        badgeBg,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
      {label}
    </span>
  );
}
