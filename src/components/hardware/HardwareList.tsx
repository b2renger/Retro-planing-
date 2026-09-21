import React from 'react';
import { Cpu, Layers, Pencil, Plus, Trash2, Tv, Volume2 } from 'lucide-react';
import type { HardwareItem } from '../../types';
import { ADD_BTN, ICON_BTN, RemoveConfirm } from './listChrome';
import { HARDWARE_CATEGORIES, HARDWARE_STATUS_LABELS } from './manifest';

const STATUS_TONE: Record<HardwareItem['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  booked: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  delivered: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  tested: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
};

const CATEGORY_ICON: Record<HardwareItem['category'], React.FC<{ className?: string }>> = {
  Projection: Tv,
  Audio: Volume2,
  'Media Server & Network': Cpu,
  'Rigging & Power': Layers,
};

export interface HardwareListProps {
  items: readonly HardwareItem[];
  total: number;
  categoryFilter: string;
  onCategoryFilter: (category: string) => void;
  confirmRemoveId: string | null;
  onAskRemove: (id: string | null) => void;
  onRemove: (id: string) => void;
  onEdit: (item: HardwareItem) => void;
  onAdd: () => void;
}

/** The manifest itself: filter pills, the cards, and the add / edit / remove controls. */
export const HardwareList: React.FC<HardwareListProps> = ({
  items,
  total,
  categoryFilter,
  onCategoryFilter,
  confirmRemoveId,
  onAskRemove,
  onRemove,
  onEdit,
  onAdd,
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['all', ...HARDWARE_CATEGORIES].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onCategoryFilter(cat)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              categoryFilter === cat ? 'bg-elevated text-fg font-semibold border border-line-strong' : 'text-fg-muted hover:text-fg hover:bg-elevated'
            }`}
          >
            {cat === 'all' ? `All (${total})` : cat}
          </button>
        ))}
      </div>
      <button type="button" onClick={onAdd} className={ADD_BTN}>
        <Plus className="w-3.5 h-3.5" />
        <span>Add hardware</span>
      </button>
    </div>

    {items.length === 0 ? (
      <p className="p-6 text-center text-xs text-fg-muted bg-card border border-line rounded-xl">
        {total === 0 ? 'No hardware listed yet. Add the first item.' : 'No item in this category.'}
      </p>
    ) : (
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = CATEGORY_ICON[item.category];
          return (
            <li key={item.id} className="bg-card border border-line rounded-xl p-4 space-y-2.5 shadow-sm dark:shadow-none">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-elevated border border-line flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-fg-muted" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-fg truncate">{item.name || 'Untitled item'}</h4>
                    <p className="text-[11px] text-fg-muted truncate">
                      <span className="font-mono">Qty {item.quantity}</span> · {item.category}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_TONE[item.status]}`}>
                    {HARDWARE_STATUS_LABELS[item.status]}
                  </span>
                  <button type="button" onClick={() => onEdit(item)} className={ICON_BTN} aria-label={`Edit ${item.name}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => onAskRemove(item.id)} className={ICON_BTN} aria-label={`Remove ${item.name}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {item.specs && <p className="bg-code p-2.5 rounded-lg text-[11px] text-fg font-mono border border-line">{item.specs}</p>}

              {(item.vendor || item.notes) && (
                <div className="flex items-center justify-between gap-2 text-[11px] text-fg-muted pt-1 border-t border-line">
                  {item.vendor && (
                    <span className="truncate">
                      Vendor: <strong className="text-fg">{item.vendor}</strong>
                    </span>
                  )}
                  {item.notes && <span className="truncate text-fg-subtle italic">{item.notes}</span>}
                </div>
              )}

              {confirmRemoveId === item.id && (
                <RemoveConfirm question="Remove this item from the manifest?" onConfirm={() => onRemove(item.id)} onCancel={() => onAskRemove(null)} />
              )}
            </li>
          );
        })}
      </ul>
    )}
  </div>
);
