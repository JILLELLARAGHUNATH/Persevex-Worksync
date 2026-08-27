import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStyle = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'ACTIVE':
      case 'PRESENT':
      case 'APPROVED':
      case 'ON_TIME':
      case 'HIRED':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60';
      case 'LATE':
      case 'PENDING_TL':
      case 'PENDING_HR':
      case 'PENDING_MANAGER':
      case 'SCREENING':
      case 'SHORTLISTED':
      case 'INTERVIEW_SCHEDULED':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/60';
      case 'REJECTED':
      case 'ABSENT':
      case 'INACTIVE':
      case 'SUSPENDED':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800/60';
      case 'ON_LEAVE':
      case 'HALF_DAY':
        return 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400 border-violet-200 dark:border-violet-800/60';
      case 'WORK_FROM_HOME':
      case 'ON_DUTY':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200 dark:border-blue-800/60';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border tracking-tight',
        getStyle(status),
        className
      )}
    >
      {status ? status.replace(/_/g, ' ') : 'UNKNOWN'}
    </span>
  );
}

