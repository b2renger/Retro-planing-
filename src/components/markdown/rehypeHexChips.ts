/**
 * Turns `#3B82F6` inside prose into a node the renderer can draw as a colour swatch.
 *
 * This is the one feature the old hand-rolled preview had that no markdown library provides, and it
 * is genuinely useful in a design tool: a spec that names a token should show the colour. It runs as
 * a rehype step so the parser stays in charge of the document structure — the plugin only splits
 * *text* nodes and never invents markup from document text.
 *
 * Code is left alone: a hex inside a fence or inline code is source, not a swatch.
 */
import type { Element, ElementContent, Root, RootContent, Text } from 'hast';

/** `#rgb` or `#rrggbb`, not followed by another hex digit (so `#aabbccdd` is left as text). */
const HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

/** Elements whose text is source or metadata rather than prose. */
const SKIP = new Set(['code', 'pre', 'style', 'script', 'title']);

/** hast property carrying the matched colour; reaches the component as `data-hex-chip`. */
export const HEX_CHIP_PROPERTY = 'dataHexChip';

type Parent = Root | Element;

/**
 * rehype plugin. Unified calls the returned transformer with the tree.
 *
 * Deliberately walks the tree by hand instead of pulling in `unist-util-visit`: it is a dozen lines,
 * and it keeps the direct dependency list at react-markdown + remark-gfm.
 */
export function rehypeHexChips() {
  return (tree: Root): void => {
    walk(tree);
  };
}

function walk(parent: Parent): void {
  let changed = false;
  const next: ElementContent[] = [];

  for (const child of parent.children as ElementContent[]) {
    if (child.type === 'text') {
      const split = splitHexText(child);
      if (split) {
        changed = true;
        next.push(...split);
        continue;
      }
    } else if (child.type === 'element' && !SKIP.has(child.tagName)) {
      walk(child);
    }
    next.push(child);
  }

  if (changed) parent.children = next as RootContent[] & ElementContent[];
}

/** Splits one text node around its hex matches, or returns `null` when it holds none. */
function splitHexText(node: Text): ElementContent[] | null {
  const value = node.value;
  HEX.lastIndex = 0;
  if (!HEX.test(value)) return null;

  HEX.lastIndex = 0;
  const parts: ElementContent[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = HEX.exec(value)) !== null) {
    if (match.index > cursor) parts.push({ type: 'text', value: value.slice(cursor, match.index) });
    parts.push(chip(match[0]));
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) parts.push({ type: 'text', value: value.slice(cursor) });

  return parts;
}

function chip(hex: string): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: { [HEX_CHIP_PROPERTY]: hex },
    children: [{ type: 'text', value: hex }],
  };
}
