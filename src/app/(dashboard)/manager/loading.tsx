import React from 'react';

export default function ManagerDashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-1.5">
        <div className="h-6 w-52 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3.5 w-96 max-w-full bg-slate-100 dark:bg-slate-800/60 rounded-md" />
      </div>

      {/* Filter / Preset Bar Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          ))}
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-32 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* 4 Metric KPI Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs space-y-2">
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-8 w-20 bg-slate-300 dark:bg-slate-700 rounded-md" />
            <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* Workforce Distribution Bar Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
        <div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-full" />
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
          <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-slate-50 dark:bg-slate-800/40 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-slate-50 dark:bg-slate-800/40 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
