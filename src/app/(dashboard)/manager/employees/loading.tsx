import React from 'react';

export default function ManagerEmployeesLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-1.5">
        <div className="h-6 w-56 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3.5 w-72 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        <div className="h-8 w-full sm:w-80 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-8 w-32 bg-blue-600/30 rounded-lg" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="h-10 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800" />
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-2.5 w-48 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
              </div>
              <div className="h-3.5 w-24 bg-slate-100 dark:bg-slate-800 rounded hidden sm:block" />
              <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded hidden md:block" />
              <div className="h-5 w-20 bg-slate-100 dark:bg-slate-800 rounded hidden lg:block" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
        {/* Pagination bar skeleton */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
    </div>
  );
}
