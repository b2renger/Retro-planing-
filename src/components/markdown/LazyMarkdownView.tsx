/**
 * Loads the markdown renderer on demand.
 *
 * The parser (react-markdown + remark-gfm + micromark) is ~48 kB gzip — measured, not guessed:
 * imported statically it took the main chunk from 197 kB to 245 kB gzip. It is only needed by the
 * Markdown Studio preview and the assistant's replies, so it is split out the same way the export
 * menu loads its writers. Both call sites go through this wrapper so they share one chunk.
 */
import React, { Suspense, lazy } from 'react';
import type { MarkdownViewProps } from './MarkdownView';

const MarkdownView = lazy(() => import('./MarkdownView'));

export const LazyMarkdownView: React.FC<MarkdownViewProps> = ({ content, className, breaks }) => (
  <Suspense fallback={<div className="p-1 text-xs text-fg-subtle">Rendering preview…</div>}>
    <MarkdownView content={content} className={className} breaks={breaks} />
  </Suspense>
);

export default LazyMarkdownView;
