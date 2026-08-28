'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PersevexLogo from '@/components/common/PersevexLogo';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  UserCheck,
  Award,
  User,
  AlertCircle,
  Sun,
  Moon,
  Loader2,
  ShieldAlert,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const ROLE_METADATA: Record<string, { label: string; icon: any; placeholder: string; badge: string }> = {
  MANAGER: { label: 'Manager', icon: UserCheck, placeholder: 'manager@persevex.com or EMP-MGR-001', badge: 'Executive & Organization Oversight' },
  TEAM_LEAD: { label: 'Team Lead', icon: Award, placeholder: 'tl@persevex.com or EMP-TL-001', badge: 'Squad & Team Management' },
  EMPLOYEE: { label: 'Employee', icon: User, placeholder: 'employee@persevex.com or EMP-001', badge: 'Personal Workspace' },
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role')?.toUpperCase();
  const selectedRole = roleParam && ROLE_METADATA[roleParam] ? roleParam : 'EMPLOYEE';
  const roleMeta = ROLE_METADATA[selectedRole] || ROLE_METADATA.EMPLOYEE;
  const RoleIcon = roleMeta.icon;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof document !== 'undefined') {
      setIsDark(document.documentElement.classList.contains('dark'));
    }
  }, []);

  const toggleTheme = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const currentlyDark = root.classList.contains('dark');
    if (currentlyDark) {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      try { localStorage.setItem('theme', 'light'); } catch {}
      setIsDark(false);
    } else {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      try { localStorage.setItem('theme', 'dark'); } catch {}
      setIsDark(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password: password.trim(),
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Invalid credentials. Please verify your Email/Employee ID and Password.');
        toast.error('Authentication Failed', {
          description: data.error || 'Invalid credentials.',
        });
        setLoading(false);
        return;
      }

      toast.success(`Welcome back, ${data.user.fullName}!`);

      const roleRoutes: Record<string, string> = {
        MANAGER: '/manager',
        TEAM_LEAD: '/team-lead',
        EMPLOYEE: '/employee',
      };

      const targetRoute = roleRoutes[data.user.role] || '/employee';
      window.location.href = targetRoute;
    } catch {
      setErrorMessage('Network communication error. Please ensure the server is running.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex items-center justify-center relative">
      {/* Top Right Theme Toggle Button */}
      <div className="fixed top-5 right-5 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-xs transition cursor-pointer flex items-center justify-center"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {mounted && isDark ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 text-blue-600" />
          )}
        </button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-7 shadow-lg transition-colors">
        <div className="flex flex-col items-center text-center mb-5">
          <PersevexLogo size="lg" subtitle="Employee Management & Attendance System" className="justify-center mb-1.5" />
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 rounded-md text-xs font-medium">
            <RoleIcon className="w-3.5 h-3.5" /> Persevex Internal Access
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div>
              <p className="font-semibold">Access Denied</p>
              <p className="mt-0.5 text-[11px] text-rose-600 dark:text-rose-300 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Official Email or Employee ID
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Email or Employee ID"
                className={`w-full h-9.5 bg-slate-50 dark:bg-slate-800/70 border rounded-lg pl-9 pr-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none transition font-mono ${
                  errorMessage ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:border-blue-500'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your account password"
                className={`w-full h-9.5 bg-slate-50 dark:bg-slate-800/70 border rounded-lg pl-9 pr-9 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none transition font-mono ${
                  errorMessage ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:border-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded-xs bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 accent-blue-600"
              />
              Remember Me
            </label>
            <button
              type="button"
              onClick={() => setForgotModalOpen(true)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition duration-150 shadow-xs text-xs sm:text-sm mt-1 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In to Persevex</span>
            )}
          </button>
        </form>
      </div>

      {/* Professional Password Reset Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4 transition-colors animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                    Password Reset Required
                  </h3>
                  <span className="text-[11px] font-medium text-slate-400">Organization Security Policy</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/70">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                For security reasons, password resets are managed by your organization. Please contact your Manager or Administrator to reset your password.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Your Manager or Administrator will assist you with resetting your account password.
              </p>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs sm:text-sm transition shadow-xs cursor-pointer flex items-center justify-center"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading Persevex Authentication...</div>}>
      <LoginForm />
    </Suspense>
  );
}