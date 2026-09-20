import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Key, X, CheckCircle2, AlertCircle, RefreshCw, Cpu, ShieldCheck, Zap } from 'lucide-react';

export const ApiSettingsModal: React.FC = () => {
  const {
    apiSettings,
    updateApiSettings,
    testCurrentApiKey,
    isApiSettingsOpen,
    setIsApiSettingsOpen,
  } = useApp();

  const [keyInput, setKeyInput] = useState(apiSettings.apiKey || '');
  const [selectedModel, setSelectedModel] = useState(apiSettings.selectedModel || 'gemini-3.8-flash');
  const [useCustomKey, setUseCustomKey] = useState(apiSettings.useCustomKey || false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message?: string } | null>(null);

  if (!isApiSettingsOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    updateApiSettings({
      useCustomKey,
      apiKey: keyInput.trim(),
      selectedModel,
    });
    setTesting(true);
    const result = await testCurrentApiKey();
    setTesting(false);
    setTestResult(result);
  };

  const handleTestPing = async () => {
    setTesting(true);
    setTestResult(null);
    updateApiSettings({
      useCustomKey,
      apiKey: keyInput.trim(),
      selectedModel,
    });
    const result = await testCurrentApiKey();
    setTesting(false);
    setTestResult(result);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#0D121F] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100 tracking-tight">Gemini AI & API Key Settings</h3>
              <p className="text-[11px] text-slate-400">Configure AI models, latency, and client/server keys</p>
            </div>
          </div>
          <button
            onClick={() => setIsApiSettingsOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs">
          {/* Key Mode Switcher */}
          <div className="bg-[#141B2D] border border-white/5 rounded-xl p-3.5 space-y-3">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Authentication Source
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUseCustomKey(false)}
                className={`px-3 py-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  !useCustomKey
                    ? 'bg-purple-600/15 border-purple-500/40 text-purple-200'
                    : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span>Google AI Studio</span>
                </div>
                <span className="text-[10px] text-slate-400">Default server-side key via secrets</span>
              </button>

              <button
                type="button"
                onClick={() => setUseCustomKey(true)}
                className={`px-3 py-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  useCustomKey
                    ? 'bg-purple-600/15 border-purple-500/40 text-purple-200'
                    : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Custom Client Key</span>
                </div>
                <span className="text-[10px] text-slate-400">Use personal API Key</span>
              </button>
            </div>
          </div>

          {/* Custom Key Input */}
          {useCustomKey && (
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Gemini API Key</label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141B2D] border border-white/10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono text-xs"
              />
              <span className="text-[10px] text-slate-500">
                Your key is kept safe in browser session storage and proxied securely.
              </span>
            </div>
          )}

          {/* Model Selector */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>Gemini Model Engine</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedModel('gemini-3.8-flash')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedModel === 'gemini-3.8-flash'
                    ? 'bg-blue-600/15 border-blue-500/40 text-blue-200'
                    : 'bg-[#141B2D] border-white/5 text-slate-400 hover:border-white/10'
                }`}
              >
                <div className="font-semibold text-xs text-slate-200">gemini-3.8-flash</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Ultra-fast for notes crunching & design tasks</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedModel === 'gemini-3.1-pro-preview'
                    ? 'bg-purple-600/15 border-purple-500/40 text-purple-200'
                    : 'bg-[#141B2D] border-white/5 text-slate-400 hover:border-white/10'
                }`}
              >
                <div className="font-semibold text-xs text-slate-200">gemini-3.1-pro</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Deep reasoning for complex rétroplanning schedules</div>
              </button>
            </div>
          </div>

          {/* Connection Status & Ping Button */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {apiSettings.status === 'connected' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : apiSettings.status === 'invalid' ? (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              ) : (
                <Zap className="w-4 h-4 text-amber-400" />
              )}
              <div>
                <div className="font-medium text-slate-200">
                  {apiSettings.status === 'connected'
                    ? 'Ready & Connected'
                    : apiSettings.status === 'testing'
                    ? 'Testing connection...'
                    : 'Not Configured'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {apiSettings.lastValidated || 'Click Ping Test to verify connection'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestPing}
              disabled={testing}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin text-purple-400' : ''}`} />
              <span>Ping Test</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                testResult.valid
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              }`}
            >
              {testResult.valid ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => setIsApiSettingsOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={testing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Save & Apply</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
