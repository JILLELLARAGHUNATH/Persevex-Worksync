import React from 'react';

export default function ManagerTeamsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-6 w-44 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3.5 w-72 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800/60 rounded font-mono" />
              </div>
              <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-10 bg-slate-50 dark:bg-slate-800/40 rounded-lg" />
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-8 bg-slate-50 dark:bg-slate-800/30 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
