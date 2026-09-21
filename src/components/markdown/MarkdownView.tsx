/**
 * The markdown preview.
 *
 * Renders CommonMark + GitHub tables, task lists and strikethrough by building React elements from
 * the parser's AST. **No HTML string is ever injected into the DOM here, and none ever should be**:
 * documents can arrive from a shared cloud drive, so their content is untrusted input. Every node
 * below is a React element; nothing in this directory writes markup as a string.
 *
 * Raw HTML passthrough is off — react-markdown ignores embedded HTML unless `rehype-raw` is added,
 * which it deliberately is not. `<script>alert(1)</script>` written in a document therefore shows up
 * as those literal characters, escaped by React like any other text.
 *
 * Syntax highlighting is out of scope (highlighters are heavy); a fenced block gets the `bg-code`
 * surface, a horizontal scroll and the language name as a caption.
 */
import React, { useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import type { Element } from 'hast';
import remarkGfm from 'remark-gfm';
import { rehypeHardBreaks } from './rehypeHardBreaks';
import { HEX_CHIP_PROPERTY, rehypeHexChips } from './rehypeHexChips';
import { isHttpUrl, isSafeLinkUrl, safeUrlTransform } from './urlSafety';

export interface MarkdownViewProps {
  /** The raw markdown. */
  content: string;
  /** Extra classes for the wrapper, typically sizing. */
  className?: string;
  /**
   * Render a single newline as a line break (chat convention) instead of folding it into a space
   * (markdown convention). On for the assistant's replies, off for documents.
   */
  breaks?: boolean;
}

/** Concatenates every text descendant of a hast node — used to keep fenced code verbatim. */
function nodeText(node: Element | undefined): string {
  if (!node) return '';
  let out = '';
  for (const child of node.children) {
    if (child.type === 'text') out += child.value;
    else if (child.type === 'element') out += nodeText(child);
  }
  return out;
}

/** Reads `language-x` off the `<code>` inside a `<pre>`. */
function fenceLanguage(code: Element | undefined): string {
  const names = code?.properties?.className;
  if (!Array.isArray(names)) return '';
  const hit = names.map(String).find((name) => name.startsWith('language-'));
  return hit ? hit.slice('language-'.length) : '';
}

function firstElement(node: Element | undefined, tagName: string): Element | undefined {
  const hit = node?.children.find((child) => child.type === 'element' && child.tagName === tagName);
  return hit && hit.type === 'element' ? hit : undefined;
}

/**
 * A remote image is a tracking pixel waiting to happen: opening a shared document would tell its
 * author when and from where it was read. Nothing is fetched until the reader asks for it.
 */
const RemoteImage: React.FC<{ src: string; alt: string; title?: string }> = ({ src, alt, title }) => {
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    return (
      <button
        type="button"
        onClick={() => setLoaded(true)}
        title={src}
        className="my-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-dashed border-line-strong bg-elevated px-3 py-2 text-left text-[11px] text-fg-muted transition-colors hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="font-semibold text-fg">Image</span>
        <span className="truncate">{alt || src}</span>
        <span className="shrink-0 underline underline-offset-2">Load</span>
      </button>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      title={title}
      loading="lazy"
      className="my-2 max-w-full rounded-xl border border-line"
    />
  );
};

/** A `#rrggbb` found in prose, drawn as a swatch next to its own text. */
const HexChip: React.FC<{ hex: string }> = ({ hex }) => (
  <span className="mx-1 inline-flex items-center gap-1 rounded border border-line-strong bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-fg">
    <span
      className="inline-block h-2.5 w-2.5 rounded-full border border-line-strong"
      style={{ backgroundColor: hex }}
    />
    <span>{hex}</span>
  </span>
);

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 border-b border-line pb-1.5 text-lg font-extrabold text-fg sm:text-xl">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 text-base font-bold text-blue-600 dark:text-blue-400">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mt-2 text-sm font-semibold text-fg">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-2 text-xs font-semibold text-fg">{children}</h4>,
  h5: ({ children }) => <h5 className="mt-2 text-xs font-semibold text-fg-muted">{children}</h5>,
  h6: ({ children }) => (
    <h6 className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{children}</h6>
  ),

  p: ({ children }) => <p className="my-2 leading-relaxed text-fg">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-fg">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-fg-muted line-through">{children}</del>,
  hr: () => <hr className="my-4 border-t border-line" />,

  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-line-strong bg-elevated/60 py-1 pl-3 text-fg-muted italic">
      {children}
    </blockquote>
  ),

  // `contains-task-list` / `task-list-item` are remark-gfm's markers for checkbox lists.
  ul: ({ className, children }) =>
    String(className ?? '').includes('contains-task-list') ? (
      <ul className="my-2 space-y-1.5">{children}</ul>
    ) : (
      <ul className="my-2 ml-5 list-disc space-y-1 text-fg marker:text-fg-subtle">{children}</ul>
    ),
  ol: ({ children, start }) => (
    <ol start={start} className="my-2 ml-5 list-decimal space-y-1 text-fg marker:text-fg-subtle">
      {children}
    </ol>
  ),
  li: ({ className, children }) =>
    String(className ?? '').includes('task-list-item') ? (
      <li className="flex list-none items-start gap-2 text-fg">{children}</li>
    ) : (
      <li className="leading-relaxed">{children}</li>
    ),
  // Read-only on purpose: the editor is the source of truth for the document, not the preview.
  input: ({ type, checked }) =>
    type === 'checkbox' ? (
      <input
        type="checkbox"
        checked={Boolean(checked)}
        readOnly
        disabled
        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-line-strong"
      />
    ) : null,

  // The table scrolls inside its own box; the page itself must never scroll sideways.
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-left text-[11px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-elevated">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-line last:border-0">{children}</tr>,
  th: ({ children, style }) => (
    <th style={style} className="whitespace-nowrap px-3 py-2 font-bold text-fg">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-3 py-2 align-top text-fg-muted">
      {children}
    </td>
  ),

  /**
   * Fenced code. The content is taken straight off the AST node rather than from the mapped
   * children, so it stays byte-for-byte what the author wrote, and the inline-vs-block question
   * never arises (react-markdown dropped its `inline` prop in v9).
   */
  pre: ({ node }) => {
    const code = firstElement(node, 'code');
    const language = fenceLanguage(code);
    return (
      <div className="my-3 overflow-hidden rounded-xl border border-line bg-code">
        {language ? (
          <div className="border-b border-line px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
            {language}
          </div>
        ) : null}
        <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-fg">
          <code>{nodeText(code)}</code>
        </pre>
      </div>
    );
  },
  code: ({ children }) => (
    <code className="rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
      {children}
    </code>
  ),

  /**
   * Links. Only http/https/mailto become an anchor — anything else (`javascript:`, `data:`, a
   * relative path) is rendered as its own text, so an unsafe scheme can never reach an `href`.
   */
  a: ({ href, title, children }) => {
    if (!isSafeLinkUrl(href)) return <span className="text-fg underline decoration-line-strong decoration-dotted">{children}</span>;
    return (
      <a
        href={href}
        title={title}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline underline-offset-2 hover:text-blue-500 dark:text-blue-400"
      >
        {children}
      </a>
    );
  },

  /** Images follow the same scheme rule, and remote ones are click-to-load. */
  img: ({ src, alt, title }) => {
    const url = typeof src === 'string' ? src : '';
    if (!isHttpUrl(url)) return <span className="text-fg-muted italic">{alt || url}</span>;
    return <RemoteImage src={url} alt={alt ?? ''} title={title} />;
  },

  /** The only spans in the tree are the ones `rehypeHexChips` makes. */
  span: ({ node, children }) => {
    const hex = node?.properties?.[HEX_CHIP_PROPERTY];
    return typeof hex === 'string' ? <HexChip hex={hex} /> : <span>{children}</span>;
  },
};

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className, breaks }) => (
  <div className={`font-sans text-xs leading-relaxed text-fg sm:text-sm ${className ?? ''}`}>
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={breaks ? [rehypeHexChips, rehypeHardBreaks] : [rehypeHexChips]}
      urlTransform={safeUrlTransform}
      components={components}
    >
      {content}
    </Markdown>
  </div>
);

export default MarkdownView;
