import React, { useMemo, useState } from 'react';
import { Calendar, Film, Layers, Timer, Tv } from 'lucide-react';
import { computeProjectHealth, useActiveProject, useApp } from '../context/AppContext';
import { parseDay } from '../services/export/common';
import type { HardwareItem, MediaAssetItem } from '../types';
import { blankHardware, HardwareEditor } from './hardware/HardwareEditor';
import { HardwareList } from './hardware/HardwareList';
import { blankMedia, MediaEditor } from './hardware/MediaEditor';
import { MediaList } from './hardware/MediaList';
import { hardwareSummary, mediaSummary, removeById, upsertById } from './hardware/manifest';

const TAB =
  'px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string; detail?: string }> = ({ icon, label, value, detail }) => (
  <div className="bg-elevated/60 border border-line p-3 rounded-xl min-w-0">
    <div className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider flex items-center gap-1.5">
      {icon}
      <span className="truncate">{label}</span>
    </div>
    <div className="text-base font-bold text-fg mt-1 font-mono truncate">{value}</div>
    {detail && <div className="text-[10px] text-fg-muted mt-0.5 truncate">{detail}</div>}
  </div>
);

/**
 * The project's hardware manifest and media roster — both editable through `updateProject`, and
 * every number on screen counted from those two lists rather than written into the markup.
 *
 * The three task tabs this view used to carry (Booking / Testing / Review) matched tasks with
 * `phaseId.includes('booking')`, which only ever matched the bundled sample project and was empty
 * for every project created in the app. Tasks belong to the board and the timeline and are not
 * duplicated here.
 */
export const HardwareMediaView: React.FC = () => {
  const { updateProject } = useApp();
  const project = useActiveProject();

  const [tab, setTab] = useState<'hardware' | 'media'>('hardware');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingHardware, setEditingHardware] = useState<HardwareItem | null>(null);
  const [editingMedia, setEditingMedia] = useState<MediaAssetItem | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const hardware = useMemo(() => project.hardwareItems ?? [], [project.hardwareItems]);
  const media = useMemo(() => project.mediaAssets ?? [], [project.mediaAssets]);
  const hw = hardwareSummary(hardware);
  const md = mediaSummary(media);
  const health = computeProjectHealth(project);
  const hasTarget = parseDay(project.targetDeliveryDate) !== null;

  const filtered = categoryFilter === 'all' ? hardware : hardware.filter((item) => item.category === categoryFilter);

  return (
    <div className="space-y-4 max-w-7xl mx-auto p-3 sm:p-6 pb-12">
      <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-xl transition-colors">
        <div className="space-y-1.5 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-fg tracking-tight">Hardware manifest &amp; media roster</h2>
          <p className="text-xs text-fg-muted max-w-3xl leading-relaxed">
            The equipment this installation needs and the media that runs on it. Both lists belong to “{project.title}”, travel with its
            exports, and are yours to edit.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-line">
          <Metric
            icon={<Tv className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
            label="Hardware"
            value={hw.items === 0 ? 'None listed' : `${hw.items} ${hw.items === 1 ? 'entry' : 'entries'}`}
            detail={hw.items === 0 ? undefined : `${hw.units} ${hw.units === 1 ? 'unit' : 'units'}`}
          />
          <Metric
            icon={<Layers className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
            label="Hardware status"
            value={hw.byStatus[0] ?? '—'}
            detail={hw.byStatus.slice(1).join(' · ') || undefined}
          />
          <Metric
            icon={<Film className="w-3 h-3 text-purple-600 dark:text-purple-400" />}
            label="Media assets"
            value={md.assets === 0 ? 'None listed' : `${md.assets} ${md.assets === 1 ? 'asset' : 'assets'}`}
            detail={md.assets === 0 ? undefined : `${md.video} video · ${md.sound} sound`}
          />
          {hasTarget ? (
            <Metric
              icon={<Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
              label="Target delivery"
              value={project.targetDeliveryDate}
              detail={
                health.scheduleEndsAfterTarget ? `Schedule ends ${Math.abs(health.slackDays)}d past it` : `${health.slackDays}d slack before it`
              }
            />
          ) : (
            <Metric icon={<Timer className="w-3 h-3 text-fg-muted" />} label="Target delivery" value="Not set" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-b border-line pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('hardware')}
          className={`${TAB} ${
            tab === 'hardware'
              ? 'bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-500/40'
              : 'text-fg-muted hover:text-fg hover:bg-elevated'
          }`}
        >
          <Tv className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Hardware ({hw.items})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('media')}
          className={`${TAB} ${
            tab === 'media'
              ? 'bg-purple-100 dark:bg-purple-600/20 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-500/40'
              : 'text-fg-muted hover:text-fg hover:bg-elevated'
          }`}
        >
          <Film className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Media ({md.assets})</span>
        </button>
      </div>

      {tab === 'hardware' ? (
        <HardwareList
          items={filtered}
          total={hw.items}
          categoryFilter={categoryFilter}
          onCategoryFilter={setCategoryFilter}
          confirmRemoveId={confirmRemove}
          onAskRemove={setConfirmRemove}
          onRemove={(id) => {
            updateProject({ hardwareItems: removeById(hardware, id) });
            setConfirmRemove(null);
          }}
          onEdit={setEditingHardware}
          onAdd={() => setEditingHardware(blankHardware())}
        />
      ) : (
        <MediaList
          assets={media}
          statusLine={md.byStatus.join(' · ')}
          confirmRemoveId={confirmRemove}
          onAskRemove={setConfirmRemove}
          onRemove={(id) => {
            updateProject({ mediaAssets: removeById(media, id) });
            setConfirmRemove(null);
          }}
          onEdit={setEditingMedia}
          onAdd={() => setEditingMedia(blankMedia())}
        />
      )}

      <HardwareEditor
        item={editingHardware}
        onSave={(item) => {
          updateProject({ hardwareItems: upsertById(hardware, item) });
          setEditingHardware(null);
        }}
        onClose={() => setEditingHardware(null)}
      />
      <MediaEditor
        asset={editingMedia}
        onSave={(asset) => {
          updateProject({ mediaAssets: upsertById(media, asset) });
          setEditingMedia(null);
        }}
        onClose={() => setEditingMedia(null)}
      />
    </div>
  );
};
