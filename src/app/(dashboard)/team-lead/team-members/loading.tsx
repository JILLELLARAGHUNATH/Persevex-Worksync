import React from 'react';

export default function TLTeamMembersLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-1.5">
          <div className="h-6 w-52 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-3.5 w-72 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="h-8 w-36 bg-blue-50 dark:bg-blue-950/50 rounded-lg" />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="h-10 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800" />
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-2.5 w-44 bg-slate-100 dark:bg-slate-800/60 rounded" />
                </div>
              </div>
              <div className="h-3.5 w-24 bg-slate-100 dark:bg-slate-800 rounded hidden sm:block" />
              <div className="h-5 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
