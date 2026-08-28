import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-1.5">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3.5 w-72 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs space-y-2">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-7 w-16 bg-slate-300 dark:bg-slate-700 rounded-md" />
            <div className="h-2.5 w-28 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* Content Block Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-slate-50 dark:bg-slate-800/40 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
