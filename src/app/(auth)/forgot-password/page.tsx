import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import PersevexLogo from '@/components/common/PersevexLogo';

export default function ForgotPasswordPage() {
  return (
    <div className="w-full flex items-center justify-center relative">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-7 shadow-lg transition-colors space-y-5">
        <div className="flex flex-col items-center text-center">
          <PersevexLogo size="lg" subtitle="Employee Management & Attendance System" className="justify-center mb-2" />
        </div>

        <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 rounded-xl">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Password Reset Required
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Organization Security Policy
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/70">
          <p className="font-medium text-slate-800 dark:text-slate-200">
            For security reasons, password resets are managed by your organization. Please contact your Manager or Administrator to reset your password.
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Your Manager or Administrator will assist you with resetting your account password.
          </p>
        </div>

        <div>
          <Link
            href="/login"
            className="w-full h-9.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs sm:text-sm transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}