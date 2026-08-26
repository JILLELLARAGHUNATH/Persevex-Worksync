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
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to save team.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    setTeams((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    const res = await deleteTeamAction(deleteTarget.id);
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
    const res = await moveMemberTeamAction(userId, newTeamId);
    if (res.success) {
      toast.success('Member squad assignment updated.');
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to move member');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" /> + Create New Team
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {teams.map((t) => (
          <div key={t.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    {t.code}
                  </span>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-lg mt-1">{t.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Edit Team"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title="Delete Team"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {(() => {
                const leads = [
                  ...(t.teamLead ? [t.teamLead] : []),
                  ...(t.members?.filter((m: any) => m.role === 'TEAM_LEAD' && m.id !== t.teamLeadId) || []),
                ];
                return (
                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {leads.length > 0 ? leads[0]?.fullName?.charAt(0) : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {leads.length > 1 ? `Team Leads (${leads.length})` : 'Team Lead'}
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {leads.length > 0 ? leads.map((l: any) => l.fullName).join(', ') : 'No Lead Assigned'}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5 font-medium">
                <Users className="w-4 h-4 text-indigo-500" />
                <span>{t.members?.length || 0} Members</span>
              </div>
              <button
                onClick={() => setViewingTeam(t)}
                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> View Squad
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Team Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingTeam ? 'Edit Team Details' : 'Create New Team'}
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Engineering Alpha"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5"
                />
              </div>

              {!editingTeam && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Team Code *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ENG-A"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-mono uppercase"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Assign Team Lead</label>
                <select
                  value={teamLeadId}
                  onChange={(e) => setTeamLeadId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5"
                >
                  <option value="">No Team Lead Assigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingTeam ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Squad Roster Modal */}
      {viewingTeam && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-md">
                  {viewingTeam.code}
                </span>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base mt-0.5">
                  {viewingTeam.name} Roster
                </h3>
              </div>
              <button onClick={() => setViewingTeam(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {viewingTeam.members?.length === 0 ? (
                <p className="text-center py-6 text-slate-400 text-xs">No members currently assigned to this team.</p>
              ) : (
                viewingTeam.members?.map((m: any) => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {m.fullName}
                        {(m.id === viewingTeam.teamLeadId || m.role === 'TEAM_LEAD') && (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-300 dark:border-amber-800">
                            Team Lead
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.employeeId || m.email}</div>
                    </div>

                    <button
                      onClick={() => handleMoveMember(m.id, null)}
                      className="text-rose-500 hover:text-rose-600 text-[11px] font-bold"
                    >
                      Unassign
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingTeam(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
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
