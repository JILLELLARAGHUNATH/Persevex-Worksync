import React from 'react';

export default function EmployeeDashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-7 w-60 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3.5 w-72 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
      </div>

      {/* Clock In/Out card skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-10 w-44 bg-slate-300 dark:bg-slate-700 rounded font-mono" />
            <div className="h-3.5 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-11 w-32 bg-blue-600/30 rounded-xl" />
            <div className="h-11 w-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Analytics chart and cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs space-y-2">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-7 w-16 bg-slate-300 dark:bg-slate-700 rounded-md" />
            <div className="h-2.5 w-24 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-48 bg-slate-50 dark:bg-slate-800/40 rounded-lg" />
      </div>
    </div>
  );
}
