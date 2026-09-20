import React, { useState, useRef, useEffect } from 'react';
import { useApp, useActiveProject } from '../context/AppContext';
import { Sparkles, Send, X, Bot, User } from 'lucide-react';
import { askAssistant } from '../services/ai/tasks';

export const GeminiAssistantModal: React.FC = () => {
  const {
    isAiAssistantOpen,
    setIsAiAssistantOpen,
    activeAiProvider,
  } = useApp();
  const activeProject = useActiveProject();

  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; content: string; timestamp: string }[]
  >([
    {
      role: 'assistant',
      content: `Hello! I'm your **Gemini Design Ops & Retroplanning Specialist**. I can analyze dependencies, reverse-engineer milestones, calculate backwards buffer margins before target delivery dates, or audit tasks for ${activeProject.title}. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isAiAssistantOpen) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userMessage = inputText.trim();
    setInputText('');

    const newMessages = [
      ...messages,
      {
        role: 'user' as const,
        content: userMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const outcome = await askAssistant({ query: userMessage, projectContext: activeProject }, activeAiProvider);
      const reply = outcome.reply;

      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: "I'm having trouble connecting to Gemini server right now. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl h-[600px] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Gemini Design Ops & Retroplanning Copilot</h3>
              <div className="text-[10px] text-purple-400 font-medium">
                Active context: {activeProject.title} ({activeProject.tasks.length} tasks)
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsAiAssistantOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-slate-400 text-[10px] uppercase font-bold shrink-0">Quick Ask:</span>
          <button
            onClick={() => setInputText('Audit our retroplanning buffer safety and list any at-risk tasks.')}
            className="px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-purple-300 shrink-0 transition-colors"
          >
            Audit Buffer Safety
          </button>
          <button
            onClick={() => setInputText('Suggest missing UX research & design token deliverables for our timeline.')}
            className="px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-blue-300 shrink-0 transition-colors"
          >
            Suggest Missing Deliverables
          </button>
          <button
            onClick={() => setInputText('Generate a backwards schedule from target launch on Nov 20, 2026.')}
            className="px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-emerald-300 shrink-0 transition-colors"
          >
            Generate Backwards Schedule
          </button>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-purple-600/20 border border-purple-500/40 text-purple-400'
                }`}
              >
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl p-3.5 space-y-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-850 border border-slate-750 text-slate-200'
                }`}
              >
                <div className="whitespace-pre-line">{msg.content}</div>

                <div
                  className={`text-[9px] text-right font-mono ${
                    msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0 animate-pulse">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-slate-850 border border-slate-750 rounded-2xl p-3 text-xs text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                <span>Gemini is analyzing project retroplan & dependencies...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
          <input
            type="text"
            placeholder="Ask Gemini to crunch tasks, analyze backwards buffers, or suggest schedules..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
};
