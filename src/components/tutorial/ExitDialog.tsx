/**
 * Leaving the tutorial. Removing the practice project is the default and the primary button;
 * keeping it is a deliberate, secondary choice.
 */
import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { Modal } from '../ui/Modal';

export interface ExitDialogProps {
  open: boolean;
  /** True when the user reached the end rather than leaving early. */
  finished: boolean;
  onCancel: () => void;
  onConfirm: (options: { removeSandbox: boolean }) => void;
}

export const ExitDialog: React.FC<ExitDialogProps> = ({ open, finished, onCancel, onConfirm }) => {
  const [keep, setKeep] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={finished ? 'Tutorial finished' : 'Leave the tutorial?'}
      icon={<GraduationCap className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />}
      subtitle="Everything you changed happened in the practice project."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-elevated px-3.5 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-line"
          >
            {finished ? 'Keep going' : 'Stay in the tutorial'}
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ removeSandbox: !keep })}
            className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500"
          >
            {keep ? 'Leave and keep it' : 'Remove it and leave'}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-xs">
        <p className="text-fg-muted">
          The tutorial worked on a throwaway copy of the sample project. Your own projects were never touched — nothing you did here reached them.
        </p>
        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-line bg-elevated p-3">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="mt-0.5" />
          <span>
            <span className="block font-semibold text-fg">Keep the practice project</span>
            <span className="block text-fg-muted">It stays in your project list, marked as a practice copy. You can delete it later like any other project.</span>
          </span>
        </label>
      </div>
    </Modal>
  );
};
