import React from 'react';
import { ExternalLink, Server } from 'lucide-react';
import { DESKTOP_DOWNLOAD_URL } from '../../capabilities';
import { LINK_CLASS } from './controls';

/**
 * Shown instead of the LlmOnLan form when `canUseLanFarms` is false — i.e. this page is served over
 * https, so the browser blocks any call to a plain-http address on the local network before it
 * leaves the machine. Nothing here is an apology: the feature exists, it just needs the other build.
 */
export const LanFarmNotice: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div className="rounded-xl border border-line bg-elevated p-3 space-y-2">
    <h4 className="flex items-center gap-1.5 text-xs font-bold text-fg">
      <Server className="w-3.5 h-3.5 shrink-0 text-fg-muted" />
      <span>LlmOnLan farms need the desktop app</span>
    </h4>
    <p className="text-[11px] text-fg-muted leading-relaxed">
      This page is served over https, and a secure page may not call a plain-http address such as{' '}
      <span className="font-mono text-fg">http://192.168.1.20:4000</span>. The browser blocks the request before it reaches your network, so
      a farm configured here could never answer.
      {compact ? '' : ' Every other provider works normally in the browser.'}
    </p>
    <a href={DESKTOP_DOWNLOAD_URL} target="_blank" rel="noreferrer" className={`${LINK_CLASS} inline-flex items-center gap-1 text-[11px] font-semibold`}>
      <span>Get the desktop app</span>
      <ExternalLink className="w-3 h-3" />
    </a>
  </div>
);
