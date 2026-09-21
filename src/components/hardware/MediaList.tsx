import React from 'react';
import { Film, Music, Pencil, Plus, Trash2 } from 'lucide-react';
import type { MediaAssetItem } from '../../types';
import { ADD_BTN_MEDIA, ICON_BTN, RemoveConfirm } from './listChrome';
import { MEDIA_STATUS_LABELS } from './manifest';

const STATUS_TONE: Record<MediaAssetItem['status'], string> = {
  planning: 'bg-slate-500/10 text-fg-muted border-slate-500/20',
  'in-production': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  rendered: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
};

export interface MediaListProps {
  assets: readonly MediaAssetItem[];
  /** Counted status line, e.g. `2 planning · 1 approved`. Empty when the roster is empty. */
  statusLine: string;
  confirmRemoveId: string | null;
  onAskRemove: (id: string | null) => void;
  onRemove: (id: string) => void;
  onEdit: (asset: MediaAssetItem) => void;
  onAdd: () => void;
}

/** The media roster: one card per asset, with add / edit / remove. */
export const MediaList: React.FC<MediaListProps> = ({ assets, statusLine, confirmRemoveId, onAskRemove, onRemove, onEdit, onAdd }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-[11px] text-fg-muted">{statusLine || 'Nothing in the roster yet.'}</p>
      <button type="button" onClick={onAdd} className={ADD_BTN_MEDIA}>
        <Plus className="w-3.5 h-3.5" />
        <span>Add media asset</span>
      </button>
    </div>

    {assets.length === 0 ? (
      <p className="p-6 text-center text-xs text-fg-muted bg-card border border-line rounded-xl">No media asset listed yet. Add the first one.</p>
    ) : (
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {assets.map((asset) => (
          <li key={asset.id} className="bg-card border border-line rounded-xl p-4 space-y-3 shadow-sm dark:shadow-none">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-elevated border border-line flex items-center justify-center shrink-0 mt-0.5">
                  {asset.type === 'video' ? (
                    <Film className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Music className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  )}
                </span>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-fg truncate">{asset.title || 'Untitled asset'}</h4>
                  <p className="text-[11px] text-fg-muted truncate">
                    <span className="capitalize">{asset.type}</span>
                    {asset.duration ? <span className="font-mono"> · {asset.duration}</span> : null}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_TONE[asset.status]}`}>
                  {MEDIA_STATUS_LABELS[asset.status]}
                </span>
                <button type="button" onClick={() => onEdit(asset)} className={ICON_BTN} aria-label={`Edit ${asset.title}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => onAskRemove(asset.id)} className={ICON_BTN} aria-label={`Remove ${asset.title}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {asset.format && <p className="bg-code p-2.5 rounded-lg text-[11px] text-fg font-mono border border-line">Format: {asset.format}</p>}
            {asset.description && <p className="text-xs text-fg-muted leading-relaxed">{asset.description}</p>}

            {confirmRemoveId === asset.id && (
              <RemoveConfirm question="Remove this asset from the roster?" onConfirm={() => onRemove(asset.id)} onCancel={() => onAskRemove(null)} />
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
);
