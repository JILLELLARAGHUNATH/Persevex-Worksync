import React from 'react';

export default function ManagerReportsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-6 w-44 bg-slate-200 dark:bg-slate-800 rounded-md" />
        <div className="h-3.5 w-80 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4 max-w-2xl">
        <div className="grid grid-cols-3 gap-2">
          <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
        <div className="space-y-3 pt-3">
          <div className="h-9 bg-slate-50 dark:bg-slate-800/60 rounded-lg" />
          <div className="h-9 bg-slate-50 dark:bg-slate-800/60 rounded-lg" />
          <div className="h-9 bg-slate-50 dark:bg-slate-800/60 rounded-lg" />
          <div className="h-9 w-36 bg-blue-600/30 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
