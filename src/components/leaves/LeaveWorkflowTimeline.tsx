import React from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

interface TimelineProps {
  currentStage: string;
}

export default function LeaveWorkflowTimeline({ currentStage }: TimelineProps) {
  const steps = [
    { key: 'PENDING_TL', label: '1. Team Lead' },
    { key: 'PENDING_HR', label: '2. HR Executive' },
    { key: 'PENDING_MANAGER', label: '3. Manager' },
    { key: 'APPROVED', label: '4. Final Approval' },
  ];

  const getStepStatus = (index: number) => {
    if (currentStage === 'REJECTED') return 'rejected';

    const stageOrder: Record<string, number> = {
      PENDING_TL: 0,
      PENDING_HR: 1,
      PENDING_MANAGER: 2,
      APPROVED: 3,
    };

    const currentOrder = stageOrder[currentStage] ?? 0;
    if (index < currentOrder) return 'completed';
    if (index === currentOrder) return 'active';
    return 'upcoming';
  };

  return (
    <div className="flex items-center justify-between w-full py-5 px-2">
      {steps.map((step, idx) => {
        const status = getStepStatus(idx);
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border text-xs font-bold transition-all shadow-sm ${
                  status === 'completed'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : status === 'active'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20 animate-pulse'
                    : status === 'rejected'
                    ? 'bg-red-500/15 border-red-500 text-red-600 dark:text-red-400'
                    : 'bg-slate-100  dark:bg-slate-950 dark:bg-slate-800 border-slate-300  dark:border-slate-800 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                }`}
              >
                {status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : status === 'rejected' ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-2 text-center">
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className="flex-1 h-[2px] mx-2 bg-slate-200 dark:bg-slate-800 relative -top-3">
                <div
                  className={`h-full transition-all duration-300 ${
                    getStepStatus(idx + 1) === 'completed' || getStepStatus(idx) === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}