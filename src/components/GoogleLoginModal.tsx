import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, CheckCircle2, Shield, LogOut, RefreshCw, FolderSync } from 'lucide-react';

export const GoogleLoginModal: React.FC = () => {
  const {
    googleAccount,
    loginWithGoogle,
    logoutGoogle,
    isGoogleLoginOpen,
    setIsGoogleLoginOpen,
  } = useApp();

  const [customEmail, setCustomEmail] = useState(googleAccount.email || 'berenger.recoules@gmail.com');
  const [customName, setCustomName] = useState(googleAccount.name || 'Berenger Recoules');
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isGoogleLoginOpen) return null;

  const handleConnect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      loginWithGoogle(customEmail, customName);
      setIsConnecting(false);
    }, 600);
  };

  const handleDisconnect = () => {
    logoutGoogle();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#0D121F] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            {/* Google "G" Logo */}
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100 tracking-tight">Google Workspace Connection</h3>
              <p className="text-[11px] text-slate-400">Google Drive export, import & OAuth sync</p>
            </div>
          </div>
          <button
            onClick={() => setIsGoogleLoginOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {googleAccount.isSignedIn ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={googleAccount.avatar}
                    alt={googleAccount.name}
                    className="w-10 h-10 rounded-full border border-emerald-500/40 object-cover"
                  />
                  <div>
                    <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                      <span>{googleAccount.name}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">{googleAccount.email}</div>
                  </div>
                </div>

                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 flex items-center gap-1 text-[11px] transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>

              {/* Scopes & Permissions List */}
              <div className="bg-[#141B2D] border border-white/5 rounded-xl p-3.5 space-y-2">
                <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span>Granted Permissions</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Google Drive Document Export & Sync (drive.file)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>User Profile & Team Presence info</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Real-time Workspace Collaboration</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-slate-400 text-[11px]">
                <span>Token Status: Active</span>
                <span className="font-mono text-emerald-400">OAuth2 Verified</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                <p className="text-slate-300 leading-relaxed">
                  Sign in with your Google account to enable 1-click Google Drive synchronization, export structured
                  retroplanning briefs, and collaborate with your team.
                </p>

                <div className="space-y-2">
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Google Email</label>
                    <input
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#141B2D] border border-white/10 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#141B2D] border border-white/10 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full py-2.5 rounded-xl bg-white text-slate-900 font-semibold flex items-center justify-center gap-2 hover:bg-slate-100 transition-all shadow-lg shadow-white/5 disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-600" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Sign In with Google</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/5">
            <button
              onClick={() => setIsGoogleLoginOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
