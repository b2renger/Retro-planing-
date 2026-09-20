/** Local SVG avatar (initials on a coloured disc) as a data URI. No network, works under file://. */
export function initialsAvatar(name: string, color = '#3B82F6'): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#3B82F6';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">` +
    `<circle cx="60" cy="60" r="60" fill="${safeColor}"/>` +
    `<text x="60" y="60" dy=".36em" text-anchor="middle" font-family="system-ui, sans-serif" font-size="48" font-weight="600" fill="#ffffff">${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
