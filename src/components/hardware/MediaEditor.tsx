import React from 'react';
import type { MediaAssetItem } from '../../types';
import { newId } from '../../state/ids';
import { Modal } from '../ui/Modal';
import { MEDIA_STATUS_LABELS, MEDIA_STATUSES, MEDIA_TYPES, validateMedia } from './manifest';

const FORM_ID = 'media-asset-form';
const FIELD =
  'w-full rounded-xl border border-line bg-input px-3 py-2 text-fg placeholder-fg-subtle focus:border-purple-500 focus:outline-none';
const LABEL = 'mb-1 block font-semibold text-fg-muted';

/** A blank asset. Format and duration stay empty — they are facts about a file nobody made yet. */
export function blankMedia(): MediaAssetItem {
  return { id: newId('media'), title: '', type: 'video', format: '', duration: '', status: 'planning', description: '' };
}

export interface MediaEditorProps {
  asset: MediaAssetItem | null;
  onSave: (asset: MediaAssetItem) => void;
  onClose: () => void;
}

/** Add / edit one media asset of the project's roster. */
export const MediaEditor: React.FC<MediaEditorProps> = ({ asset, onSave, onClose }) => {
  const [draft, setDraft] = React.useState<MediaAssetItem | null>(asset);
  const [attempted, setAttempted] = React.useState(false);

  React.useEffect(() => {
    setDraft(asset);
    setAttempted(false);
  }, [asset]);

  if (!draft) return <Modal open={false} onClose={onClose} title="Media asset" />;

  const patch = (change: Partial<MediaAssetItem>): void => setDraft((d) => (d ? { ...d, ...change } : d));
  const problems = validateMedia(draft);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    setAttempted(true);
    if (problems.length) return;
    onSave({ ...draft, title: draft.title.trim() });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={asset && asset.title ? 'Edit media asset' : 'Add media asset'}
      subtitle="Part of this project's media roster. It is stored with the project and exported with it."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl bg-elevated px-3.5 py-2 text-xs font-medium text-fg-muted hover:bg-line">
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500">
            Save asset
          </button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="space-y-3.5 text-xs">
        <div>
          <label className={LABEL} htmlFor="media-title">
            Title
          </label>
          <input id="media-title" type="text" value={draft.title} onChange={(e) => patch({ title: e.target.value })} className={FIELD} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className={LABEL} htmlFor="media-type">
              Type
            </label>
            <select
              id="media-type"
              value={draft.type}
              onChange={(e) => patch({ type: e.target.value as MediaAssetItem['type'] })}
              className={`${FIELD} capitalize`}
            >
              {MEDIA_TYPES.map((type) => (
                <option key={type} value={type} className="capitalize">
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="media-status">
              Status
            </label>
            <select
              id="media-status"
              value={draft.status}
              onChange={(e) => patch({ status: e.target.value as MediaAssetItem['status'] })}
              className={FIELD}
            >
              {MEDIA_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {MEDIA_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="media-format">
              Format
            </label>
            <input
              id="media-format"
              type="text"
              value={draft.format}
              onChange={(e) => patch({ format: e.target.value })}
              placeholder="e.g. ProRes 4444"
              className={`${FIELD} font-mono`}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="media-duration">
              Duration
            </label>
            <input
              id="media-duration"
              type="text"
              value={draft.duration}
              onChange={(e) => patch({ duration: e.target.value })}
              placeholder="e.g. 8:20"
              className={`${FIELD} font-mono`}
            />
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="media-description">
            Description
          </label>
          <textarea
            id="media-description"
            rows={3}
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            className={`${FIELD} resize-none`}
          />
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
