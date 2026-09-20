import React from 'react';

/**
 * Shared class strings and the one labelled-field wrapper used by every settings panel.
 * Tokens only (see docs/dev/THEME.md); every interactive class carries a visible focus ring.
 */

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

export const INPUT_CLASS = `w-full px-3 py-2 rounded-lg bg-input border border-line text-xs text-fg placeholder-fg-subtle transition-colors hover:border-line-strong ${FOCUS}`;

const BTN_BASE = `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS}`;

export const BTN_PRIMARY = `${BTN_BASE} bg-blue-600 hover:bg-blue-500 text-white`;
export const BTN_SECONDARY = `${BTN_BASE} bg-elevated hover:bg-line border border-line text-fg`;
export const BTN_DANGER = `${BTN_BASE} bg-rose-600 hover:bg-rose-500 text-white`;
export const BTN_GHOST = `${BTN_BASE} text-fg-muted hover:text-fg hover:bg-elevated`;

export const LINK_CLASS = `underline underline-offset-2 text-blue-700 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 rounded-sm ${FOCUS}`;

export interface FieldProps {
  label: string;
  /** Rendered after the label, e.g. "optional" or "required". */
  suffix?: React.ReactNode;
  /** Explanatory line under the control. */
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}

/** Label + control + hint, wired with `htmlFor` so clicking the label focuses the control. */
export const Field: React.FC<FieldProps> = ({ label, suffix, hint, htmlFor, children }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline gap-2">
      <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
        {label}
      </label>
      {suffix && <span className="text-[10px] text-fg-subtle">{suffix}</span>}
    </div>
    {children}
    {hint && <p className="text-[11px] text-fg-muted leading-relaxed">{hint}</p>}
  </div>
);

/** Section heading inside a settings panel. */
export const PanelHeading: React.FC<{ title: string; description?: React.ReactNode }> = ({ title, description }) => (
  <div className="space-y-1">
    <h3 className="text-sm font-bold text-fg">{title}</h3>
    {description && <p className="text-xs text-fg-muted leading-relaxed">{description}</p>}
  </div>
);
