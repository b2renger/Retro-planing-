import React from 'react';
import { CheckCircle2, Loader2, Plus, Radar, Star, XCircle } from 'lucide-react';
import { capabilities } from '../../capabilities';
import { useApp } from '../../context/AppContext';
import { testConnection, type ConnectionTestResult } from '../../services/ai/client';
import { PROVIDER_CATALOG } from '../../services/ai/registry';
import type { AiProviderConfig, AiProviderId } from '../../services/ai/types';
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, PanelHeading } from './controls';
import { ProviderForm } from './ProviderForm';
import { PROVIDER_BLURB } from './helpers';
import { LanFarmNotice } from './LanFarmNotice';

type View = { kind: 'list' } | { kind: 'pick' } | { kind: 'form'; family: AiProviderId; existing?: AiProviderConfig };

type TestState = { status: 'running' } | { status: 'done'; result: ConnectionTestResult };

const FAMILIES = Object.keys(PROVIDER_CATALOG) as AiProviderId[];

const StatusDot: React.FC<{ state: TestState | undefined }> = ({ state }) => {
  const [cls, text] =
    state?.status === 'running'
      ? ['bg-amber-500 animate-pulse', 'Testing the connection…']
      : state?.status === 'done'
        ? state.result.ok
          ? ['bg-emerald-500', 'Answered the last test']
          : ['bg-rose-500', 'The last test failed']
        : ['bg-line-strong', 'Not tested in this session'];
  return <span className={`w-2 h-2 rounded-full shrink-0 ${cls}`} role="img" aria-label={text} title={text} />;
};

