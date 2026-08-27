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
    <div className="flex items-center justify-between w-full py-4 px-1">
      {steps.map((step, idx) => {
        const status = getStepStatus(idx);
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-semibold transition-all ${
                  status === 'completed'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400'
                    : status === 'active'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400'
                    : status === 'rejected'
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
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
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 mt-1.5 text-center">
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