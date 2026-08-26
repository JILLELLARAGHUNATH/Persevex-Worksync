'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
  Loader2
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-200 relative w-full">
      {/* Top Right Theme Toggle Button */}
      <div className="fixed top-6 right-6 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-xl transition cursor-pointer flex items-center justify-center"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {mounted && isDark ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-indigo-600" />
          )}
        </button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl dark:shadow-2xl transition-colors duration-200">
        <div className="flex flex-col items-center text-center mb-6">
          <PersevexLogo size="lg" subtitle="Employee Management & Attendance System" className="justify-center mb-2" />
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold">
            <RoleIcon className="w-3.5 h-3.5" /> Persevex Internal Access
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 text-xs text-red-600 dark:text-red-400 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div>
              <p className="font-bold">Access Denied</p>
              <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-300 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Official Email or Employee ID
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="name@persevex.com or EMP-001"
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition font-mono ${
                  errorMessage ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Account Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your account password"
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition font-mono ${
                  errorMessage ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-0"
              />
              Remember Me
            </label>
            <Link href="/forgot-password" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition duration-150 shadow-lg shadow-indigo-600/30 text-sm mt-2 cursor-pointer flex items-center justify-center gap-2"
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