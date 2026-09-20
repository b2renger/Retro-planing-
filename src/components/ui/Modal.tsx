import React from 'react';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

export interface ModalProps {
  /** When false nothing is rendered. */
  open: boolean;
  /** Called on Escape, backdrop click and the header/footer close buttons. */
  onClose: () => void;
  /** Accessible name of the dialog; also rendered in the header unless `header` is given. */
  title: React.ReactNode;
  /** Optional icon rendered before the title. */
  icon?: React.ReactNode;
  /** Optional secondary line under the title. */
  subtitle?: React.ReactNode;
  /**
   * Replaces the whole default header (title/subtitle/close) when you need custom chrome.
   * With a custom header the dialog is named by `aria-label` (from `title`) instead of
   * `aria-labelledby`, so the custom markup does not have to carry a generated id.
   */
  header?: React.ReactNode;
  /** Optional sticky footer row. */
  footer?: React.ReactNode;
  size?: ModalSize;
  /** Replaces the body classes entirely. Default: `overflow-y-auto px-5 py-4`. */
  bodyClassName?: string;
  /** Extra classes on the dialog card. */
  className?: string;
  /** Set false for dialogs that must not close on an accidental backdrop click. */
  closeOnBackdrop?: boolean;
  /** Focused when the dialog opens; defaults to the first focusable element. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children?: React.ReactNode;
}

/**
 * The single modal shell for the app: themed chrome (`bg-card` / `border-line`) plus the
 * accessibility baseline — `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape to close,
 * backdrop click to close, focus moved into the dialog on open, Tab trapped inside it, and focus
 * restored to the trigger on close.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  icon,
  subtitle,
  header,
  footer,
  size = 'lg',
  bodyClassName = 'overflow-y-auto px-5 py-4',
  className = '',
  closeOnBackdrop = true,
  initialFocusRef,
  children,
}) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  // Move focus in on open, restore it on close.
  React.useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ?? cardRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? cardRef.current;
      target?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      const previous = restoreRef.current;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    };
  }, [open, initialFocusRef]);

  // Escape to close + Tab trapped inside the card.
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const nodes = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        cardRef.current.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!e.shiftKey && (active === last || !cardRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || !cardRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={header ? undefined : titleId}
        aria-label={header ? (typeof title === 'string' ? title : undefined) : undefined}
        tabIndex={-1}
        className={`w-full ${SIZES[size]} max-h-[85vh] flex flex-col bg-card text-fg border border-line rounded-2xl shadow-2xl outline-none ${className}`}
      >
        {header ?? (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {icon}
              <div className="min-w-0">
                <h2 id={titleId} className="text-sm font-semibold truncate">
                  {title}
                </h2>
                {subtitle && <p className="text-xs text-fg-muted truncate">{subtitle}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-elevated transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>

        {footer && <div className="px-5 py-3 border-t border-line shrink-0">{footer}</div>}
      </div>
    </div>
  );
};