const ProviderCard: React.FC<{
  provider: AiProviderConfig;
  isDefault: boolean;
  isActive: boolean;
  test: TestState | undefined;
  confirmingRemove: boolean;
  onTest: () => void;
  onEdit: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  onSetDefault: () => void;
}> = ({ provider, isDefault, isActive, test, confirmingRemove, onTest, onEdit, onAskRemove, onCancelRemove, onConfirmRemove, onSetDefault }) => (
  <li className="p-3 rounded-xl bg-elevated border border-line space-y-2">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <StatusDot state={test} />
          <span className="text-xs font-semibold text-fg truncate">{provider.label}</span>
          {isDefault ? (
            <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-[10px] font-bold text-blue-700 dark:text-blue-300">
              Default
            </span>
          ) : (
            isActive && (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-500/10 border border-slate-500/20 text-[10px] font-bold text-fg-muted">
                In use (no default set)
              </span>
            )
          )}
        </div>
        <p className="text-[11px] text-fg-muted truncate">
          {PROVIDER_CATALOG[provider.providerId]?.label ?? provider.providerId} · {provider.model || 'no model set'}
        </p>
        {provider.baseUrl && <p className="text-[11px] text-fg-subtle font-mono truncate">{provider.baseUrl}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button type="button" onClick={onTest} disabled={test?.status === 'running'} className={BTN_SECONDARY}>
          {test?.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>Test</span>
        </button>
        <button type="button" onClick={onEdit} className={BTN_SECONDARY}>
          Edit
        </button>
        {!confirmingRemove && (
          <button type="button" onClick={onAskRemove} className={BTN_GHOST}>
            Remove
          </button>
        )}
      </div>
    </div>

    {!isDefault && (
      <button type="button" onClick={onSetDefault} className={BTN_GHOST}>
        <Star className="w-3.5 h-3.5" />
        <span>Set as default</span>
      </button>
    )}

    {confirmingRemove && (
      <div role="alert" className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30">
        <span className="text-[11px] text-fg">Remove {provider.label}? Its key is deleted too.</span>
        <button type="button" onClick={onConfirmRemove} className={BTN_DANGER}>
          Remove
        </button>
        <button type="button" onClick={onCancelRemove} className={BTN_SECONDARY}>
          Keep it
        </button>
      </div>
    )}

    {test?.status === 'done' && (
      <div className="flex items-start gap-1.5 text-[11px] text-fg-muted">
        {test.result.ok ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-px" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-px" />
        )}
        <span className="break-words">
          {test.result.message}
          {test.result.ok && test.result.sampleReply ? ` · reply: ${test.result.sampleReply.slice(0, 120)}` : ''}
        </span>
      </div>
    )}
  </li>
);

/** AI providers tab: the configured list, the add flow and the LlmOnLan shortcut. */
export const AiProvidersPanel: React.FC = () => {
  const { aiSettings, activeAiProvider, removeAiProvider, setDefaultAiProvider } = useApp();
  const caps = capabilities();
  const [view, setView] = React.useState<View>({ kind: 'list' });
  const [tests, setTests] = React.useState<Record<string, TestState>>({});
  const [confirmRemoveId, setConfirmRemoveId] = React.useState<string | null>(null);

  const runTest = async (provider: AiProviderConfig) => {
    setTests((t) => ({ ...t, [provider.id]: { status: 'running' } }));
    const result = await testConnection(provider);
    setTests((t) => ({ ...t, [provider.id]: { status: 'done', result } }));
  };

  if (view.kind === 'form') {
    return (
      <ProviderForm
        family={view.family}
        existing={view.existing}
        onDone={() => setView({ kind: 'list' })}
        onCancel={() => setView({ kind: view.existing ? 'list' : 'pick' })}
      />
    );
  }

  if (view.kind === 'pick') {
    return (
      <div className="space-y-4">
        <PanelHeading title="Choose a provider" description="Hosted services need a key. Local and LAN servers need an address." />
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FAMILIES.map((family) =>
            family === 'llmonlan' && !caps.canUseLanFarms ? (
              <li key={family} className="sm:col-span-2">
                <LanFarmNotice />
              </li>
            ) : (
              <li key={family}>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'form', family })}
                  className="w-full h-full text-left p-3 rounded-xl bg-elevated border border-line hover:border-line-strong hover:bg-line transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span className="block text-xs font-semibold text-fg">{PROVIDER_CATALOG[family].label}</span>
                  <span className="block text-[11px] text-fg-muted leading-relaxed mt-0.5">{PROVIDER_BLURB[family]}</span>
                </button>
              </li>
            ),
          )}
        </ul>
        <button type="button" onClick={() => setView({ kind: 'list' })} className={BTN_GHOST}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PanelHeading
        title="AI providers"
        description="Every AI feature — structuring notes, dependency analysis, the assistant — runs through the default provider below."
      />

      {aiSettings.providers.length === 0 ? (
        <div className="p-4 rounded-xl bg-elevated border border-line space-y-3">
          <p className="text-xs text-fg-muted leading-relaxed">
            No provider is configured, so the AI features fall back to a local heuristic planner that fills a schedule from simple rules and
            says so on every result.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setView({ kind: 'pick' })} className={BTN_PRIMARY}>
              <Plus className="w-3.5 h-3.5" />
              <span>Add provider</span>
            </button>
            {caps.canUseLanFarms && (
              <button type="button" onClick={() => setView({ kind: 'form', family: 'llmonlan' })} className={BTN_SECONDARY}>
                <Radar className="w-3.5 h-3.5" />
                <span>Find a LlmOnLan farm</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {aiSettings.providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                isDefault={provider.id === aiSettings.defaultProviderId}
                isActive={provider.id === activeAiProvider?.id}
                test={tests[provider.id]}
                confirmingRemove={confirmRemoveId === provider.id}
                onTest={() => void runTest(provider)}
                onEdit={() => setView({ kind: 'form', family: provider.providerId, existing: provider })}
                onAskRemove={() => setConfirmRemoveId(provider.id)}
                onCancelRemove={() => setConfirmRemoveId(null)}
                onConfirmRemove={() => {
                  removeAiProvider(provider.id);
                  setConfirmRemoveId(null);
                }}
                onSetDefault={() => setDefaultAiProvider(provider.id)}
              />
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setView({ kind: 'pick' })} className={BTN_PRIMARY}>
              <Plus className="w-3.5 h-3.5" />
              <span>Add provider</span>
            </button>
            {caps.canUseLanFarms && (
              <button type="button" onClick={() => setView({ kind: 'form', family: 'llmonlan' })} className={BTN_SECONDARY}>
                <Radar className="w-3.5 h-3.5" />
                <span>Find a LlmOnLan farm</span>
              </button>
            )}
          </div>
        </>
      )}

      <p className="text-[11px] text-fg-muted leading-relaxed border-t border-line pt-3">{caps.keyStorageNote}</p>
    </div>
  );
};
