/**
 * Lets another screen deep-link into one settings tab. `SettingsModal` owns the tab state; this
 * is the only way to ask it to switch, and it is a no-op outside a browser.
 */
export type SettingsTabId = 'ai' | 'cloud' | 'data' | 'about';

const TAB_EVENT = 'rps:settings-tab';

/** Ask the (already mounted) settings dialog to show `tab`. Call alongside `setIsSettingsOpen(true)`. */
export function requestSettingsTab(tab: SettingsTabId): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SettingsTabId>(TAB_EVENT, { detail: tab }));
}

/** Subscribes to tab requests. Returns the unsubscribe function. */
export function onSettingsTabRequest(handler: (tab: SettingsTabId) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => handler((event as CustomEvent<SettingsTabId>).detail);
  window.addEventListener(TAB_EVENT, listener);
  return () => window.removeEventListener(TAB_EVENT, listener);
}
