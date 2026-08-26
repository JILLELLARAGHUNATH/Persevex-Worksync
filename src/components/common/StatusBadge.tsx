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
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'PENDING_TL':
      case 'PENDING_HR':
      case 'PENDING_MANAGER':
      case 'SCREENING':
      case 'SHORTLISTED':
      case 'INTERVIEW_SCHEDULED':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'REJECTED':
      case 'ABSENT':
      case 'LATE':
      case 'INACTIVE':
      case 'SUSPENDED':
        return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';
      case 'ON_LEAVE':
      case 'WORK_FROM_HOME':
      case 'HALF_DAY':
        return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
      default:
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border tracking-wide uppercase',
        getStyle(status),
        className
      )}
    >
      {status ? status.replace(/_/g, ' ') : 'UNKNOWN'}
    </span>
  );
}
