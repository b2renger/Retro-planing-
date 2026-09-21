import React from 'react';

/** Shared control classes and the inline delete confirmation of the hardware / media lists. */
export const ICON_BTN =
  'p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-elevated transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

export const ADD_BTN =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300';

export const ADD_BTN_MEDIA =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300';

/** Deleting is one click plus a confirmation, in place — never a silent removal. */
export const RemoveConfirm: React.FC<{ question: string; onConfirm: () => void; onCancel: () => void }> = ({ question, onConfirm, onCancel }) => (
  <div role="alert" className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px]">
    <span className="text-fg">{question}</span>
    <button type="button" onClick={onConfirm} className="rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white hover:bg-rose-500">
      Remove
    </button>
    <button type="button" onClick={onCancel} className="text-fg-muted hover:text-fg">
      Keep it
    </button>
  </div>
);
