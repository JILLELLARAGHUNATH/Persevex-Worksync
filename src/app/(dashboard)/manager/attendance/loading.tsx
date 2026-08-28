import React from 'react';

export default function ManagerAttendanceLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-1.5">
        <div className="h-6 w-64 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3.5 w-80 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
      </div>

      {/* Preset & Filter Bar Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            ))}
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* Attendance Ledger Table Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="h-10 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800" />
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-2.5 w-20 bg-slate-100 dark:bg-slate-800/60 rounded font-mono" />
                </div>
              </div>
              <div className="h-3.5 w-24 bg-slate-100 dark:bg-slate-800 rounded hidden sm:block" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3.5 w-20 bg-slate-100 dark:bg-slate-800 rounded hidden md:block" />
              <div className="h-3.5 w-20 bg-slate-100 dark:bg-slate-800 rounded hidden md:block" />
              <div className="h-3.5 w-16 bg-slate-100 dark:bg-slate-800 rounded hidden lg:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
