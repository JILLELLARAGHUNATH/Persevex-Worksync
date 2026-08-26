'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, User, Key, Loader2 } from 'lucide-react';
import { saveMemberAction } from '@/actions/employeeActions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface MemberFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (savedEmployee: any) => void;
  memberData?: any | null;
  teams: any[];
}

export default function MemberFormModal({ isOpen, onClose, onSaved, memberData, teams }: MemberFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [teamId, setTeamId] = useState('');

  useEffect(() => {
    if (memberData) {
      setFullName(memberData.fullName || '');
      setEmail(memberData.email || '');
      setPhone(memberData.phone || '');
      setRole(memberData.role || 'EMPLOYEE');
      setTeamId(memberData.teamId || '');
    } else {
      setFullName('');
      setEmail('');
      setPhone('');
      setRole('EMPLOYEE');
      setTeamId(teams[0]?.id || '');
    }
  }, [memberData, isOpen, teams]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    if (memberData?.id) formData.set('id', memberData.id);
    formData.set('fullName', fullName);
    formData.set('email', email);
    formData.set('phone', phone);
    formData.set('role', role);
    formData.set('teamId', teamId);

    const res = await saveMemberAction(formData);
    setLoading(false);

    if (res.success) {
      toast.success(res.message || 'Member saved successfully!');
      if (!memberData?.id) {
        toast.info('Default password set to: Persevex@123', { duration: 6000 });
      }
      if (onSaved && res.data) {
        onSaved(res.data);
      }
      onClose();
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to save member.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-5 transition-colors">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {memberData ? 'Edit Member' : 'Add New Member'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Simple 5-field account profile</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
              Employee Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rahul@persevex.com"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-indigo-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                Role *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-indigo-500 font-medium"
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="TEAM_LEAD">Team Lead</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                Squad / Team
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-indigo-500 font-medium"
              >
                <option value="">No Team Assigned</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!memberData && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-start gap-2 text-amber-800 dark:text-amber-300">
              <Key className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-bold">Auto Credentials Generated</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                  ID will be auto-assigned. Temporary password: <strong className="font-mono">Persevex@123</strong>
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {memberData ? 'Update Record' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
