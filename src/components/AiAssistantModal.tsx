import React, { useState, useRef, useEffect } from 'react';
import { useApp, useActiveProject } from '../context/AppContext';
import { Modal } from './ui/Modal';
import { Sparkles, Send, Bot, User, Settings } from 'lucide-react';
import { askAssistant } from '../services/ai/tasks';
import { PROVIDER_CATALOG } from '../services/ai/registry';
import type { ChatMessage } from '../services/ai/types';
import { LazyMarkdownView } from './markdown/LazyMarkdownView';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** Assistant turns only: true when the local heuristic answered instead of a provider. */
  fallback?: boolean;
  /** Assistant turns only: the model id that answered, or `local-heuristic`. */
  source?: string;
  /** Assistant turns only: why the provider call failed, when it did. */
  error?: string;
}

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const QUICK_PROMPTS = [
  { label: 'Audit Buffer Safety', text: 'Audit our retroplanning buffer safety and list any at-risk tasks.', tone: 'text-purple-700 dark:text-purple-300' },
  { label: 'Suggest Missing Deliverables', text: 'Suggest missing UX research & design token deliverables for our timeline.', tone: 'text-blue-700 dark:text-blue-300' },
  { label: 'Generate Backwards Schedule', text: 'Generate a backwards schedule from the project target delivery date.', tone: 'text-emerald-700 dark:text-emerald-300' },
];

/** Retro-planning copilot. Answers come from the configured AI provider, or from the local heuristic — labelled either way. */
export const AiAssistantModal: React.FC = () => {
  const { isAiAssistantOpen, setIsAiAssistantOpen, setIsSettingsOpen, activeAiProvider } = useApp();
  const activeProject = useActiveProject();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, loading]);

  const providerName = activeAiProvider
    ? `${activeAiProvider.label} · ${PROVIDER_CATALOG[activeAiProvider.providerId]?.label ?? activeAiProvider.providerId} · ${activeAiProvider.model}`
    : null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputText.trim();
    if (!query || loading) return;
    setInputText('');

    const history: ChatMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
    const withUser: Turn[] = [...turns, { role: 'user', content: query, timestamp: now() }];
    setTurns(withUser);
    setLoading(true);

    try {
      const outcome = await askAssistant({ query, projectContext: activeProject, history }, activeAiProvider);
      setTurns([
        ...withUser,
        { role: 'assistant', content: outcome.reply, timestamp: now(), fallback: outcome.fallback, source: outcome.source, error: outcome.error },
      ]);
    } catch (err) {
      setTurns([
        ...withUser,
        {
          role: 'assistant',
          content: 'The assistant could not answer.',
          timestamp: now(),
          fallback: true,
          source: 'error',
          error: err instanceof Error ? err.message : String(err),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isAiAssistantOpen}
      onClose={() => setIsAiAssistantOpen(false)}
      title="Design Ops & Retroplanning Copilot"
      subtitle={
        <span className="text-xs">
          <span className="text-purple-600 dark:text-purple-400 font-medium">
            {activeProject.title} ({activeProject.tasks.length} tasks)
          </span>
          <span className="text-fg-muted"> · {providerName ?? 'no AI provider configured — replies come from the local heuristic'}</span>
        </span>
      }
      size="2xl"
      className="h-[600px]"
      bodyClassName="flex flex-col overflow-hidden"
      icon={
        <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
      }
      footer={
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            aria-label="Ask the copilot"
            placeholder="Ask about buffers, dependencies or the schedule…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-input border border-line text-xs text-fg placeholder-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'Asking…' : 'Ask'}</span>
          </button>
        </form>
      }
    >
      {/* Quick prompts */}
      <div className="px-4 py-2 bg-elevated/60 border-b border-line flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
        <span className="text-fg-muted text-[10px] uppercase font-bold shrink-0">Quick ask:</span>
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setInputText(p.text)}
            className={`px-2.5 py-1 rounded-lg bg-elevated hover:bg-line border border-line shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${p.tone}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Conversation */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" aria-live="polite">
        {turns.length === 0 && (
          <div className="text-xs text-fg-muted leading-relaxed space-y-2">
            <p>
              Ask about dependencies, milestones or the buffer left before {activeProject.targetDeliveryDate || 'the target date'}. The whole
              project is sent as context with each question.
            </p>
            {!activeAiProvider && (
              <p className="flex flex-wrap items-center gap-1.5">
                <span>No AI provider is configured, so answers come from a local heuristic that cannot read your question.</span>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="inline-flex items-center gap-1 underline underline-offset-2 text-blue-700 dark:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm"
                >
                  <Settings className="w-3 h-3" />
                  <span>Open settings</span>
                </button>
              </p>
            )}
          </div>
        )}

        {turns.map((msg, idx) => (
          <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-purple-600/20 border border-purple-500/40 text-purple-600 dark:text-purple-400'
              }`}
            >
              {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div
              className={`max-w-[80%] rounded-2xl p-3.5 space-y-2 text-xs leading-relaxed ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-elevated border border-line text-fg'
              }`}
            >
              {/* Assistant replies are markdown; the user's own bubble is their literal text. */}
              {msg.role === 'assistant' ? (
                <LazyMarkdownView content={msg.content} breaks className="sm:text-xs" />
              ) : (
                <div className="whitespace-pre-line">{msg.content}</div>
              )}

              {msg.role === 'assistant' && msg.fallback && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-fg space-y-1">
                  <p className="font-semibold">Answered locally, not by an AI provider.</p>
                  {msg.error && <p className="text-fg-muted">{msg.error}</p>}
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="inline-flex items-center gap-1 underline underline-offset-2 text-blue-700 dark:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Configure a provider</span>
                  </button>
                </div>
              )}

              <div className={`text-[9px] text-right font-mono ${msg.role === 'user' ? 'text-blue-800 dark:text-blue-200' : 'text-fg-muted'}`}>
                {msg.role === 'assistant' && msg.source && !msg.fallback ? `${msg.source} · ` : ''}
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 animate-pulse">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-elevated border border-line rounded-2xl p-3 text-xs text-fg-muted flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 animate-spin" />
              <span>{activeAiProvider ? `Asking ${activeAiProvider.label}…` : 'Building a local answer…'}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </Modal>
  );
};
