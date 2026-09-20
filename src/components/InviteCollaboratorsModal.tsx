import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Link2,
  Mail,
  Copy,
  Check,
  Shield,
  Clock,
  Sparkles,
  Users,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CollaboratorPermissions } from '../types';

export const InviteCollaboratorsModal: React.FC = () => {
  const {
    isInviteModalOpen,
    setIsInviteModalOpen,
    teamMembers,
    invitations,
    inviteCollaborator,
    removeTeamMember,
    updateTeamMemberRole,
    revokeInvitation,
    activeProject,
    currentUser,
    setCurrentUser,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'email' | 'link' | 'members' | 'pending'>('email');
  
  // Email Form State
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('UI/UX Designer');
  const [note, setNote] = useState('');
  const [permissions, setPermissions] = useState<CollaboratorPermissions>({
    canEditTimeline: true,
    canManageTasks: true,
    canEditDocs: true,
    canSyncDrive: false,
    isAdmin: false,
  });

  // Link Invite State
  const [linkRole, setLinkRole] = useState('UI/UX Designer');
  const [linkExpiration, setLinkExpiration] = useState('7 days');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSuccessToast, setIsSuccessToast] = useState(false);

  if (!isInviteModalOpen) return null;

  const currentInviteLink = `${window.location.origin}?invite_ws=${activeProject.workspaceId}&proj=${activeProject.id}&role=${encodeURIComponent(linkRole)}&exp=${encodeURIComponent(linkExpiration)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentInviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    inviteCollaborator(email, name, role, permissions, note);
    setEmail('');
    setName('');
    setNote('');
    setIsSuccessToast(true);
    setTimeout(() => {
      setIsSuccessToast(false);
      setActiveTab('members');
    }, 1200);
  };

  // Calculate task workload hours for each team member in active project
  const getMemberWorkload = (memberId: string) => {
    return activeProject.tasks
      .filter((t) => t.assigneeId === memberId)
      .reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
  };

  return (
    <div
      id="invite-collaborators-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div
        id="invite-collaborators-modal"
        className="bg-[#0D121F] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-900/20 via-transparent to-blue-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Invite Collaborators</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Live Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Add designers, PMs, and clients to <strong className="text-slate-200">{activeProject.title}</strong>
              </p>
            </div>
          </div>
          <button
            id="close-invite-modal-btn"
            onClick={() => setIsInviteModalOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 px-4 sm:px-5 bg-white/[0.01] overflow-x-auto text-xs">
          <button
            id="tab-invite-email"
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 font-medium transition-colors shrink-0 ${
              activeTab === 'email'
                ? 'border-purple-500 text-purple-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Invite by Email</span>
          </button>
          <button
            id="tab-invite-link"
            onClick={() => setActiveTab('link')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 font-medium transition-colors shrink-0 ${
              activeTab === 'link'
                ? 'border-purple-500 text-purple-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Direct Invite Link</span>
          </button>
          <button
            id="tab-invite-members"
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 font-medium transition-colors shrink-0 ${
              activeTab === 'members'
                ? 'border-purple-500 text-purple-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Active Team ({teamMembers.length})</span>
          </button>
          <button
            id="tab-invite-pending"
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 font-medium transition-colors shrink-0 ${
              activeTab === 'pending'
                ? 'border-purple-500 text-purple-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending ({invitations.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Success Toast Banner */}
          {isSuccessToast && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Invitation dispatched! Collaborator added to active workspace.</span>
            </div>
          )}

          {/* TAB 1: INVITE BY EMAIL */}
          {activeTab === 'email' && (
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address <span className="text-purple-400">*</span>
                  </label>
                  <input
                    id="invite-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teammate@designagency.com"
                    className="w-full bg-[#131927] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Name (Optional)
                  </label>
                  <input
                    id="invite-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full bg-[#131927] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Project Role
                </label>
                <select
                  id="invite-role-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#131927] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="UI/UX Designer">UI/UX Designer (Specs & Components)</option>
                  <option value="Motion Designer">Motion Designer (Animations & Prototypes)</option>
                  <option value="Design System Lead">Design System Lead (Tokens & Foundations)</option>
                  <option value="Product Manager">Product Manager (Rétroplanning & Deadlines)</option>
                  <option value="Client Reviewer">Client Reviewer (Feedback & Approvals)</option>
                  <option value="QA Lead">QA Lead (Accessibility & Responsive Checks)</option>
                </select>
              </div>

              {/* Granular Permissions */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span>Granular Workspace Permissions</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canEditTimeline}
                      onChange={(e) => setPermissions({ ...permissions, canEditTimeline: e.target.checked })}
                      className="rounded border-white/20 bg-[#131927] text-purple-600 focus:ring-purple-500"
                    />
                    <span>Can modify Rétroplanning timeline</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canManageTasks}
                      onChange={(e) => setPermissions({ ...permissions, canManageTasks: e.target.checked })}
                      className="rounded border-white/20 bg-[#131927] text-purple-600 focus:ring-purple-500"
                    />
                    <span>Can create & assign deliverables</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canEditDocs}
                      onChange={(e) => setPermissions({ ...permissions, canEditDocs: e.target.checked })}
                      className="rounded border-white/20 bg-[#131927] text-purple-600 focus:ring-purple-500"
                    />
                    <span>Can edit Markdown specifications</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canSyncDrive}
                      onChange={(e) => setPermissions({ ...permissions, canSyncDrive: e.target.checked })}
                      className="rounded border-white/20 bg-[#131927] text-purple-600 focus:ring-purple-500"
                    />
                    <span>Can sync with Google Drive</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Welcome Note / Project Instructions (Optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Welcome to the Design System 3.0 launch sprint! Check out the Rétroplanning timeline..."
                  rows={2}
                  className="w-full bg-[#131927] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="send-invite-email-btn"
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Send Invite & Add Collaborator</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: DIRECT INVITE LINK */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-slate-300 space-y-1">
                <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>1-Click Onboarding Link</span>
                </div>
                <p>
                  Anyone with this link can join <strong className="text-slate-100">{activeProject.title}</strong> directly without manual invitation approval.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Default Role for Link Joiners
                  </label>
                  <select
                    id="link-role-select"
                    value={linkRole}
                    onChange={(e) => setLinkRole(e.target.value)}
                    className="w-full bg-[#131927] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="UI/UX Designer">UI/UX Designer</option>
                    <option value="Motion Designer">Motion Designer</option>
                    <option value="Client Reviewer">Client Reviewer</option>
                    <option value="Product Manager">Product Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Link Expiration
                  </label>
                  <select
                    id="link-exp-select"
                    value={linkExpiration}
                    onChange={(e) => setLinkExpiration(e.target.value)}
                    className="w-full bg-[#131927] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="7 days">Expires in 7 days</option>
                    <option value="30 days">Expires in 30 days</option>
                    <option value="never">Never expires</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Shareable Workspace Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="invite-link-display-input"
                    type="text"
                    readOnly
                    value={currentInviteLink}
                    className="w-full bg-[#131927] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono truncate focus:outline-none"
                  />
                  <button
                    id="copy-invite-link-btn"
                    type="button"
                    onClick={handleCopyLink}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30'
                    }`}
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACTIVE TEAM MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">
                Manage roles and view workload distribution across active designers in this project.
              </div>
              <div className="space-y-2">
                {teamMembers.map((member) => {
                  const workload = getMemberWorkload(member.id);
                  const isCurrent = currentUser.id === member.id;
                  return (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-9 h-9 rounded-full object-cover border border-purple-500/30 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-100 truncate">
                              {member.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{member.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Workload Badge */}
                        <div className="text-right pr-1">
                          <div className="text-[11px] font-mono font-semibold text-purple-300">
                            {workload}h assigned
                          </div>
                          <div className="text-[9px] text-slate-500">
                            {workload > 35 ? '⚠️ High Load' : 'Optimal Capacity'}
                          </div>
                        </div>

                        {/* Role selector */}
                        <select
                          value={member.role}
                          onChange={(e) => updateTeamMemberRole(member.id, e.target.value)}
                          className="bg-[#131927] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
                        >
                          <option value="UI/UX Designer">UI/UX Designer</option>
                          <option value="Motion Designer">Motion Designer</option>
                          <option value="Lead Architect">Lead Architect</option>
                          <option value="Design System Lead">Design System Lead</option>
                          <option value="Product Manager">Product Manager</option>
                          <option value="Client Reviewer">Client Reviewer</option>
                        </select>

                        {/* Switch Persona button for testing */}
                        {!isCurrent && (
                          <button
                            onClick={() => {
                              setCurrentUser(member);
                              setIsInviteModalOpen(false);
                            }}
                            title="Test the app as this user persona"
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 text-[10px] font-semibold flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Switch Persona</span>
                          </button>
                        )}

                        {/* Remove button */}
                        {!isCurrent && (
                          <button
                            onClick={() => removeTeamMember(member.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: PENDING INVITATIONS */}
          {activeTab === 'pending' && (
            <div className="space-y-3">
              {invitations.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No pending invitations. All invited members have joined!
                </div>
              ) : (
                invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/10"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{inv.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {inv.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">{inv.email} &bull; Invited by {inv.invitedBy}</div>
                      {inv.note && <div className="text-[10px] text-slate-500 italic mt-0.5">"{inv.note}"</div>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${window.location.origin}?token=${inv.token}`
                          );
                          alert('Invite link copied to clipboard!');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Link</span>
                      </button>
                      <button
                        onClick={() => revokeInvitation(inv.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                        title="Revoke invitation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-[#090D15] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Workspace sync active &bull; 0% Data Loss</span>
          </div>
          <button
            onClick={() => setIsInviteModalOpen(false)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
