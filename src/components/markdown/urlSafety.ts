/**
 * URL scheme rules for the markdown preview.
 *
 * Documents can arrive from a shared cloud drive, so their contents are untrusted. A markdown link
 * or image target is attacker-controlled text; `javascript:`, `data:` and `vbscript:` URLs must
 * never reach an `href`/`src`. Everything here is a *scheme allowlist* — anything not explicitly
 * allowed is refused, and the caller renders plain text instead.
 */

/** Schemes that may become a real `href`. */
const LINK_SCHEMES = new Set(['http', 'https', 'mailto']);

/**
 * Reads the scheme of a URL the way a browser would.
 *
 * HTML parsers drop tabs, newlines and other C0 control characters from *inside* an attribute value
 * before resolving it, so `java<TAB>script:alert(1)` and ` javascript:alert(1)` both execute. Those
 * characters are removed everywhere in the string (not merely trimmed from the front) before the
 * scheme is read.
 *
 * @returns the lowercased scheme, or `''` when the URL carries none (relative URLs, `#anchor`).
 */
export function urlScheme(url: string | null | undefined): string {
  if (typeof url !== 'string' || url === '') return '';
  const stripped = url.replace(/[\u0000-\u0020]/g, '');
  const match = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(stripped);
  return match ? match[1].toLowerCase() : '';
}

/**
 * True when the URL may be rendered as an anchor.
 *
 * Schemeless URLs are refused too: the preview has no base URL to resolve them against and no
 * in-document anchor targets, so a relative link could only ever be dead or surprising.
 */
export function isSafeLinkUrl(url: string | null | undefined): boolean {
  return LINK_SCHEMES.has(urlScheme(url));
}

/** True when the URL is an `http(s)` resource — i.e. a *remote* image in the desktop build. */
export function isHttpUrl(url: string | null | undefined): boolean {
  const scheme = urlScheme(url);
  return scheme === 'http' || scheme === 'https';
}

/**
 * `urlTransform` for react-markdown: blanks every URL this module refuses.
 *
 * react-markdown ships its own sanitizer; replacing it keeps one allowlist for the whole renderer.
 * The components check the scheme again before rendering an `href`/`src`, so a mistake here alone
 * cannot produce a dangerous attribute.
 */
export function safeUrlTransform(url: string): string {
  return isSafeLinkUrl(url) ? url : '';
}
