import React, { useState } from 'react';
import { useApp, useActiveProject } from '../context/AppContext';
import { absoluteTime, timestampLabel } from '../utils/time';
import {
  Users,
  MessageSquare,
  Send,
  Clock,
  UserPlus,
  UserCheck,
  UserX,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';

export const TeamCollaborationView: React.FC = () => {
  const {
    currentUser,
    setCurrentUser,
    teamMembers,
    invitations,
    setIsInviteModalOpen,
    removeTeamMember,
    revokeInvitation,
    addComment,
    addNotification,
  } = useApp();
  const activeProject = useActiveProject();

  const [commentText, setCommentText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Calculate live workload hours per user from actual tasks
  const userWorkloads = teamMembers.map((user) => {
    const userTasks = activeProject.tasks.filter((t) => t.assigneeId === user.id);
    const totalHours = userTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
    const completedTasks = userTasks.filter((t) => t.status === 'done').length;
    return {
      user,
      taskCount: userTasks.length,
      totalHours,
      completedTasks,
    };
  });

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    addComment(commentText, 'project', activeProject.id);
    addNotification({
      title: `Feedback from ${currentUser.name}`,
      message: commentText.slice(0, 50),
      type: 'mention',
      projectId: activeProject.id,
    });
    setCommentText('');
  };

  const copyInviteLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}?token=${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-hidden">
      {/* Top Banner */}
      <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-xl bg-gradient-to-r from-purple-500/10 dark:from-purple-950/30 via-elevated to-transparent transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base sm:text-lg font-bold text-fg">
                Team Collaboration & Workload Distribution
              </h2>
            </div>
            <p className="text-xs text-fg-muted">
              Manage workspace members, invite new designers & clients, inspect workload capacities, and exchange design feedback.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="team-view-invite-btn"
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite New Collaborator</span>
            </button>

            <div className="flex items-center gap-1.5 bg-elevated px-3 py-1.5 rounded-xl border border-line">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">Live Storage Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Left Workload & Team Members, Right Discussion Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Designer Capacity Cards & Pending Invites */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Members Workload */}
          <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm dark:shadow-none transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-fg uppercase tracking-wider flex items-center gap-2">
                <span>Active Designers & Assignees</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                  {teamMembers.length}
                </span>
              </h3>
              <span className="text-[11px] text-fg-muted">Current persona: <strong className="text-purple-600 dark:text-purple-300">{currentUser.name}</strong></span>
            </div>

            <div className="space-y-3">
              {userWorkloads.map(({ user, taskCount, totalHours, completedTasks }) => {
                const isCurrent = currentUser.id === user.id;
                const isOnline = user.status === 'active' || user.status === 'crunching';
                return (
                  <div
                    key={user.id}
                    className="bg-elevated/60 p-4 rounded-xl border border-line hover:border-line-strong transition-all space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-purple-500/30"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                              isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-fg">{user.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-fg-muted">{user.email || user.role}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <div className="text-right pr-2">
                          <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-300">{totalHours} hrs</span>
                          <div className="text-[10px] text-fg-muted">{taskCount} tasks assigned</div>
                        </div>

                        {!isCurrent && (
                          <>
                            <button
                              onClick={() => setCurrentUser(user.id)}
                              className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-500/10 hover:bg-blue-200 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/20 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Switch active user to test collaborative views"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Switch</span>
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to revoke access for ${user.name}? They will be removed from this workspace.`)) {
                                  removeTeamMember(user.id);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-500/10 hover:bg-rose-200 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/20 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Revoke access and remove user from workspace"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Revoke Access</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-fg-muted">
                        <span>Sprint Completion:</span>
                        <span>
                          {completedTasks}/{taskCount} Done ({taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-line overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                          style={{
                            width: `${taskCount > 0 ? (completedTasks / taskCount) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Invitations Box */}
          {invitations.length > 0 && (
            <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm dark:shadow-none transition-colors">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pending Workspace Invitations ({invitations.length})</span>
                </h4>
              </div>

              <div className="space-y-2">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-elevated/60 border border-line"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-fg">{inv.name}</span>
                        <span className="text-[10px] text-fg-muted">({inv.email})</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">
                          {inv.role}
                        </span>
                      </div>
                      <div className="text-[10px] text-fg-muted mt-0.5">
                        Invited by {inv.invitedBy}
                        {timestampLabel(inv.invitedAt) && (
                          <>
                            {' '}
                            <time dateTime={inv.invitedAt} title={absoluteTime(inv.invitedAt) ?? undefined}>
                              {timestampLabel(inv.invitedAt)?.text}
                            </time>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => copyInviteLink(inv.token, inv.id)}
                        className="px-2.5 py-1 rounded-lg bg-line hover:bg-line-strong text-[11px] text-fg flex items-center gap-1"
                      >
                        {copiedId === inv.id ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === inv.id ? 'Copied' : 'Copy Token Link'}</span>
                      </button>
                      <button
                        onClick={() => revokeInvitation(inv.id)}
                        className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/10"
                        title="Revoke invitation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Design Feedback & Comments Feed */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 flex flex-col h-[560px] shadow-sm dark:shadow-xl transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="font-bold text-xs text-fg uppercase tracking-wider">
                  Live Design Critique Feed
                </h3>
              </div>
              <span className="text-[10px] text-purple-600 dark:text-purple-300 font-mono font-semibold">
                {activeProject.comments.length} Comments
              </span>
            </div>

            {/* Comments Stream */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 divide-y divide-line">
              {activeProject.comments.length === 0 ? (
                <div className="p-8 text-center text-fg-muted text-xs">
                  No feedback posted yet. Start the conversation below!
                </div>
              ) : (
                activeProject.comments.map((comm) => (
                  <div key={comm.id} className="pt-3 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={comm.authorAvatar}
                          alt={comm.authorName}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                        <span className="font-bold text-xs text-fg">{comm.authorName}</span>
                      </div>
                      {timestampLabel(comm.timestamp) && (
                        <time
                          dateTime={comm.timestamp}
                          title={absoluteTime(comm.timestamp) ?? undefined}
                          className="text-[10px] text-fg-subtle"
                        >
                          {timestampLabel(comm.timestamp)?.text}
                        </time>
                      )}
                    </div>
                    <p className="text-xs text-fg pl-7 leading-relaxed">{comm.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Post Comment Input */}
            <form onSubmit={handlePostComment} className="pt-3 border-t border-line flex gap-2">
              <input
                type="text"
                placeholder="Leave design feedback, @mention teammates..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl bg-input border border-line text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
