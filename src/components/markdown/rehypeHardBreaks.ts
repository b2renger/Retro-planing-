/**
 * Renders a single newline as a line break, GitHub-comment style.
 *
 * Markdown proper folds a single newline into a space, which is right for a `.md` document and
 * wrong for a chat bubble: the assistant's local fallback reply is three sentences separated by one
 * newline each, and before this renderer existed the bubble showed them on three lines. The
 * Markdown Studio preview does *not* use this — a document should follow the markdown it declares.
 *
 * Only text inside a paragraph, a heading or a table cell is touched. Everywhere else a newline in
 * the tree is layout whitespace that `mdast-util-to-hast` inserted between blocks, and code keeps
 * its own newlines.
 */
import type { Element, ElementContent, Root } from 'hast';

/** Containers whose text is phrasing content, where a newline really is a soft break. */
const PHRASING_PARENTS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th']);

/** Never touched: their newlines are significant. */
const SKIP = new Set(['pre', 'code', 'style', 'script']);

export function rehypeHardBreaks() {
  return (tree: Root): void => {
    find(tree);
  };
}

/** Descends until a phrasing container is found, then breaks up everything inside it. */
function find(parent: Root | Element): void {
  for (const child of parent.children) {
    if (child.type !== 'element' || SKIP.has(child.tagName)) continue;
    if (PHRASING_PARENTS.has(child.tagName)) breakUp(child);
    else find(child);
  }
}

function breakUp(element: Element): void {
  let changed = false;
  const next: ElementContent[] = [];

  for (const child of element.children) {
    if (child.type === 'text' && child.value.includes('\n')) {
      changed = true;
      const pieces = child.value.split('\n');
      pieces.forEach((piece, index) => {
        if (index > 0) next.push({ type: 'element', tagName: 'br', properties: {}, children: [] });
        if (piece !== '') next.push({ type: 'text', value: piece });
      });
      continue;
    }
    if (child.type === 'element' && !SKIP.has(child.tagName)) breakUp(child);
    next.push(child);
  }

  if (changed) element.children = next;
}
