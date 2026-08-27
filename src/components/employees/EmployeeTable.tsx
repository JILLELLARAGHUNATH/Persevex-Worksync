'use client';

import React, { useState, useMemo, useEffect } from 'react';
import StatusBadge from '@/components/common/StatusBadge';
import MemberFormModal from '@/components/employees/MemberFormModal';
import PasswordManagerModal from '@/components/employees/PasswordManagerModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { toggleMemberStatusAction, deleteEmployeeAction } from '@/actions/employeeActions';
import { Search, Edit, Key, Power, UserPlus, Trash2, ShieldCheck, Mail, Phone, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function EmployeeTable({
  initialEmployees,
  teams,
  canManage = true,
}: {
  initialEmployees: any[];
  teams: any[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [employees, setEmployees] = useState(initialEmployees);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setEmployees(initialEmployees);
  }, [initialEmployees]);

  // Real-time synchronization
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (detail?.type === 'WORKFORCE_UPDATE') {
          const user = detail.payload?.user;
          const action = detail.payload?.action;

          if (action === 'EMPLOYEE_CREATED' && user) {
            setEmployees((prev) => {
              if (prev.some((x) => x.id === user.id)) return prev;
              return [user, ...prev];
            });
          } else if (action === 'EMPLOYEE_UPDATED' && user) {
            setEmployees((prev) => prev.map((x) => (x.id === user.id ? { ...x, ...user } : x)));
          } else if (action === 'EMPLOYEE_DELETED' && detail.payload?.userId) {
            setEmployees((prev) => prev.filter((x) => x.id !== detail.payload.userId));
          } else if (action === 'STATUS_TOGGLED' && user) {
            setEmployees((prev) => prev.map((x) => (x.id === user.id ? { ...x, accountStatus: user.accountStatus } : x)));
          }
        }
      } catch {}
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, []);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = e.fullName.toLowerCase();
        const id = (e.employeeId || '').toLowerCase();
        const email = e.email.toLowerCase();
        if (!name.includes(q) && !id.includes(q) && !email.includes(q)) return false;
      }
      if (teamFilter && e.teamId !== teamFilter) return false;
      if (roleFilter && e.role !== roleFilter) return false;
      return true;
    });
  }, [employees, search, teamFilter, roleFilter]);

  const handleOpenCreate = () => {
    setSelectedMember(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (emp: any) => {
    setSelectedMember(emp);
    setFormModalOpen(true);
  };

  const handleOpenPassword = (emp: any) => {
    setSelectedMember(emp);
    setPasswordModalOpen(true);
  };

  const handleSavedMember = (savedEmp: any) => {
    setEmployees((prev) => {
      const idx = prev.findIndex((x) => x.id === savedEmp.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedEmp;
        return copy;
      }
      return [savedEmp, ...prev];
    });
  };

  const handleToggleStatus = async (emp: any) => {
    const nextStatus = emp.accountStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    // Immediate optimistic update
    setEmployees((prev) =>
      prev.map((item) =>
        item.id === emp.id ? { ...item, accountStatus: nextStatus } : item
      )
    );
    const res = await toggleMemberStatusAction(emp.id);
    if (res.success) {
      toast.success(`Account status set to ${nextStatus}`);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to toggle status');
      // Revert if failed
      setEmployees((prev) =>
        prev.map((item) =>
          item.id === emp.id ? { ...item, accountStatus: emp.accountStatus } : item
        )
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    // Immediate optimistic update
    setEmployees((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    const res = await deleteEmployeeAction(deleteTarget.id);
    setDeleteLoading(false);
    setDeleteTarget(null);

    if (res.success) {
      toast.success(deleteTarget.name + ' removed from directory.');
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to delete employee.');
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 rounded-xl shadow-xs flex flex-col sm:flex-row gap-2.5 items-center justify-between transition-colors">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or email..."
            className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-medium"
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end text-xs">
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="h-8 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer text-xs"
          >
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-8 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-slate-700 dark:text-slate-300 font-medium focus:outline-none cursor-pointer text-xs"
          >
            <option value="">All Roles</option>
            <option value="MANAGER">Manager</option>
            <option value="TEAM_LEAD">Team Lead</option>
            <option value="EMPLOYEE">Employee</option>
          </select>

          {canManage && (
            <button
              onClick={handleOpenCreate}
              className="h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-3 rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Status</th>
                {canManage && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No matching employees found in workforce directory.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 font-bold flex items-center justify-center text-xs shrink-0">
                          {emp.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            {emp.fullName}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {emp.email}</span>
                            {emp.phone && <span className="flex items-center gap-1">&middot; <Phone className="w-3 h-3 text-slate-400" /> {emp.phone}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-600 dark:text-slate-400">
                      {emp.employeeId || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                          emp.role === 'MANAGER'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
                            : emp.role === 'TEAM_LEAD'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {emp.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {emp.team?.name || teams.find((t) => t.id === emp.teamId)?.name ? (
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                          {emp.team?.name || teams.find((t) => t.id === emp.teamId)?.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={emp.accountStatus || 'ACTIVE'} />
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                            title="Edit Profile"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenPassword(emp)}
                            className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                            title="Manage Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          {emp.role !== 'MANAGER' ? (
                            <>
                              <button
                                onClick={() => handleToggleStatus(emp)}
                                className={`p-1 rounded-md transition cursor-pointer ${
                                  emp.accountStatus === 'ACTIVE'
                                    ? 'text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60'
                                }`}
                                title={emp.accountStatus === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ id: emp.id, name: emp.fullName })}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                              Owner
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <MemberFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSaved={handleSavedMember}
        memberData={selectedMember}
        teams={teams}
      />

      <PasswordManagerModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        employee={selectedMember}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Remove Employee"
        description={`Are you sure you want to archive ${deleteTarget?.name}? Their active sessions will be revoked and account suspended.`}
        confirmLabel="Archive Employee"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
