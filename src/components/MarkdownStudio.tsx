import React, { useState, useRef } from 'react';
import { useApp, useActiveProject } from '../context/AppContext';
import {
  FileText,
  Sparkles,
  FolderPlus,
  Upload,
  Save,
  Check,
  Code,
  Eye,
  Columns,
  List,
  CheckSquare,
  Hash,
  Table,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { MarkdownDoc } from '../types';
import type { CrunchResult } from '../services/geminiService';
import { crunchMarkdownNotes } from '../services/ai/tasks';

export const MarkdownStudio: React.FC = () => {
  const {
    activeDocument,
    setActiveDocumentId,
    saveDocument,
    createDocument,
    deleteDocument,
    importDroppedFiles,
    applyAiStructuredData,
    addNotification,
    activeAiProvider,
  } = useApp();
  const activeProject = useActiveProject();

  const [editorMode, setEditorMode] = useState<'split' | 'wysiwyg' | 'raw'>('split');
  const [docContent, setDocContent] = useState<string>(activeDocument?.content || '');
  const [docTitle, setDocTitle] = useState<string>(activeDocument?.title || 'Untitled Doc');
  const [isCrunching, setIsCrunching] = useState(false);
  const [crunchResult, setCrunchResult] = useState<CrunchResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when activeDocument changes
  React.useEffect(() => {
    if (activeDocument) {
      setDocContent(activeDocument.content);
      setDocTitle(activeDocument.title);
      setSaveStatus(null);
    }
  }, [activeDocument?.id]);

  const handleSave = () => {
    if (!activeDocument) return;
    saveDocument({
      ...activeDocument,
      title: docTitle,
      content: docContent,
    });
    setSaveStatus('Saved');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleCrunchWithGemini = async () => {
    setIsCrunching(true);
    try {
      const res = await crunchMarkdownNotes(
        { markdownContent: docContent, targetDeliveryDate: activeProject.targetDeliveryDate, projectName: activeProject.title },
        activeAiProvider
      );

      setCrunchResult(res.data);
      addNotification({
        title: res.fallback ? 'Local heuristic structure ready (no AI provider)' : 'AI structure ready',
        message: `Parsed ${res.data.tasks?.length || 0} tasks & ${res.data.phases?.length || 0} phases from markdown notes.`,
        type: 'ai_insight',
        projectId: activeProject.id,
      });
    } catch (err: any) {
      addNotification({
        title: 'AI Structuring Error',
        message: 'Could not complete analysis. Check server logs.',
        type: 'status_update',
        projectId: activeProject.id,
      });
    } finally {
      setIsCrunching(false);
    }
  };

  const handleApplyAiPlan = () => {
    if (!crunchResult) return;
    applyAiStructuredData(crunchResult, { replace: true });
    if (crunchResult.structuredMarkdown) {
      setDocContent(crunchResult.structuredMarkdown);
      if (activeDocument) {
        saveDocument({
          ...activeDocument,
          content: crunchResult.structuredMarkdown,
          autoStructured: true,
        });
      }
    }
    setCrunchResult(null);
  };

  // Drag and drop handlers for unstructured files & folders
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const readFiles: { name: string; content: string }[] = [];
    for (const file of files) {
      const text = await file.text();
      readFiles.push({ name: file.name, content: text });
    }

    importDroppedFiles(readFiles);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    const readFiles: { name: string; content: string }[] = [];
    for (const file of files) {
      const text = await file.text();
      readFiles.push({ name: file.name, content: text });
    }

    importDroppedFiles(readFiles);
  };

  // Helper to insert markdown snippets
  const insertSnippet = (snippet: string) => {
    setDocContent((prev) => prev + '\n' + snippet);
  };

  // Render markdown with custom color swatch token parser
  const renderFormattedMarkdown = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 font-sans text-fg text-xs sm:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          // Check for H1
          if (line.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-lg sm:text-xl font-extrabold text-fg border-b border-line pb-1.5 mt-4">
                {line.replace('# ', '')}
              </h1>
            );
          }
          // Check for H2
          if (line.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-base font-bold text-fg mt-3 text-blue-600 dark:text-blue-400">
                {line.replace('## ', '')}
              </h2>
            );
          }
          // Check for H3
          if (line.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-sm font-semibold text-fg mt-2">
                {line.replace('### ', '')}
              </h3>
            );
          }
          // Check for task checklist
          if (line.startsWith('- [x]') || line.startsWith('- [ ]')) {
            const isChecked = line.startsWith('- [x]');
            const text = line.replace(/- \[[ x]\]\s*/, '');
            return (
              <div key={idx} className="flex items-center gap-2 pl-2">
                <input
                  type="checkbox"
                  checked={isChecked}
                  readOnly
                  className="rounded border-line-strong text-blue-500 focus:ring-0 w-3.5 h-3.5"
                />
                <span className={isChecked ? 'line-through text-fg-muted' : 'text-fg font-medium'}>
                  {text}
                </span>
              </div>
            );
          }
          // Check for bullet list
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <li key={idx} className="ml-4 list-disc text-fg">
                {renderInlineTokens(line.replace(/^[-*]\s*/, ''))}
              </li>
            );
          }
          // Standard line
          if (line.trim() === '') {
            return <div key={idx} className="h-2" />;
          }
          return <p key={idx}>{renderInlineTokens(line)}</p>;
        })}
      </div>
    );
  };

  // Helper to render color hex tags (#3B82F6) with live color swatches inline
  const renderInlineTokens = (text: string) => {
    const parts = text.split(/(#[0-9A-Fa-f]{6}|`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#') && part.length === 7 && /^#[0-9A-Fa-f]{6}$/.test(part)) {
        return (
          <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-elevated border border-line-strong font-mono text-[10px] mx-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block border border-line-strong" style={{ backgroundColor: part }} />
            <span>{part}</span>
          </span>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-elevated text-indigo-700 dark:text-indigo-300 font-mono text-[11px]">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-fg">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-hidden">
      {/* Studio Banner with Drop Support */}
      <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base sm:text-lg font-bold text-fg">
                Design Markdown Studio & Unstructured Notes Cruncher
              </h2>
            </div>
            <p className="text-xs text-fg-muted max-w-2xl leading-relaxed">
              Drop any raw design briefs, meeting memos, or markdown files in any structure. Gemini AI will parse
              deliverables, reverse-engineer milestones, and calculate retroplanning buffers automatically.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-elevated hover:bg-line border border-line text-fg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Upload Notes / Briefs</span>
            </button>

            {/* Specialist Crunch Button */}
            <button
              id="gemini-crunch-markdown-btn"
              onClick={handleCrunchWithGemini}
              disabled={isCrunching}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/25 transition-all cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${isCrunching ? 'animate-spin' : ''}`} />
              <span>{isCrunching ? 'Gemini Crunching Notes...' : '✨ Crunch with Gemini AI'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Crunch Preview Drawer if result exists */}
      {crunchResult && (
        <div className="bg-purple-50 dark:bg-purple-950/30 border-2 border-purple-300 dark:border-purple-600/60 rounded-2xl p-5 space-y-4 shadow-md dark:shadow-2xl animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-bold text-sm text-fg">
                Gemini Auto-Structure Blueprint ({crunchResult.tasks?.length || 0} Tasks Extracted)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyAiPlan}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Structure to Project & Retroplan</span>
              </button>
              <button
                onClick={() => setCrunchResult(null)}
                className="px-3 py-2 rounded-xl bg-elevated text-fg-muted hover:text-fg text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>

          <p className="text-xs text-fg leading-relaxed">{crunchResult.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-card/90 p-3 rounded-xl border border-line">
              <div className="font-semibold text-fg-muted uppercase text-[10px]">Phases Extracted</div>
              <div className="font-bold text-blue-600 dark:text-blue-400 text-sm mt-1">{crunchResult.phases?.length || 0} Phases</div>
            </div>
            <div className="bg-card/90 p-3 rounded-xl border border-line">
              <div className="font-semibold text-fg-muted uppercase text-[10px]">Milestones Reverse Planned</div>
              <div className="font-bold text-amber-600 dark:text-amber-400 text-sm mt-1">{crunchResult.milestones?.length || 0} Milestones</div>
            </div>
            <div className="bg-card/90 p-3 rounded-xl border border-line">
              <div className="font-semibold text-fg-muted uppercase text-[10px]">Retroplan Buffer Health</div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-1">{crunchResult.retroplanningScore}% Safe</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Studio Grid: Left Document Browser, Center Editor / Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Pane (3 cols): Document Explorer & Drop Zone */}
        <div className="lg:col-span-3 space-y-4">
          {/* File Tree Container */}
          <div className="bg-card border border-line rounded-2xl p-3.5 space-y-3 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="text-xs font-bold text-fg uppercase tracking-wider">Project Files</span>
              <button
                onClick={() =>
                  createDocument({
                    title: 'New Design Spec',
                    path: `specs/spec_${Date.now()}.md`,
                    content: '# New Design Specification\n\n- [ ] Task deliverable 1\n- [ ] Task deliverable 2\n',
                    tags: ['Draft'],
                  })
                }
                className="p-1 rounded bg-elevated hover:bg-line text-blue-600 dark:text-blue-400"
                title="Create New Document"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Document List */}
            <div className="space-y-1">
              {activeProject.documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setActiveDocumentId(doc.id)}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors group ${
                    doc.id === activeDocument?.id
                      ? 'bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-fg hover:bg-elevated'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 shrink-0 text-fg-muted" />
                    <span className="truncate">{doc.title}</span>
                  </div>
                  {activeProject.documents.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDocument(doc.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-fg-muted hover:text-rose-500 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-line-strong hover:border-line-strong bg-elevated/70'
            }`}
          >
            <FolderPlus className="w-8 h-8 text-fg-subtle mx-auto mb-2" />
            <div className="text-xs font-bold text-fg">Drop Notes or Folders Here</div>
            <p className="text-[11px] text-fg-muted mt-1">
              .md, .txt, or JSON briefs. No structure required!
            </p>
          </div>

          {/* Quick Insert Snippet Library */}
          <div className="bg-card border border-line rounded-2xl p-3.5 space-y-2 shadow-sm dark:shadow-none">
            <span className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">
              Quick Insert Templates
            </span>
            <div className="space-y-1">
              <button
                onClick={() =>
                  insertSnippet(
                    '## Design Deliverables\n- [ ] Figma Component Variants\n- [ ] Color Tokens export `#3B82F6`\n- [ ] Dark Mode parity check'
                  )
                }
                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-elevated hover:bg-line text-[11px] text-fg transition-colors"
              >
                + Deliverables Checklist
              </button>
              <button
                onClick={() =>
                  insertSnippet(
                    '```json\n{\n  "phase": "Design System",\n  "tokens": {\n    "primary": "#3B82F6",\n    "accent": "#8B5CF6"\n  }\n}\n```'
                  )
                }
                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-elevated hover:bg-line text-[11px] text-fg transition-colors"
              >
                + Token Config JSON Block
              </button>
              <button
                onClick={() =>
                  insertSnippet(
                    '| Phase | Milestone | Due Date | SLA |\n| :--- | :--- | :--- | :--- |\n| UX IA | Flow Signoff | 2026-10-15 | 48 hrs |'
                  )
                }
                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-elevated hover:bg-line text-[11px] text-fg transition-colors"
              >
                + SLA Milestone Table
              </button>
            </div>
          </div>
        </div>

        {/* Center/Right Pane (9 cols): Editor & Live Preview */}
        <div className="lg:col-span-9 space-y-3">
          <div className="bg-card border border-line rounded-2xl p-4 space-y-4 shadow-sm dark:shadow-xl transition-colors">
            {/* Editor Header: Title, Mode Switcher & Save Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="bg-transparent text-base font-bold text-fg focus:outline-none focus:border-b border-blue-500 pb-0.5 flex-1 min-w-[200px]"
              />

              <div className="flex items-center gap-2 shrink-0">
                {/* View Mode Toggle */}
                <div className="flex items-center bg-elevated border border-line rounded-xl p-1 text-xs">
                  <button
                    onClick={() => setEditorMode('split')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
                      editorMode === 'split' ? 'bg-blue-600 text-white' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    <Columns className="w-3 h-3" />
                    <span>Split</span>
                  </button>
                  <button
                    onClick={() => setEditorMode('wysiwyg')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
                      editorMode === 'wysiwyg' ? 'bg-blue-600 text-white' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Visual WYSIWYG</span>
                  </button>
                  <button
                    onClick={() => setEditorMode('raw')}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
                      editorMode === 'raw' ? 'bg-blue-600 text-white' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    <Code className="w-3 h-3" />
                    <span>Raw MD</span>
                  </button>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saveStatus || 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Editor Workspace */}
            <div className="min-h-[480px]">
              {editorMode === 'split' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Raw Code Input */}
                  <textarea
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    placeholder="Write markdown here or drop files..."
                    className="w-full h-[480px] p-3 rounded-xl bg-app border border-line font-mono text-xs text-fg focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                  />

                  {/* Right: Live Visual Preview */}
                  <div className="w-full h-[480px] p-4 rounded-xl bg-app/60 border border-line overflow-y-auto">
                    {renderFormattedMarkdown(docContent)}
                  </div>
                </div>
              )}

              {editorMode === 'raw' && (
                <textarea
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  className="w-full h-[480px] p-4 rounded-xl bg-app border border-line font-mono text-xs text-fg focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                />
              )}

              {editorMode === 'wysiwyg' && (
                <div className="w-full min-h-[480px] p-5 rounded-xl bg-app/80 border border-line overflow-y-auto">
                  {renderFormattedMarkdown(docContent)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
