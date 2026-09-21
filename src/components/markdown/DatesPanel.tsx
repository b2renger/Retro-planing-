/**
 * "Dates found" — the visible half of tier 0 (`docs/dev/LOCAL-INFERENCE.md`).
 *
 * It reads the dates out of the saved document, shows the sentence each one came from, and
 * offers the two actions that follow from them. Nothing is applied on its own: every action is a
 * button the user presses, and every one of them is undoable. The panel says in as many words
 * that this is pattern matching and not AI, because it is, and because that distinction is the
 * one this whole app has been drawing.
 */
import React from 'react';
import { AlertTriangle, CalendarClock, Check, ChevronDown, Flag, Target } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { MarkdownDoc, Project } from '../../types';
import { findDates, suggestFromDocument, type DetectedDate, type Suggestion } from '../../services/insight';
import { formatDetected, confidenceLabel } from './datesPanelCopy';

/** Re-analysis is debounced even though it runs off saved content: imports save several docs at once. */
const DEBOUNCE_MS = 400;

interface DatesPanelProps {
  doc: MarkdownDoc | null;
  project: Project;
}

export const DatesPanel: React.FC<DatesPanelProps> = ({ doc, project }) => {
  const { addMilestone, updateTargetDeliveryDate, addNotification, pushUndoSnapshot } = useApp();
  const [open, setOpen] = React.useState(true);
  const [dates, setDates] = React.useState<DetectedDate[]>([]);
  const [analysing, setAnalysing] = React.useState(false);
  const [accepted, setAccepted] = React.useState<string[]>([]);
  // One "now" for the life of the panel, so a re-render cannot move the goalposts mid-list.
  const today = React.useMemo(() => new Date(), []);

  const content = doc?.content ?? '';
  React.useEffect(() => {
    if (!content.trim()) {
      setDates([]);
      return;
    }
    setAnalysing(true);
    const timer = window.setTimeout(() => {
      setDates(findDates(content, { referenceDate: today }));
      setAnalysing(false);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [content, today]);

  React.useEffect(() => setAccepted([]), [doc?.id]);

  const suggestions = React.useMemo(
    () => (doc ? suggestFromDocument(doc, project, { today, dates }) : []),
    [doc, project, today, dates]
  );

  const accept = (s: Suggestion) => {
    if (s.apply.action === 'create-milestone') {
      pushUndoSnapshot('Create milestone from a date in a document');
      addMilestone({
        title: s.apply.title,
        targetDate: s.apply.targetDate,
        isHardDeadline: s.apply.isHardDeadline,
        completed: false,
        description: s.apply.description,
        deliverableCount: 0,
      });
      addNotification({
        title: 'Milestone created from your notes',
        message: `“${s.apply.title}” on ${s.apply.targetDate}, from ${doc?.title ?? 'a document'}. Undo is on the Rétroplanning tab.`,
        type: 'ai_insight',
        projectId: project.id,
      });
    } else if (s.apply.action === 'set-delivery-date') {
      pushUndoSnapshot('Set target delivery date from a document');
      updateTargetDeliveryDate(s.apply.date, s.apply.mode);
      addNotification({
        title: 'Target delivery date changed',
        message: `Now ${s.apply.date}, from ${doc?.title ?? 'a document'}. The schedule was not shifted. Undo is on the Rétroplanning tab.`,
        type: 'status_update',
        projectId: project.id,
      });
    }
    setAccepted((prev) => [...prev, s.id]);
  };

  const byOffset = new Map<number, Suggestion[]>();
  for (const s of suggestions) {
    const list = byOffset.get(s.evidence.offset) ?? [];
    list.push(s);
    byOffset.set(s.evidence.offset, list);
  }

  return (
    <section className="bg-card border border-line rounded-2xl shadow-sm dark:shadow-none">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="dates-panel-body"
          className="w-full flex items-center justify-between gap-2 p-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl"
        >
          <span className="flex items-center gap-2 min-w-0">
            <CalendarClock className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-fg uppercase tracking-wider truncate">Dates found</span>
            {dates.length > 0 && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-elevated border border-line text-[10px] font-semibold text-fg-muted">
                {dates.length}
              </span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h3>

      {open && (
        <div id="dates-panel-body" className="px-3.5 pb-3.5 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-[11px] text-fg-muted leading-relaxed">
            Pattern matching on this document's own text — the dates in it, and the words next to them. No AI, no
            model, nothing sent anywhere. Suggestions are only ever applied when you press a button.
          </p>

          {analysing && <p className="text-xs text-fg-subtle">Reading the document…</p>}

          {!analysing && dates.length === 0 && (
            <p className="text-xs text-fg-muted">No dates were found in this document.</p>
          )}

          <ul className="space-y-2">
            {dates.map((d) => (
              <DateRow
                key={`${d.iso}-${d.offset}`}
                date={d}
                suggestions={(byOffset.get(d.offset) ?? []).filter((s) => !accepted.includes(s.id))}
                onAccept={accept}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

/** One found date: what it is, where it came from, and what could be done about it. */
const DateRow: React.FC<{
  date: DetectedDate;
  suggestions: Suggestion[];
  onAccept: (s: Suggestion) => void;
}> = ({ date, suggestions, onAccept }) => (
  <li className="rounded-xl border border-line bg-elevated/70 p-2.5 space-y-2">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold text-fg">{formatDetected(date)}</span>
      <span className="text-[10px] text-fg-muted shrink-0">{confidenceLabel(date)}</span>
    </div>

    <p className="text-[11px] text-fg-muted leading-relaxed">
      <MarkedSentence sentence={date.sentence} match={date.text} />
    </p>

    {date.otherSentences?.map((s) => (
      <p key={s} className="text-[10px] text-fg-subtle leading-relaxed">
        Also written as: {s}
      </p>
    ))}

    {suggestions.map((s) =>
      s.kind === 'warning' ? (
        <div
          key={s.id}
          role="note"
          className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px text-amber-600 dark:text-amber-400" />
          <div className="space-y-0.5 min-w-0">
            <p className="text-[11px] font-semibold text-fg">{s.title}</p>
            <p className="text-[10px] text-fg-muted leading-relaxed">{s.detail}</p>
          </div>
        </div>
      ) : (
        <div key={s.id} className="p-2 rounded-lg bg-card border border-line space-y-1.5">
          <p className="text-[11px] font-semibold text-fg">{s.title}</p>
          <p className="text-[10px] text-fg-muted leading-relaxed">{s.detail}</p>
          <button
            type="button"
            onClick={() => onAccept(s)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {s.kind === 'create-milestone' ? <Flag className="w-3 h-3" /> : <Target className="w-3 h-3" />}
            <span>{s.kind === 'create-milestone' ? 'Create milestone' : 'Set as delivery date'}</span>
            <Check className="w-3 h-3 opacity-70" />
          </button>
        </div>
      )
    )}
  </li>
);

/** The evidence sentence with the matched words marked, so the reason is visible at a glance. */
const MarkedSentence: React.FC<{ sentence: string; match: string }> = ({ sentence, match }) => {
  const at = sentence.indexOf(match);
  if (at < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, at)}
      <mark className="bg-amber-500/25 text-fg rounded px-0.5">{match}</mark>
      {sentence.slice(at + match.length)}
    </>
  );
};

export default DatesPanel;
