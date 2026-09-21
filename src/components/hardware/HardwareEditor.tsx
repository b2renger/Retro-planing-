import React from 'react';
import type { HardwareItem } from '../../types';
import { newId } from '../../state/ids';
import { Modal } from '../ui/Modal';
import { HARDWARE_CATEGORIES, HARDWARE_STATUSES, HARDWARE_STATUS_LABELS, validateHardware } from './manifest';

const FORM_ID = 'hardware-item-form';
const FIELD =
  'w-full rounded-xl border border-line bg-input px-3 py-2 text-fg placeholder-fg-subtle focus:border-blue-500 focus:outline-none';
const LABEL = 'mb-1 block font-semibold text-fg-muted';

/** A blank item: quantity 1 because a listed piece of kit is at least one unit. */
export function blankHardware(): HardwareItem {
  return { id: newId('hw'), name: '', category: 'Projection', quantity: 1, specs: '', status: 'pending', vendor: '', notes: '' };
}

export interface HardwareEditorProps {
  /** The item being edited or added; `null` closes the dialog. */
  item: HardwareItem | null;
  onSave: (item: HardwareItem) => void;
  onClose: () => void;
}

/** Add / edit one hardware item. Nothing is filled in for the user except the quantity. */
export const HardwareEditor: React.FC<HardwareEditorProps> = ({ item, onSave, onClose }) => {
  const [draft, setDraft] = React.useState<HardwareItem | null>(item);
  const [attempted, setAttempted] = React.useState(false);

  React.useEffect(() => {
    setDraft(item);
    setAttempted(false);
  }, [item]);

  if (!draft) return <Modal open={false} onClose={onClose} title="Hardware item" />;

  const patch = (change: Partial<HardwareItem>): void => setDraft((d) => (d ? { ...d, ...change } : d));
  const problems = validateHardware(draft);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    setAttempted(true);
    if (problems.length) return;
    onSave({ ...draft, name: draft.name.trim() });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item && item.name ? 'Edit hardware' : 'Add hardware'}
      subtitle="Part of this project's manifest. It is stored with the project and exported with it."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl bg-elevated px-3.5 py-2 text-xs font-medium text-fg-muted hover:bg-line">
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500">
            Save item
          </button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="space-y-3.5 text-xs">
        <div>
          <label className={LABEL} htmlFor="hw-name">
            Name
          </label>
          <input id="hw-name" type="text" value={draft.name} onChange={(e) => patch({ name: e.target.value })} className={FIELD} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL} htmlFor="hw-category">
              Category
            </label>
            <select
              id="hw-category"
              value={draft.category}
              onChange={(e) => patch({ category: e.target.value as HardwareItem['category'] })}
              className={FIELD}
            >
              {HARDWARE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="hw-quantity">
              Quantity
            </label>
            <input
              id="hw-quantity"
              type="number"
              min="1"
              step="1"
              value={draft.quantity}
              onChange={(e) => patch({ quantity: Number(e.target.value) })}
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="hw-status">
              Status
            </label>
            <select
              id="hw-status"
              value={draft.status}
              onChange={(e) => patch({ status: e.target.value as HardwareItem['status'] })}
              className={FIELD}
            >
              {HARDWARE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {HARDWARE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="hw-specs">
            Specification
          </label>
          <textarea
            id="hw-specs"
            rows={2}
            value={draft.specs}
            onChange={(e) => patch({ specs: e.target.value })}
            className={`${FIELD} resize-none font-mono`}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="hw-vendor">
              Vendor
            </label>
            <input id="hw-vendor" type="text" value={draft.vendor ?? ''} onChange={(e) => patch({ vendor: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="hw-notes">
              Notes
            </label>
            <input id="hw-notes" type="text" value={draft.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} className={FIELD} />
          </div>
        </div>

        {attempted && problems.length > 0 && (
          <ul role="alert" className="space-y-0.5 text-rose-600 dark:text-rose-400">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </form>
    </Modal>
  );
};
