import React from 'react';

export default function ManagerLeavesLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-6 w-60 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3.5 w-80 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          ))}
        </div>
        <div className="h-8 w-60 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>

      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                <div className="space-y-1">
                  <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-2.5 w-44 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
              </div>
              <div className="h-5 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-8 bg-slate-50 dark:bg-slate-800/40 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
