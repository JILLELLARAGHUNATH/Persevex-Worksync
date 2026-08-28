'use client';

import React, { useState, useEffect } from 'react';
import { Layers, User, PlusCircle, Edit, Users, Eye, Trash2, Save, X, Loader2 } from 'lucide-react';
import { createTeamAction, updateTeamAction, deleteTeamAction, moveMemberTeamAction } from '@/actions/teamActions';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function TeamsManagementClient({ initialTeams, allUsers }: { initialTeams: any[]; allUsers: any[] }) {
  const router = useRouter();
  const [teams, setTeams] = useState(initialTeams);
  const [users, setUsers] = useState(allUsers);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [viewingTeam, setViewingTeam] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [teamLeadId, setTeamLeadId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  useEffect(() => {
    setUsers(allUsers);
  }, [allUsers]);

  // Real-time listener
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (detail?.type === 'WORKFORCE_UPDATE') {
          router.refresh();
        }
      } catch {}
    };

    window.addEventListener('persevex-realtime', handleRealtime);
    return () => window.removeEventListener('persevex-realtime', handleRealtime);
  }, [router]);

  const openCreate = () => {
    setEditingTeam(null);
    setName('');
    setCode('');
    setTeamLeadId('');
    setCreateModalOpen(true);
  };

  const openEdit = (t: any) => {
    setEditingTeam(t);
    setName(t.name);
    setCode(t.code);
    setTeamLeadId(t.teamLeadId || '');
    setCreateModalOpen(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = editingTeam
      ? await updateTeamAction(editingTeam.id, name, teamLeadId || null)
      : await createTeamAction(name, code, teamLeadId || null);

    setLoading(false);

    if (res.success) {
      toast.success(editingTeam ? 'Team updated!' : 'Team created!');
      setCreateModalOpen(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('persevex-realtime', {
            detail: { type: 'WORKFORCE_UPDATE', payload: { action: editingTeam ? 'TEAM_UPDATED' : 'TEAM_CREATED' } },
          })
        );
      }
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to save team.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setLoading(true);
    setTeams((prev) => prev.filter((t) => t.id !== targetId));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('persevex-realtime', {
          detail: { type: 'WORKFORCE_UPDATE', payload: { action: 'TEAM_DELETED', teamId: targetId } },
        })
      );
    }
    const res = await deleteTeamAction(targetId);
    setLoading(false);
    setDeleteTarget(null);

    if (res.success) {
      toast.success('Team deleted and members safely unassigned.');
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to delete team.');
      router.refresh();
    }
  };

  const handleMoveMember = async (userId: string, newTeamId: string | null) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('persevex-realtime', {
          detail: { type: 'WORKFORCE_UPDATE', payload: { action: 'MEMBER_MOVED', userId, teamId: newTeamId } },
        })
      );
    }
    const res = await moveMemberTeamAction(userId, newTeamId);
    if (res.success) {
      toast.success('Member squad assignment updated.');
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to move member');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" /> Create New Team
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((t) => (
          <div key={t.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-colors">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                    {t.code}
                  </span>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base mt-1.5">{t.name}</h3>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Edit Team"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Delete Team"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {(() => {
                const leads = [
                  ...(t.teamLead ? [t.teamLead] : []),
                  ...(t.members?.filter((m: any) => m.role === 'TEAM_LEAD' && m.id !== t.teamLeadId) || []),
                ];
                return (
                  <div className="mt-3.5 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center font-bold text-xs shrink-0">
                      {leads.length > 0 ? leads[0]?.fullName?.charAt(0) : <User className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        {leads.length > 1 ? `Team Leads (${leads.length})` : 'Team Lead'}
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {leads.length > 0 ? leads.map((l: any) => l.fullName).join(', ') : 'No Lead Assigned'}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>{t.members?.length || 0} Members</span>
              </div>
              <button
                onClick={() => setViewingTeam(t)}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> View Squad
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Team Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 shadow-xl space-y-3.5 animate-in zoom-in-95 transition-colors">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                {editingTeam ? 'Edit Team Details' : 'Create New Team'}
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Engineering Alpha"
                  className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {!editingTeam && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Team Code *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ENG-A"
                    className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 font-mono uppercase placeholder-slate-400 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Assign Team Lead</label>
                <select
                  value={teamLeadId}
                  onChange={(e) => setTeamLeadId(e.target.value)}
                  className="w-full h-9 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                >
                  <option value="">No Team Lead Assigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {editingTeam ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Squad Roster Modal */}
      {viewingTeam && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-xl space-y-3.5 animate-in zoom-in-95 transition-colors">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-mono font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 px-2 py-0.5 rounded-md">
                  {viewingTeam.code}
                </span>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base mt-1">
                  {viewingTeam.name} Roster
                </h3>
              </div>
              <button onClick={() => setViewingTeam(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-1.5">
              {viewingTeam.members?.length === 0 ? (
                <p className="text-center py-6 text-slate-400 text-xs">No members currently assigned to this team.</p>
              ) : (
                viewingTeam.members?.map((m: any) => (
                  <div
                    key={m.id}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        {m.fullName}
                        {(m.id === viewingTeam.teamLeadId || m.role === 'TEAM_LEAD') && (
                          <span className="text-[9px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-md font-medium border border-amber-200 dark:border-amber-800/60">
                            Team Lead
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.employeeId || m.email}</div>
                    </div>

                    <button
                      onClick={() => handleMoveMember(m.id, null)}
                      className="text-rose-500 hover:text-rose-600 text-[11px] font-medium hover:underline cursor-pointer"
                    >
                      Unassign
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setViewingTeam(null)}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Team Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Team"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? All assigned team members will remain safe in the system as unassigned.`}
        confirmLabel="Delete Team"
        variant="danger"
        loading={loading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
