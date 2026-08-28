import React from 'react';

export default function EmployeeApplyLeaveLoading() {
  return (
    <div className="space-y-4 max-w-4xl animate-pulse">
      <div className="space-y-1.5">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3.5 w-72 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
      </div>

      {/* Balance cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs space-y-2">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-7 w-12 bg-slate-300 dark:bg-slate-700 rounded-md" />
          </div>
        ))}
      </div>

      {/* Form skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-9 bg-slate-50 dark:bg-slate-800/60 rounded-lg" />
          <div className="h-9 bg-slate-50 dark:bg-slate-800/60 rounded-lg" />
          <div className="h-9 bg-slate-50 dark:bg-slate-800/60 rounded-lg" />
          <div className="h-9 bg-slate-50 dark:bg-slate-800/60 rounded-lg" />
        </div>
        <div className="h-20 bg-slate-50 dark:bg-slate-800/60 rounded-lg" />
        <div className="h-9 w-32 bg-blue-600/30 rounded-lg" />
      </div>
    </div>
  );
}
